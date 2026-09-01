"""Vercel serverless entrypoint.

Vercel's Python runtime looks for an ASGI/WSGI callable named `app` in a file
under api/ and serves every request through it - this file exists only to
satisfy that convention. backend/vercel.json rewrites every incoming path here
(see its "rewrites" entry), so app.main's own routing - /api/v1/... and the
unprefixed /health, /health/ready - decides what happens next exactly as it
does under uvicorn/gunicorn in the Docker deployment.

Not used by the Docker image or docker-compose*.yml, which run
`gunicorn app.main:app` directly - this file only matters on Vercel.
"""

from app.main import app

__all__ = ["app"]
