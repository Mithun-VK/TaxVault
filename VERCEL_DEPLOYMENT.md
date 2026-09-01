# Deploying TaxVault on Vercel

TaxVault normally runs as one self-hosted stack (see `SELFHOSTING.md`) where
nginx puts the frontend and backend on one domain. Vercel doesn't work that
way: **frontend and backend become two separate Vercel projects, on two
separate domains**, each with its own repo root, build, and environment
variables. This doc covers that split deployment.

Read this once end to end before starting - the two halves depend on each
other's URLs, so there's an unavoidable chicken-and-egg step (deploy the
backend, note its URL, deploy the frontend pointing at it, then come back and
tell the backend the frontend's URL for CORS).

## What you end up with

- **`taxvault-api`** (Vercel project, root directory `backend/`) - the FastAPI
  app, served as a single Python serverless function
  (`backend/api/index.py`), plus two Vercel Cron Jobs that replace Celery
  beat's daily schedule.
- **`taxvault-web`** (Vercel project, root directory `frontend/`) - the static
  Vite build, served from Vercel's edge with a SPA rewrite.
- **Supabase Postgres** - unchanged, you already have this.
- **Upstash Redis** - unchanged if you're already using it (`.env.example`
  has used `rediss://...upstash.io` as the reference `REDIS_URL` from the
  start); provision one if you were running Redis in a container instead.
- **Cloudflare R2** - unchanged, and now **mandatory**, not just preferred:
  Vercel's filesystem is ephemeral, so the local-disk fallback
  (`document_service.py`'s `LOCAL_STORAGE_DIR` path) silently stops working.
  Uploads/downloads already go straight browser-to-R2 via presigned URLs, so
  nothing about *how* storage works changes - only that R2 must actually be
  configured.

What does **not** run on Vercel: the Celery worker and beat process
(`docker-compose.prod.yml`'s `celery`/`celery-beat` services). Vercel has no
persistent processes. Two Vercel Cron Jobs call new `/api/v1/cron/*` routes
instead, which run the same daily scan synchronously and deliver each alert
in-process rather than queuing it - see "Scheduled alerts" below.

## Prerequisites

- A Vercel account with the CLI installed (`npm i -g vercel`), or just the
  GitHub integration (Import Project) if you'd rather click through the
  dashboard.
- The same Supabase, R2 and (if using Twilio) WhatsApp credentials you'd use
  for self-hosting - see `backend/.env.example`.
- An Upstash Redis instance (or any TCP-reachable Redis with a `rediss://` or
  `redis://` URL) - `REDIS_URL` has no default and the app won't boot
  without it.

## Step 1 - Deploy the backend

In the Vercel dashboard: **Add New > Project**, import this repo, and set
**Root Directory** to `backend`. Vercel picks up `backend/vercel.json`
automatically, which configures the Python 3.12 runtime, the catch-all
rewrite to `api/index.py`, and the two cron schedules.

Set these environment variables on the project (Settings > Environment
Variables). Everything with no default in `app/core/config.py` is **required**
- the app raises a `pydantic.ValidationError` and refuses to boot without it,
even on routes that never touch the missing value:

| Variable | Required | Notes |
|---|---|---|
| `ENVIRONMENT` | yes | `production` - enables `SECRET_KEY` strength checks, hides `/docs` |
| `SECRET_KEY` | yes | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | yes | Supabase **pooler** connection (port 6543) - serverless needs pooling, many short-lived connections would otherwise exhaust Supabase's direct-connection limit |
| `DIRECT_DATABASE_URL` | yes | Supabase direct connection (port 5432). Not used at request time on Vercel - migrations run from your own machine, not from the deployed function - but `Settings()` still requires it to construct |
| `REDIS_URL` | yes | Upstash, `rediss://...` |
| `CORS_ORIGINS` | yes | Leave a placeholder for now (e.g. `https://placeholder.vercel.app`) - you'll set the real frontend URL after Step 3 |
| `FRONTEND_URL` | recommended | Used in outgoing email/notification links |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | yes on Vercel | No local-disk fallback here - see above |
| `CRON_SECRET` | yes, for alerts to work | Same generation command as `SECRET_KEY`. Vercel automatically sends it as `Authorization: Bearer <value>` on cron-triggered requests once it's set as an env var - see "Scheduled alerts" |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | for WhatsApp alerts | Same as self-hosting |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EMAIL_FROM` | for email alerts | Same as self-hosting |
| `ENCRYPTION_MASTER_KEYS` | yes in production | `python -c "import secrets,base64; print('1:'+base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"` - see the comment above `ENCRYPTION_MASTER_KEYS` in `app/core/config.py`. Never rotate `SECRET_KEY` expecting this to follow; they're deliberately independent |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW` | recommended | Set both low - `1` and `0` are reasonable. Each serverless invocation can hold its own pool; the default `5`/`10` (fine for one long-lived Docker process) multiplies across however many concurrent invocations Vercel spins up and can exhaust the pooler's own connection ceiling |

Deploy. Note the resulting URL (e.g. `https://taxvault-api.vercel.app`) -
you'll need it in Step 3. Sanity-check it:

```
curl https://taxvault-api.vercel.app/health
```

## Step 2 - Run migrations

Vercel never runs `alembic upgrade head` for you - it only deploys the app.
Run it from your own machine (or CI) against `DIRECT_DATABASE_URL`, exactly as
you already do for self-hosting:

```
cd backend
alembic upgrade head
```

If this is a fresh database, also run the seed scripts you'd normally run
(`scripts/seed_client_data.py` etc.) the same way.

## Step 3 - Deploy the frontend

Add another Vercel project from the same repo, **Root Directory** set to
`frontend`. `frontend/vercel.json` sets the build command, output directory,
SPA rewrite, and the security/cache headers ported from `frontend/nginx.conf`
(same-origin nginx isn't in the picture anymore, so those headers have to be
set at Vercel's edge instead).

Set one environment variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | The backend's full URL from Step 1, e.g. `https://taxvault-api.vercel.app/api/v1` - **must be absolute**. The relative `/api/v1` default (`frontend/src/api/client.ts`) only works when frontend and backend share an origin, which they don't here |
| `VITE_ENABLE_MOCKS` | `false` |

`VITE_*` variables are baked into the JS bundle at build time (Vite, not a
runtime read), so this has to be set before the build, not after - Vercel's
env vars apply automatically to every subsequent build once set.

Deploy. Note this URL too (e.g. `https://taxvault-web.vercel.app`).

## Step 4 - Connect the two

Go back to the **backend** project's env vars and set the real value:

```
CORS_ORIGINS=https://taxvault-web.vercel.app
```

(Comma-separated if you also want a custom domain and/or Vercel's preview
deployments allowed - preview URLs are unpredictable per-branch, so most
people either add a wildcard-ish allowance manually per PR or just don't
bother enabling CORS for previews.)

Redeploy the backend for the env var to take effect (Vercel > Deployments >
"..." > Redeploy, or just push a commit). Reload the frontend and confirm
login works - this is the step where a same-origin dev setup and a split
Vercel deployment actually diverge, so it's the one most likely to need a
second look if something's wrong (browser console will show a CORS error by
name if this is misconfigured).

## Scheduled alerts

Self-hosted TaxVault runs Celery beat on a fixed schedule
(`app/tasks/celery_app.py`): a daily alert scan at 08:00 IST and an overdue
check at 09:00 IST, each queuing individual sends onto Celery, consumed by a
separate worker process.

Vercel has neither beat nor a worker. `backend/vercel.json` defines two Cron
Jobs instead, hitting `/api/v1/cron/daily-scan` and `/api/v1/cron/overdue-check`
at `30 2 * * *` and `30 3 * * *` UTC (the same 08:00/09:00 IST, cron schedules
on Vercel are UTC). Those routes run the identical scan logic
(`app/tasks/scheduler.py`) but call the delivery function directly and await
it, instead of handing it to a queue - see `app/api/v1/cron.py`. One bad send
(e.g. a Twilio outage) is caught and logged per-alert rather than aborting the
rest of that run, which is the one behavioral difference from the Celery
path's per-task retry.

These routes are guarded by `CRON_SECRET`: Vercel automatically attaches
`Authorization: Bearer <CRON_SECRET>` to its own cron-triggered requests once
that env var is set on the project, and the routes reject anything else (401)
or refuse to run at all if `CRON_SECRET` is blank (503) - which is also why
self-hosted deployments, which leave it blank, never expose these routes to
accidental use.

Vercel's free Hobby plan allows cron jobs to run **at most once a day each**;
both of these already are.

## What's different from self-hosting

- **No same-origin nginx.** CORS is load-bearing now (Step 4), and
  `VITE_API_BASE_URL` must be absolute (Step 3) - both are no-ops in the
  Docker setup, where nginx makes the whole question moot.
- **No Celery worker/beat.** Covered above.
- **No local-disk document fallback.** R2 is mandatory, not optional.
- **Cold starts.** The first request after a period of inactivity pays for a
  fresh Python process + a fresh DB connection pool. Keeping `DB_POOL_SIZE`
  low (see Step 1) limits how much that costs the connection pooler; it
  doesn't remove the latency itself.
- **`KMS_PROVIDER=vault_transit`** needs a reachable HashiCorp Vault server -
  nothing about that changes on Vercel, but "reachable from Vercel's network"
  is worth confirming if you use it. `KMS_PROVIDER=pkcs11` isn't available at
  all yet (blocked at startup validation regardless of host - see
  `Settings.validate_encryption_fails_closed`), so that's not Vercel-specific.
- **Function size.** Vercel's Python runtime caps a function's unzipped size;
  `backend/.vercelignore` excludes `tests/`, `migrations/`, `scripts/` and
  dev-only files to stay well under it. If you ever add a heavy dependency
  and hit the limit, `firebase-admin` (push notifications, optional - the
  factory in `app/notifications/factory.py` already no-ops cleanly if
  unconfigured) is the first thing worth dropping.

## Redeploying

Both projects redeploy on push to their connected branch, same as any other
Vercel project - the two are independent, so a backend-only change doesn't
rebuild the frontend and vice versa. A schema migration still needs the
manual `alembic upgrade head` step (Step 2) run separately; nothing about
Vercel changes that.
