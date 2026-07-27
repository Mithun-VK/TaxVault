from fastapi import APIRouter

from app.api.v1 import (
    alerts,
    assets,
    auth,
    bills,
    dashboard,
    documents,
    gold_categories,
    individuals,
    insurance,
    payments,
    reports,
    taxes,
    users,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(assets.router)
api_router.include_router(gold_categories.router)
api_router.include_router(individuals.router)
api_router.include_router(insurance.router)
api_router.include_router(taxes.router)
api_router.include_router(bills.router)
api_router.include_router(payments.router)
api_router.include_router(documents.router)
api_router.include_router(alerts.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
