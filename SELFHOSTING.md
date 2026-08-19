# Self-hosting TaxVault with Docker

Runs the whole app - Postgres, Redis, API, Celery worker, Celery beat, and the
SPA behind nginx - as six containers on one machine. No Supabase, no Upstash,
no R2, no Netlify.

The same `docker-compose.selfhost.yml` runs on a rented server later. Moving
there is an env-file change plus a database restore, not a rewrite - see
[Moving to a rented server](#moving-to-a-rented-server).

---

## What you end up with

```
                    ┌──────────── tv-web (nginx :8080) ────────────┐
  browser  ────────▶│  /            → React bundle (static files)  │
                    │  /api/v1/...  → proxied to tv-api:8000       │
                    └──────────────────────┬───────────────────────┘
                                           │  docker network (internal)
              ┌────────────────────────────┼────────────────────────────┐
              ▼                            ▼                            ▼
        tv-api (gunicorn,           tv-worker (celery)           tv-beat (celery)
         4 uvicorn workers)                 │                            │
              │                             │                            │
              ├─────────────┬───────────────┴────────────┬───────────────┘
              ▼             ▼                            ▼
        tv-postgres    tv-redis                   volume: uploads
        volume:pgdata  volume:redisdata           (your documents)
```

Everything on one origin means no CORS, and the browser never learns the API's
address - it just calls `/api/v1/...` on whatever host it loaded the page from.

**Three docker volumes hold all your state.** Lose them and you lose everything:

| Volume | Holds |
|---|---|
| `taxvault-selfhost_pgdata` | The database |
| `taxvault-selfhost_uploads` | Every uploaded document |
| `taxvault-selfhost_redisdata` | Queued jobs, token blocklist (disposable) |

---

## Step 0 - Free up disk first (you will hit this)

Right now:

```
C:  269G total, 13G free   (96% used)
D:  207G total, 132M free  (100% full)
```

A backend image is ~700 MB, the frontend build pulls ~400 MB of node_modules
into a build layer, and Postgres is ~450 MB. The build **will** fail as things
stand.

The good news is Docker is already holding most of it. Check:

```powershell
docker system df
```

At last look that reported **42.5 GB of reclaimable images** and **14.5 GB of
build cache** - about 57 GB of images and layers from other projects.

```powershell
# Build cache only - always safe, always rebuildable.
docker builder prune -af

# Stopped containers (you have ~41 of them).
docker container prune -f

# Images not referenced by any container. Re-pullable, but this will make the
# next build of your OTHER projects slow. Review before running.
docker image prune -a
```

**Do not run `docker system prune --volumes`.** You have 69 volumes and some of
them are other projects' databases. The `--volumes` flag deletes every volume no
running container has mounted, with no confirmation per volume.

Docker Desktop on WSL2 keeps its data in a virtual disk that does not always
shrink after a prune. If Windows still shows the space as used:

```powershell
# Settings → Resources → "Clean / Purge data", or from an elevated prompt:
wsl --shutdown
Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\disk\docker_desktop.vhdx" -Mode Full
```

`Optimize-VHD` needs the Hyper-V module; if it is missing, Docker Desktop's
Settings → Resources → Advanced → "Disk image location" panel has a
**Clean up** button that does the same thing.

Aim for **20 GB free on C:** before continuing.

---

## Step 1 - Create the config

```bash
cp backend/.env.selfhost.example backend/.env.selfhost
```

Generate the two secrets:

```bash
python -c "import secrets; print('SECRET_KEY      =', secrets.token_hex(32))"
python -c "import secrets; print('POSTGRES_PASSWORD =', secrets.token_urlsafe(24))"
```

Open `backend/.env.selfhost` and set:

- `SECRET_KEY` - the 64-hex value. Changing it later logs everyone out.
- `POSTGRES_PASSWORD` - **no `$` characters**; docker compose reads this file
  for `${...}` interpolation and would eat them.
- `DATABASE_URL` and `DIRECT_DATABASE_URL` - paste the same password into both.

Leave `R2_*` blank. That is deliberate: with R2 unconfigured the backend falls
back to local-disk storage (`app/core/config.py:120`), which is exactly what you
want when self-hosting. Documents land in the `uploads` volume.

> `backend/.env.selfhost` is gitignored. It is the one file not reproducible
> from the repo - keep a copy with your backups.

---

## Step 2 - Build the images

```powershell
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost build
```

First build is 5–10 minutes: it compiles the Python wheels and runs
`npm ci && npm run build` inside the container. Nothing touches your host
`node_modules`, so the D: drive stays as it is.

That command is long enough to be worth an alias. In PowerShell:

```powershell
function tv { docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost @args }
```

Add it to `$PROFILE` to keep it. Everything below is written out in full, but
`tv up -d`, `tv logs -f api`, `tv ps` all work once that is loaded.

---

## Step 3 - Start Postgres alone

Before the API touches it, so you can load your existing data first.

```powershell
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d postgres
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost ps
```

Wait for `tv-postgres` to read `healthy` (about 15 seconds).

---

## Step 4 - Bring your Supabase data across

Your live data is in Supabase (`db.arzylkwqmafifyswpaia.supabase.co`). This
copies it into the local Postgres. It reads from Supabase and writes locally -
Supabase is untouched, so you can keep it as a fallback until you are confident.

```bash
# Git Bash - the script needs bash, not PowerShell
./scripts/import-from-supabase.sh
```

It reads `DIRECT_DATABASE_URL` from your existing `backend/.env`, dumps the
`public` schema through a throwaway `postgres:16` container (so you need no
local `pg_dump`), saves it to `backups/supabase-<timestamp>.dump`, asks for
confirmation, then loads it and prints a row count per table.

Two things worth knowing:

- **Warnings are normal.** `pg_restore` complains about `supabase_admin` and
  extension ownership because those roles do not exist locally. `--no-owner
  --no-privileges` is why they are only warnings. Trust the row counts it prints
  at the end, not the warning text.
- **`alembic_version` comes across in the dump**, so the migration state
  transfers with the data and step 5's `alembic upgrade head` is a no-op.

**Starting fresh instead?** Skip this step. Alembic creates the schema in step
5, and the first user you register becomes the **super admin** - the account
that owns the vault every other login reads.

**Roles.** TaxVault holds one shared vault; the role decides what a login may
do with it:

| Role | Sees | Can add | Can edit / delete | Manages users |
| --- | --- | --- | --- | --- |
| `super_admin` | everything | everything | yes | yes |
| `admin` | everything | properties, individuals, bills, taxes, insurance, documents, payments | no - but approves members' requests | no |
| `user` | calendar, bills, taxes, insurance, payments | bills, taxes, insurance, payments | only via approval | no |

Promote or demote from **Users** in the sidebar (super admin only). The full
table lives in `backend/app/core/permissions.py`; the frontend mirrors it in
`frontend/src/utils/permissions.ts`.

**Approvals (maker/checker).** A member adds bills, taxes and insurance
policies outright, but editing or deleting one is filed as a *change request*
rather than applied. Their Edit button reads "Request edit"; submitting sends
only the fields they changed. An admin or super admin reviews it under
**Approvals** in the sidebar, and approving applies the change through exactly
the same code path a super admin's own edit takes.

Admins deliberately hold no `*.request_change` permission: they are the
checker, never the maker, so an admin cannot file a request and then approve it
to sidestep their own read-only limit. A super admin can file one, but has no
reason to - they can simply make the edit.

The **Approvals** tab itself is reviewer-only (admin and super admin). Members
get a confirmation when they submit, but no queue of their own.

**Requests expire.** A request nobody reviews within
`CHANGE_REQUEST_TTL_MINUTES` (default **15**) lapses to `expired` and can no
longer be approved - a stale edit should not land on a record that has moved on
since. Expiry is evaluated whenever the queue is read or reviewed rather than
by a background job, so it is exact at the moment it matters and needs no
worker running. Change the window in `backend/.env`:

```
CHANGE_REQUEST_TTL_MINUTES=60
```

It applies immediately to requests already in flight.

**Test logins.** To exercise all three roles against real data:

```powershell
docker compose -f docker-compose.selfhost.yml exec api python scripts/seed_rbac_users.py
```

It creates `super.admin@taxvault.in` / `SuperAdmin@123`,
`admin@taxvault.in` / `Admin@123` and `user@taxvault.in` / `User@123`, and is
idempotent (re-running just resets those three). Delete them before the
deployment goes anywhere real - the passwords are in source control.

---

## Step 5 - Start everything

```powershell
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d
```

Order is enforced by the compose file: `postgres` healthy → `migrate` runs
`alembic upgrade head` and exits → `api` starts → `worker`, `beat`, `web`.

```powershell
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost ps
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost logs -f api
```

`tv-migrate` showing `Exited (0)` is correct - it is a one-shot job, not a
crash.

Then check:

| URL | Expect |
|---|---|
| http://localhost:8080 | The app |
| http://localhost:8001/health | `{"status":"ok","version":"1.0.0"}` |
| http://localhost:8001/health/ready | `{"status":"ready","db":"ok","redis":"ok"}` |

`/health/ready` is the one that matters - it proves the API reached both
Postgres and Redis. `/docs` is off because `ENVIRONMENT=production`.

---

## Step 6 - Reach it from your phone and laptop

Find this machine's LAN address:

```powershell
(Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual).IPAddress
```

Say it is `192.168.1.50`. Add that origin to `backend/.env.selfhost`:

```ini
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://192.168.1.50:8080
FRONTEND_URL=http://192.168.1.50:8080
```

`CORS_ORIGINS` does double duty in production: it also seeds the trusted-Host
allowlist (`backend/app/main.py:60`). Miss this and the API answers
`Invalid host header` to every LAN request while localhost keeps working - a
confusing failure worth recognising.

Restart the API and open the firewall:

```powershell
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d api

# Elevated PowerShell, once
New-NetFirewallRule -DisplayName "TaxVault web" -Direction Inbound `
  -LocalPort 8080 -Protocol TCP -Action Allow -Profile Private
```

`-Profile Private` matters. On a Public network profile Windows treats your home
LAN as hostile and this rule will not apply - check with `Get-NetConnectionProfile`
and set it to Private if needed.

Then browse to `http://192.168.1.50:8080` from any device on the network.

> Only ports 8080 (web) and, on loopback, 8001/5433 are bound. Postgres and
> Redis are not reachable from the LAN at all.

---

## Step 6.5 - Turn on WhatsApp reminders

Payment reminders go out over WhatsApp via Twilio. Nothing else needs
configuring - email needs SES credentials and push needs a Firebase service
account, so on a stock self-hosted install WhatsApp is the channel that works.

**Get the credentials.** In the [Twilio console](https://console.twilio.com):
Account SID and Auth Token are on the dashboard. For the sender, use
**Messaging → Try it out → Send a WhatsApp message** - the sandbox gives you a
number (`+14155238886`) and a `join <code>` message. Send that message from the
phone that should receive alerts; the sandbox only delivers to numbers that
have opted in this way. For production, register your own sender under
**Messaging → Senders**.

**Set them in `backend/.env.selfhost`:**

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=+14155238886
TWILIO_WHATSAPP_TO=+919876543210
```

`TWILIO_WHATSAPP_TO` is the one number every reminder goes to - the household
number. Leave it blank to send to each user's own `phone_number` instead.
Numbers are plain E.164; the `whatsapp:` prefix Twilio wants is added for you.

Restart the API and worker so they pick the values up:

```powershell
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d api worker beat
```

**Verify it.** Open **Alerts** in the sidebar. The card at the top says either
*Sending to +91••••3210* or exactly which variable is still missing. Hit **Send
test message** - it goes down the same code path a real reminder takes, so if
it arrives, reminders will too.

**When they fire.** A Celery beat job scans every morning at 08:00 IST and
sends a reminder for anything due in 15, 7 or 1 day; a second job at 09:00
chases anything already overdue. Change the schedule for every payable at once
on the Alerts page, or switch individual ones off there. Alerts are idempotent
- the same reminder is never sent twice on the same day, even if the worker
restarts.

Note the `worker` and `beat` containers must both be running: `beat` decides
*when*, `worker` does the sending.

---

## Step 7 - Survive a reboot

Every service is `restart: unless-stopped`, so Docker restarts them. Docker
itself needs to start first:

**Docker Desktop → Settings → General → ✅ Start Docker Desktop when you log in.**

The catch: that fires at *login*, not at boot. If the machine reboots and nobody
logs in, TaxVault is down. If it needs to be reachable unattended, that is the
signal to move to a rented server.

Verify by rebooting and checking `docker ps` - all six containers back, with
`tv-migrate` exited 0.

---

## Step 8 - Back up, for real

Supabase was doing this for you. Now you are.

```bash
./scripts/backup-db.sh
```

Writes `backups/taxvault-<stamp>.dump` (compressed `pg_dump`) and
`backups/uploads-<stamp>.tar.gz` (every document), and prunes anything older
than 30 days (`BACKUP_KEEP_DAYS` to change).

Schedule it daily - elevated PowerShell, once:

```powershell
$action  = New-ScheduledTaskAction -Execute "C:\Program Files\Git\bin\bash.exe" `
             -Argument "-lc './scripts/backup-db.sh'" -WorkingDirectory "D:\TaxVault"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "TaxVault backup" -Action $action -Trigger $trigger `
  -Description "pg_dump + uploads archive"
```

Then get the files **off this machine** - external drive, OneDrive, rclone to
B2/R2, anything. A backup sitting on the disk that dies with the database is not
a backup. Also copy `backend/.env.selfhost`; it is the only unreproducible file.

Restoring:

```bash
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost stop api worker beat
./scripts/restore-db.sh backups/taxvault-20260727-020000.dump backups/uploads-20260727-020000.tar.gz
docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d
```

Do a restore drill once, now, while nothing is at stake. An untested backup is a
guess.

---

## Day-to-day

All commands assume the `tv` alias from step 2; the long form works identically.

```powershell
tv ps                      # what's running
tv logs -f api             # follow API logs
tv logs -f worker beat     # follow Celery
tv restart api             # restart one service
tv down                    # stop everything (volumes survive)
tv up -d                   # start again
```

**Deploying a code change:**

```powershell
git pull
tv build              # rebuild both images
tv up -d              # recreate changed containers; migrate runs automatically
```

Downtime is a few seconds while `api` and `web` swap over.

**A psql shell:**

```powershell
docker exec -it tv-postgres psql -U taxvault -d taxvault
```

**A new migration** - write it against the running database:

```powershell
tv run --rm migrate alembic revision --autogenerate -m "add whatever"
```

Note that the file lands inside the container. For iterative migration work it
is easier to keep using your local `backend/venv` against
`postgresql+asyncpg://taxvault:<pw>@localhost:5433/taxvault`, then `tv build &&
tv up -d` once it is committed.

---

## When something is wrong

**`tv-migrate` exits non-zero and nothing else starts.**
`tv logs migrate`. Usually `DATABASE_URL` disagrees with `POSTGRES_PASSWORD` -
they are set in two places in `.env.selfhost` and must match.

**API container restarts in a loop.**
`tv logs api`. A pydantic `ValidationError` at startup means a required setting
is missing or `SECRET_KEY` failed the production check (needs ≥32 chars and must
not start with `change`).

**Browser loads the app, every API call 500s or hangs.**
`curl http://localhost:8001/health/ready` - if `db` or `redis` is not `ok`, the
problem is below the API. If the API is healthy but nginx is not passing
through, `tv logs web`.

**`Invalid host header`.**
The origin you browsed from is missing from `CORS_ORIGINS`. See step 6.

**Port already in use on 8080.**
Set `WEB_PORT=9090` in `.env.selfhost` and `tv up -d web`. Same for
`API_HOST_PORT` and `POSTGRES_HOST_PORT`.

**Uploads fail with 413.**
nginx caps bodies at 25 MB and the backend at `MAX_UPLOAD_SIZE_MB=20`. Raise
both - `client_max_body_size` in `frontend/nginx.conf` needs a `tv build web`.

**Everything looks fine but scheduled alerts never fire.**
`tv logs beat` should show the two entries from `app/tasks/celery_app.py`
(`daily-alert-scan` at 08:00, `overdue-check` at 09:00, Asia/Kolkata). If beat
is scheduling but nothing runs, the worker is not consuming - `tv logs worker`.

---

## Moving to a rented server

Nothing about the stack changes. The steps:

1. **Provision** - 2 vCPU / 4 GB RAM handles this comfortably. Install Docker
   Engine and the compose plugin.
2. **Copy the repo and `.env.selfhost`** to the server.
3. **Edit the origins** - `CORS_ORIGINS=https://taxvault.yourdomain.in`,
   `FRONTEND_URL` to match. Generate a **fresh** `SECRET_KEY` and
   `POSTGRES_PASSWORD` rather than reusing the workstation's.
4. **Restore your latest backup** with `scripts/restore-db.sh`.
5. **Terminate TLS in front of nginx.** Put Caddy on :80/:443 proxying to the
   `web` container and change `web`'s port mapping to `127.0.0.1:8080:80`. Caddy
   gets Let's Encrypt certificates automatically from a two-line Caddyfile -
   simpler than certbot here.
6. **Point DNS** at the server.

The workstation setup then becomes your staging environment, which is a genuinely
useful thing to keep.

### An in-between worth considering

If what you actually want is *access from anywhere* rather than *a server*, a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
gives you `https://taxvault.yourdomain.in` pointed at this machine - real
certificate, no ports opened on your router, no monthly server bill. Add
`cloudflared` as a seventh container targeting `http://web:80` and put the
hostname in `CORS_ORIGINS`.

It inherits the workstation's weaknesses: the machine has to stay on and logged
in, your upstream bandwidth is the ceiling, and a power cut is an outage. Fine
for a handful of family users; not fine if this ever needs an uptime promise.

---

## What changed in the repo

| File | Purpose |
|---|---|
| `docker-compose.selfhost.yml` | The full six-service stack |
| `frontend/Dockerfile` | Multi-stage Vite build → nginx |
| `frontend/nginx.conf` | SPA routing, `/api` proxy, caching, upload limits |
| `frontend/.dockerignore` | Keeps host `node_modules`/`dist` out of the build |
| `backend/.env.selfhost.example` | Template for the self-hosted config |
| `scripts/import-from-supabase.sh` | One-time Supabase → local data move |
| `scripts/backup-db.sh` | Nightly database + documents backup |
| `scripts/restore-db.sh` | Restore from a backup |
| `backend/app/main.py` | Trusted-host allowlist now strips the port, so a `host:port` origin works |
| `backend/.dockerignore` | Added `uploads/` |
| `.gitignore` | Added `backups/`, unignored `.env.selfhost.example` |

The existing `docker-compose.yml` (dev Postgres) and `docker-compose.prod.yml`
(managed Supabase/Upstash) are untouched. The self-host stack uses its own
compose project name and its own host ports, so it can run alongside them.
