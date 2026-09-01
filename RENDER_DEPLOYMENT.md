# Deploying the TaxVault backend on Render

You've already deployed the frontend on Vercel. This covers the backend on
Render instead of Vercel - `render.yaml` at the repo root is a
[Blueprint](https://render.com/docs/blueprint-spec) that provisions all four
backend services in one go from the existing `backend/Dockerfile`, unmodified.

If you'd started down the Vercel-backend path from `VERCEL_DEPLOYMENT.md`
first: `backend/vercel.json`, `backend/api/index.py` and the
`/api/v1/cron/*` routes it added are simply unused here. Nothing to delete -
they're inert without a Vercel deployment invoking them, and `CRON_SECRET` can
stay blank.

## What you end up with

Four Render services, all built from the same Docker image:

- **`taxvault-api`** - the FastAPI app, a real web service (not a serverless
  function - persistent process, no cold-start-per-request, no 60-second
  execution cap).
- **`taxvault-celery-worker`** - runs `celery worker`, exactly as
  `docker-compose.prod.yml` already does. Real queue, real per-task retries -
  none of Vercel's inline-dispatch compromise.
- **`taxvault-daily-scan`** and **`taxvault-overdue-check`** - Render Cron
  Jobs, replacing `celery beat`. Each runs `celery -A app.tasks.celery_app
  call <task>` on schedule, which pushes the task onto the same queue the
  worker already consumes - not a copy of the task logic, the actual
  `app.tasks.scheduler.run_daily_scan` / `check_overdue` tasks, with Celery's
  own retry behavior intact. A cron job spins up, runs for a few seconds, and
  bills only for that - cheaper than paying for a `beat` process that's idle
  99.9% of the day.

External services, unchanged from what you already have: Supabase Postgres,
Cloudflare R2, and Redis (Upstash, or Render's own Key Value service if you'd
rather consolidate billing - either works, `REDIS_URL` doesn't care which).

## Step 1 - Create the Blueprint

Render dashboard: **New > Blueprint**, connect this repo. Render reads
`render.yaml` and shows all four services plus every environment variable
marked `sync: false` in `envVarGroups.taxvault-backend-env` - Render prompts
you to fill each one in during setup rather than storing real secrets in the
committed file.

Fill in:

| Variable | Where it comes from |
|---|---|
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Supabase pooler connection, port **6543** |
| `DIRECT_DATABASE_URL` | Supabase direct connection, port **5432** - not read at request time by any of these four services, only by `alembic upgrade head` in Step 2, but `Settings()` still requires it to construct |
| `REDIS_URL` | Upstash (or Render Key Value), `rediss://...` |
| `CORS_ORIGINS` | Your Vercel frontend's real URL, e.g. `https://taxvault-web.vercel.app` |
| `FRONTEND_URL` | Same URL - used in outgoing notification links |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 dashboard |
| `ENCRYPTION_MASTER_KEYS` | `python -c "import secrets,base64; print('1:'+base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"` - see the comment above this field in `app/core/config.py`. Required in production; never derive it from `SECRET_KEY` |
| `TWILIO_*` | For WhatsApp alerts, same as self-hosting |
| `AWS_*`, `EMAIL_FROM` | For email alerts, same as self-hosting |
| `SENTRY_DSN` | Optional |

All four services share these via the one `envVarGroups` entry - fill each in
once, not four times.

Click **Apply**. Render builds the Docker image once and starts all four
services from it.

## Step 2 - Run migrations

Same as the Vercel path - none of these four services runs `alembic upgrade
head` for you. From your own machine, against `DIRECT_DATABASE_URL`:

```
cd backend
alembic upgrade head
```

## Step 3 - Point the frontend at the new backend

The frontend is already live on Vercel, pointing at whatever
`VITE_API_BASE_URL` you set earlier. Update it to `taxvault-api`'s Render
URL (Render dashboard shows it once the web service is up, something like
`https://taxvault-api.onrender.com`), then in the **frontend** Vercel
project:

```
VITE_API_BASE_URL=https://taxvault-api.onrender.com/api/v1
```

Redeploy the frontend for the change to take effect (`VITE_*` vars are baked
in at build time). Reload the app and confirm login works - a CORS error in
the browser console at this point almost always means `CORS_ORIGINS` on the
backend doesn't exactly match the frontend's Vercel URL (scheme and host,
no trailing slash).

## Step 4 - Verify

```
curl https://taxvault-api.onrender.com/health
curl https://taxvault-api.onrender.com/health/ready   # checks DB + Redis
```

Check `taxvault-celery-worker`'s logs (Render dashboard > that service >
Logs) for `celery@... ready` on startup. The two cron jobs won't show
activity until their first scheduled run - you can trigger one manually from
its service page (**Manual Run**) to confirm end-to-end before waiting for
02:30/03:30 UTC.

## Notes

- **Cost**: four `starter`-plan services. Check Render's current pricing page
  for the real number - I'm not going to quote a figure here that's likely to
  be stale by the time you read this. If that's more than you want running
  24/7, the cheapest cut is dropping to Render's free plan for `taxvault-api`
  alone (accepting its cold-start-after-15-minutes-idle behavior) while
  keeping the worker and both cron jobs on `starter`, since Render's free
  tier doesn't support background workers.
- **Region**: set to `singapore` in `render.yaml`, Render's closest region to
  Supabase's `ap-south-1` (Mumbai) at the time of writing - if Render has
  since added a Mumbai region, switch to that for lower DB latency.
- **Docker port**: `backend/Dockerfile` already `EXPOSE`s 8000 and the
  container listens there - Render's Docker runtime detects this
  automatically, no `port:` field needed in `render.yaml`. If the web service
  deploys successfully but never receives traffic, check Render dashboard >
  `taxvault-api` > Settings that the detected port is 8000.
- **`docker-compose.prod.yml` still works** if you ever want to self-host
  instead - nothing here changes that file or `backend/Dockerfile`.
