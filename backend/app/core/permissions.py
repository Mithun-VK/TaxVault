"""Role-based access control matrix.

TaxVault has three roles, in descending order of power:

  ``super_admin``  The vault owner. Full CRUD and full visibility everywhere,
                   plus user management. Every deployment has at least one.

  ``admin``        Sees everything the super admin sees, and may *add* records
                   (properties, individuals, bills, taxes, insurance policies,
                   documents, gold categories, payments) - but may never edit
                   or delete anything, and cannot manage users or alert rules.

  ``user``         A payables-desk login. Sees only the payment calendar,
                   bills, taxes, insurance and payments; may add bills, taxes
                   and insurance policies and log payments. No properties,
                   individuals, company, reports or analytics.

                   Editing and deleting are not theirs to do directly: they
                   raise a change request instead, which an admin or super
                   admin approves before it touches the vault
                   (``*.request_change`` + ``change_requests.*``).

Permissions are plain ``resource.action`` strings so the frontend can mirror
this table verbatim (see ``frontend/src/utils/permissions.ts``). Keep the two
in sync - the backend is the enforcement point, the frontend only hides
controls the caller would be refused anyway.
"""

from typing import Final

ROLE_SUPER_ADMIN: Final = "super_admin"
ROLE_ADMIN: Final = "admin"
ROLE_USER: Final = "user"

ROLES: Final = (ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_USER)

# ── Permission constants ─────────────────────────────────────────────────────
# Properties (assets)
PROPERTIES_VIEW: Final = "properties.view"
PROPERTIES_CREATE: Final = "properties.create"
PROPERTIES_EDIT: Final = "properties.edit"
PROPERTIES_DELETE: Final = "properties.delete"

# Individuals (people)
INDIVIDUALS_VIEW: Final = "individuals.view"
INDIVIDUALS_CREATE: Final = "individuals.create"
INDIVIDUALS_EDIT: Final = "individuals.edit"
INDIVIDUALS_DELETE: Final = "individuals.delete"

# Recurring bills. `request_change` is the members' route to an edit or delete:
# it files a change request instead of touching the record (see
# services/change_request_service.py).
BILLS_VIEW: Final = "bills.view"
BILLS_CREATE: Final = "bills.create"
BILLS_EDIT: Final = "bills.edit"
BILLS_DELETE: Final = "bills.delete"
BILLS_REQUEST_CHANGE: Final = "bills.request_change"

# Tax obligations
TAXES_VIEW: Final = "taxes.view"
TAXES_CREATE: Final = "taxes.create"
TAXES_EDIT: Final = "taxes.edit"
TAXES_DELETE: Final = "taxes.delete"
TAXES_REQUEST_CHANGE: Final = "taxes.request_change"

# Insurance policies
INSURANCE_VIEW: Final = "insurance.view"
INSURANCE_CREATE: Final = "insurance.create"
INSURANCE_EDIT: Final = "insurance.edit"
INSURANCE_DELETE: Final = "insurance.delete"
INSURANCE_REQUEST_CHANGE: Final = "insurance.request_change"

# Change requests - the maker/checker queue. Everyone sees the queue (members
# only their own rows, enforced in the service); reviewing is admin and up.
CHANGE_REQUESTS_VIEW: Final = "change_requests.view"
CHANGE_REQUESTS_REVIEW: Final = "change_requests.review"

# Payments ledger. "create" is logging a payment against a payable.
PAYMENTS_VIEW: Final = "payments.view"
PAYMENTS_CREATE: Final = "payments.create"
PAYMENTS_EDIT: Final = "payments.edit"
PAYMENTS_DELETE: Final = "payments.delete"

# Document vault. Members get view+create so payment receipts and the
# payments ledger resolve; browsing/searching the whole library is separate.
DOCUMENTS_VIEW: Final = "documents.view"
DOCUMENTS_BROWSE: Final = "documents.browse"
DOCUMENTS_CREATE: Final = "documents.create"
DOCUMENTS_EDIT: Final = "documents.edit"
DOCUMENTS_DELETE: Final = "documents.delete"

# Custom gold categories
GOLD_CATEGORIES_VIEW: Final = "gold_categories.view"
GOLD_CATEGORIES_CREATE: Final = "gold_categories.create"
GOLD_CATEGORIES_EDIT: Final = "gold_categories.edit"
GOLD_CATEGORIES_DELETE: Final = "gold_categories.delete"

# Companies (business entities). `view` predates the module and was the whole
# of it while /company was a placeholder; the write half arrives with it.
COMPANY_VIEW: Final = "company.view"
COMPANY_CREATE: Final = "company.create"
COMPANY_EDIT: Final = "company.edit"
COMPANY_DELETE: Final = "company.delete"

# Read-only surfaces
CALENDAR_VIEW: Final = "calendar.view"
ANALYTICS_VIEW: Final = "analytics.view"
REPORTS_VIEW: Final = "reports.view"

# Alert rules and history
ALERTS_VIEW: Final = "alerts.view"
ALERTS_EDIT: Final = "alerts.edit"

# User administration
USERS_MANAGE: Final = "users.manage"

ALL_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        PROPERTIES_VIEW, PROPERTIES_CREATE, PROPERTIES_EDIT, PROPERTIES_DELETE,
        INDIVIDUALS_VIEW, INDIVIDUALS_CREATE, INDIVIDUALS_EDIT, INDIVIDUALS_DELETE,
        BILLS_VIEW, BILLS_CREATE, BILLS_EDIT, BILLS_DELETE, BILLS_REQUEST_CHANGE,
        TAXES_VIEW, TAXES_CREATE, TAXES_EDIT, TAXES_DELETE, TAXES_REQUEST_CHANGE,
        INSURANCE_VIEW, INSURANCE_CREATE, INSURANCE_EDIT, INSURANCE_DELETE,
        INSURANCE_REQUEST_CHANGE,
        PAYMENTS_VIEW, PAYMENTS_CREATE, PAYMENTS_EDIT, PAYMENTS_DELETE,
        DOCUMENTS_VIEW, DOCUMENTS_BROWSE, DOCUMENTS_CREATE,
        DOCUMENTS_EDIT, DOCUMENTS_DELETE,
        GOLD_CATEGORIES_VIEW, GOLD_CATEGORIES_CREATE,
        GOLD_CATEGORIES_EDIT, GOLD_CATEGORIES_DELETE,
        COMPANY_VIEW, COMPANY_CREATE, COMPANY_EDIT, COMPANY_DELETE,
        CALENDAR_VIEW, ANALYTICS_VIEW, REPORTS_VIEW,
        ALERTS_VIEW, ALERTS_EDIT,
        CHANGE_REQUESTS_VIEW, CHANGE_REQUESTS_REVIEW,
        USERS_MANAGE,
    }
)

# Admin = everything except mutation of existing records, alert rules and users.
# They cannot edit directly, but they are one of the two roles that can approve
# a member's change request.
_ADMIN_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        PROPERTIES_VIEW, PROPERTIES_CREATE,
        INDIVIDUALS_VIEW, INDIVIDUALS_CREATE,
        BILLS_VIEW, BILLS_CREATE,
        TAXES_VIEW, TAXES_CREATE,
        INSURANCE_VIEW, INSURANCE_CREATE,
        PAYMENTS_VIEW, PAYMENTS_CREATE,
        DOCUMENTS_VIEW, DOCUMENTS_BROWSE, DOCUMENTS_CREATE,
        GOLD_CATEGORIES_VIEW, GOLD_CATEGORIES_CREATE,
        COMPANY_VIEW, COMPANY_CREATE,
        CALENDAR_VIEW, ANALYTICS_VIEW, REPORTS_VIEW,
        ALERTS_VIEW,
        CHANGE_REQUESTS_VIEW, CHANGE_REQUESTS_REVIEW,
    }
)

# User = the payables desk. Adds bills, taxes and insurance outright; changes
# and deletions to those three go through the approval queue instead.
_USER_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        CALENDAR_VIEW,
        BILLS_VIEW, BILLS_CREATE, BILLS_REQUEST_CHANGE,
        TAXES_VIEW, TAXES_CREATE, TAXES_REQUEST_CHANGE,
        INSURANCE_VIEW, INSURANCE_CREATE, INSURANCE_REQUEST_CHANGE,
        PAYMENTS_VIEW, PAYMENTS_CREATE,
        DOCUMENTS_VIEW, DOCUMENTS_CREATE,
        CHANGE_REQUESTS_VIEW,
    }
)

ROLE_PERMISSIONS: Final[dict[str, frozenset[str]]] = {
    ROLE_SUPER_ADMIN: ALL_PERMISSIONS,
    ROLE_ADMIN: _ADMIN_PERMISSIONS,
    ROLE_USER: _USER_PERMISSIONS,
}


# Which permission lets a role file a change request against each entity type.
# Only the member role holds these: admins are the approvers, and a super admin
# simply makes the edit.
REQUEST_CHANGE_PERMISSION: Final[dict[str, str]] = {
    "bill": BILLS_REQUEST_CHANGE,
    "tax": TAXES_REQUEST_CHANGE,
    "insurance": INSURANCE_REQUEST_CHANGE,
}


def permissions_for(role: str | None) -> frozenset[str]:
    """Permissions granted to ``role``. Unknown roles get nothing."""
    return ROLE_PERMISSIONS.get(role or "", frozenset())


def has_permission(role: str | None, permission: str) -> bool:
    return permission in permissions_for(role)
