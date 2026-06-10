# TaxVault — Folder & File Structure Creator (no content)
# Run from the directory where you want the project created.
# Usage: .\Create-TaxVault-Structure.ps1

$root = "taxvault"

# ── Directories ───────────────────────────────────────────────────────────────

$dirs = @(
    "$root/backend/app/api/v1",
    "$root/backend/app/core",
    "$root/backend/app/models",
    "$root/backend/app/schemas",
    "$root/backend/app/services",
    "$root/backend/app/notifications/channels",
    "$root/backend/app/tasks",
    "$root/backend/app/db",
    "$root/backend/migrations/versions",
    "$root/backend/tests",
    "$root/frontend/public",
    "$root/frontend/src/api",
    "$root/frontend/src/components/ui",
    "$root/frontend/src/pages",
    "$root/frontend/src/store",
    "$root/frontend/src/types",
    "$root/frontend/src/utils",
    "$root/.github/workflows",
    "$root/nginx"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

# ── Files ─────────────────────────────────────────────────────────────────────

$files = @(
    # backend — api
    "$root/backend/app/api/__init__.py",
    "$root/backend/app/api/v1/__init__.py",
    "$root/backend/app/api/v1/auth.py",
    "$root/backend/app/api/v1/obligations.py",
    "$root/backend/app/api/v1/payments.py",
    "$root/backend/app/api/v1/documents.py",
    "$root/backend/app/api/v1/alerts.py",
    "$root/backend/app/api/v1/users.py",
    "$root/backend/app/api/router.py",

    # backend — core
    "$root/backend/app/core/__init__.py",
    "$root/backend/app/core/config.py",
    "$root/backend/app/core/security.py",
    "$root/backend/app/core/dependencies.py",
    "$root/backend/app/core/logging.py",

    # backend — models
    "$root/backend/app/models/__init__.py",
    "$root/backend/app/models/user.py",
    "$root/backend/app/models/obligation.py",
    "$root/backend/app/models/payment.py",
    "$root/backend/app/models/document.py",
    "$root/backend/app/models/alert_config.py",
    "$root/backend/app/models/alert_log.py",

    # backend — schemas
    "$root/backend/app/schemas/__init__.py",
    "$root/backend/app/schemas/auth.py",
    "$root/backend/app/schemas/obligation.py",
    "$root/backend/app/schemas/payment.py",
    "$root/backend/app/schemas/document.py",
    "$root/backend/app/schemas/alert.py",

    # backend — services
    "$root/backend/app/services/__init__.py",
    "$root/backend/app/services/auth_service.py",
    "$root/backend/app/services/obligation_service.py",
    "$root/backend/app/services/document_service.py",
    "$root/backend/app/services/alert_service.py",

    # backend — notifications
    "$root/backend/app/notifications/__init__.py",
    "$root/backend/app/notifications/base.py",
    "$root/backend/app/notifications/service.py",
    "$root/backend/app/notifications/factory.py",
    "$root/backend/app/notifications/channels/__init__.py",
    "$root/backend/app/notifications/channels/email.py",
    "$root/backend/app/notifications/channels/sms.py",
    "$root/backend/app/notifications/channels/push.py",

    # backend — tasks
    "$root/backend/app/tasks/__init__.py",
    "$root/backend/app/tasks/celery_app.py",
    "$root/backend/app/tasks/scheduler.py",
    "$root/backend/app/tasks/dispatcher.py",

    # backend — db
    "$root/backend/app/db/__init__.py",
    "$root/backend/app/db/session.py",
    "$root/backend/app/db/base.py",

    # backend — app entry
    "$root/backend/app/main.py",

    # backend — migrations
    "$root/backend/migrations/env.py",
    "$root/backend/migrations/script.py.mako",

    # backend — tests
    "$root/backend/tests/__init__.py",
    "$root/backend/tests/conftest.py",
    "$root/backend/tests/test_auth.py",
    "$root/backend/tests/test_obligations.py",
    "$root/backend/tests/test_documents.py",
    "$root/backend/tests/test_alerts.py",

    # backend — root config files
    "$root/backend/alembic.ini",
    "$root/backend/requirements.txt",
    "$root/backend/Dockerfile",
    "$root/backend/.env.example",

    # frontend — public
    "$root/frontend/public/manifest.json",
    "$root/frontend/public/sw.js",

    # frontend — api
    "$root/frontend/src/api/client.ts",
    "$root/frontend/src/api/auth.ts",
    "$root/frontend/src/api/obligations.ts",
    "$root/frontend/src/api/payments.ts",
    "$root/frontend/src/api/documents.ts",
    "$root/frontend/src/api/alerts.ts",

    # frontend — components
    "$root/frontend/src/components/ObligationCard.tsx",
    "$root/frontend/src/components/DeadlineCalendar.tsx",
    "$root/frontend/src/components/DocumentUploader.tsx",
    "$root/frontend/src/components/DocumentGrid.tsx",
    "$root/frontend/src/components/AlertBadge.tsx",
    "$root/frontend/src/components/Navbar.tsx",

    # frontend — pages
    "$root/frontend/src/pages/Login.tsx",
    "$root/frontend/src/pages/Dashboard.tsx",
    "$root/frontend/src/pages/Obligations.tsx",
    "$root/frontend/src/pages/Payments.tsx",
    "$root/frontend/src/pages/Documents.tsx",
    "$root/frontend/src/pages/AlertSettings.tsx",
    "$root/frontend/src/pages/Profile.tsx",

    # frontend — store
    "$root/frontend/src/store/authStore.ts",
    "$root/frontend/src/store/uiStore.ts",

    # frontend — types & utils
    "$root/frontend/src/types/index.ts",
    "$root/frontend/src/utils/dates.ts",
    "$root/frontend/src/utils/formatters.ts",

    # frontend — app entry
    "$root/frontend/src/App.tsx",
    "$root/frontend/src/main.tsx",

    # frontend — config files
    "$root/frontend/index.html",
    "$root/frontend/vite.config.ts",
    "$root/frontend/tailwind.config.ts",
    "$root/frontend/tsconfig.json",
    "$root/frontend/package.json",

    # ci/cd, nginx, root
    "$root/.github/workflows/deploy.yml",
    "$root/nginx/taxvault.conf",
    "$root/docker-compose.yml",
    "$root/.gitignore",
    "$root/README.md"
)

foreach ($file in $files) {
    New-Item -ItemType File -Path $file -Force | Out-Null
}

$fileCount = (Get-ChildItem -Path $root -Recurse -File).Count
$dirCount  = (Get-ChildItem -Path $root -Recurse -Directory).Count

Write-Host ""
Write-Host "  Done!" -ForegroundColor Green
Write-Host "  Directories : $dirCount" -ForegroundColor White
Write-Host "  Files       : $fileCount" -ForegroundColor White
Write-Host ""