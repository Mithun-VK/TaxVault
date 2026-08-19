import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateError, NotFoundError
from app.models.asset import Asset
from app.models.company import Company
from app.models.company_document import FILING_CATEGORIES, CompanyDocument
from app.schemas.company import CompanyCreate, CompanyDocumentCreate, CompanyUpdate
from app.services import document_service

# Warn when a license / registration expires within this many days.
EXPIRY_WARNING_DAYS = 90


async def _get_or_404(db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID) -> Company:
    result = await db.execute(
        select(Company).where(
            Company.id == id,
            Company.user_id == user_id,
            Company.is_archived == False,  # noqa: E712
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundError("Company not found")
    return obj


def _parse_iso(value) -> date | None:
    """Coerce a stored JSON date (ISO string or date) to a date, or None."""
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _state_code_from(gstin: str | None) -> str | None:
    """The GST state code is the GSTIN's first two digits - derived, not typed."""
    if gstin and len(gstin) >= 2 and gstin[:2].isdigit():
        return gstin[:2]
    return None


def last_closed_financial_year(fy_end: str | None, today: date | None = None) -> str:
    """The most recent financial year whose books have closed, as "2025-26".

    Filing deadlines trail the year end by months, so "closed" here means the
    year that ended before the current one - a company is not delinquent for
    not yet having filed a return for a year that ended last week.
    """
    today = today or date.today()
    month, day = 3, 31
    if fy_end:
        try:
            month, day = (int(part) for part in fy_end.split("-", 1))
        except ValueError:
            month, day = 3, 31

    # The FY that is currently running started at the last year-end passed.
    current_start_year = today.year if (today.month, today.day) > (month, day) else today.year - 1
    # The last closed one is the year before that.
    start = current_start_year - 1
    return f"{start}-{str(start + 1)[-2:]}"


async def _counts(
    db: AsyncSession, company: Company
) -> tuple[int, int, int, bool]:
    """(document_count, asset_count, expiring_docs_count, has_compliance_gap)."""
    today = date.today()
    warn_date = today + timedelta(days=EXPIRY_WARNING_DAYS)

    doc_count = (
        await db.scalar(
            select(func.count(CompanyDocument.id)).where(
                CompanyDocument.company_id == company.id,
                CompanyDocument.is_deleted == False,  # noqa: E712
            )
        )
        or 0
    )

    asset_count = (
        await db.scalar(
            select(func.count(Asset.id)).where(
                Asset.company_id == company.id,
                Asset.is_archived == False,  # noqa: E712
            )
        )
        or 0
    )

    # Documents whose expiry falls inside the warning window - already-expired
    # rows count too, since they are the most urgent thing on the card.
    expiring_docs = (
        await db.scalar(
            select(func.count(CompanyDocument.id)).where(
                CompanyDocument.company_id == company.id,
                CompanyDocument.is_deleted == False,  # noqa: E712
                CompanyDocument.expiry_date.is_not(None),
                CompanyDocument.expiry_date <= warn_date,
            )
        )
        or 0
    )

    # Registrations kept as JSON rather than as documents expire too.
    for reg in company.other_registrations or []:
        exp = _parse_iso(reg.get("expiry_date") if isinstance(reg, dict) else None)
        if exp and exp <= warn_date:
            expiring_docs += 1
    if company.foreign_registration_expiry and company.foreign_registration_expiry <= warn_date:
        expiring_docs += 1

    # Compliance gap: nothing filed at all for the last closed financial year.
    # Dormant and closed entities are exempt - they have nothing to file.
    has_gap = False
    if company.status == "active":
        fy = last_closed_financial_year(company.financial_year_end)
        filed = (
            await db.scalar(
                select(func.count(CompanyDocument.id)).where(
                    CompanyDocument.company_id == company.id,
                    CompanyDocument.is_deleted == False,  # noqa: E712
                    CompanyDocument.financial_year == fy,
                    CompanyDocument.category.in_(FILING_CATEGORIES),
                )
            )
            or 0
        )
        has_gap = filed == 0

    return doc_count, asset_count, expiring_docs, has_gap


def _active_director_count(company: Company) -> int:
    return sum(
        1
        for d in (company.directors or [])
        if isinstance(d, dict) and d.get("is_active", True)
    )


def _enrich(
    company: Company,
    document_count: int,
    asset_count: int,
    expiring_docs_count: int,
    has_compliance_gap: bool,
) -> dict:
    """Row fields + a presigned logo URL + the computed card counters."""
    return {
        "id": company.id,
        "user_id": company.user_id,
        "legal_name": company.legal_name,
        "trade_name": company.trade_name,
        "company_type": company.company_type,
        "status": company.status,
        "industry": company.industry,
        "description": company.description,
        "incorporation_date": company.incorporation_date,
        "incorporation_state": company.incorporation_state,
        "cin": company.cin,
        "llpin": company.llpin,
        "pan_number": company.pan_number,
        "tan_number": company.tan_number,
        "gstin": company.gstin,
        "gstin_state_code": company.gstin_state_code,
        "income_tax_ward": company.income_tax_ward,
        "iec_code": company.iec_code,
        "exporter_type": company.exporter_type,
        "aepc_code": company.aepc_code,
        "textile_committee_code": company.textile_committee_code,
        "msme_number": company.msme_number,
        "esi_number": company.esi_number,
        "epf_number": company.epf_number,
        "professional_tax_number": company.professional_tax_number,
        "foreign_registration_number": company.foreign_registration_number,
        "foreign_jurisdiction": company.foreign_jurisdiction,
        "foreign_registration_date": company.foreign_registration_date,
        "foreign_registration_expiry": company.foreign_registration_expiry,
        "other_registrations": company.other_registrations or [],
        "registered_address": company.registered_address,
        "operational_address": company.operational_address,
        "phone_number": company.phone_number,
        "email": company.email,
        "website": company.website,
        "bank_accounts": company.bank_accounts or [],
        "directors": company.directors or [],
        "authorized_capital": company.authorized_capital,
        "paid_up_capital": company.paid_up_capital,
        "auditor_name": company.auditor_name,
        "auditor_firm_number": company.auditor_firm_number,
        "financial_year_end": company.financial_year_end,
        "logo_key": company.logo_key,
        "logo_url": document_service.presign_get_for_key(company.logo_key),
        "notes": company.notes,
        "is_archived": company.is_archived,
        "created_at": company.created_at,
        "document_count": document_count,
        "asset_count": asset_count,
        "expiring_docs_count": expiring_docs_count,
        "active_director_count": _active_director_count(company),
        "has_compliance_gap": has_compliance_gap,
    }


async def _enriched(db: AsyncSession, company: Company) -> dict:
    return _enrich(company, *await _counts(db, company))


# ── Companies ────────────────────────────────────────────────────────────────


async def list_companies(
    db: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> tuple[list[dict], int]:
    result = await db.execute(
        select(Company)
        .where(Company.user_id == user_id, Company.is_archived == False)  # noqa: E712
        .order_by(Company.legal_name)
        .offset(skip)
        .limit(limit)
    )
    companies = result.scalars().all()

    total = (
        await db.scalar(
            select(func.count(Company.id)).where(
                Company.user_id == user_id,
                Company.is_archived == False,  # noqa: E712
            )
        )
        or 0
    )

    return [await _enriched(db, c) for c in companies], total


async def get_company(db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID) -> dict:
    company = await _get_or_404(db, id, user_id)
    return await _enriched(db, company)


async def _assert_unique(
    db: AsyncSession,
    user_id: uuid.UUID,
    field: str,
    value: str | None,
    label: str,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """Guard the partial unique indexes on cin/gstin with a clean 409."""
    if not value:
        return
    column = getattr(Company, field)
    query = select(Company.id).where(
        Company.user_id == user_id,
        column == value,
        Company.is_archived == False,  # noqa: E712
    )
    if exclude_id:
        query = query.where(Company.id != exclude_id)
    if await db.scalar(query):
        raise DuplicateError(f"A company with {label} {value} already exists")


async def create_company(db: AsyncSession, user_id: uuid.UUID, data: CompanyCreate) -> dict:
    await _assert_unique(db, user_id, "cin", data.cin, "CIN")
    await _assert_unique(db, user_id, "gstin", data.gstin, "GSTIN")
    await _assert_unique(db, user_id, "iec_code", data.iec_code, "IEC")

    payload = data.model_dump(
        exclude={"other_registrations", "bank_accounts", "directors"}
    )
    company = Company(
        user_id=user_id,
        gstin_state_code=_state_code_from(data.gstin),
        other_registrations=[r.model_dump(mode="json") for r in data.other_registrations],
        bank_accounts=[b.model_dump(mode="json") for b in data.bank_accounts],
        directors=[d.model_dump(mode="json") for d in data.directors],
        **payload,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return await _enriched(db, company)


async def update_company(
    db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID, data: CompanyUpdate
) -> dict:
    company = await _get_or_404(db, id, user_id)
    # Python mode, so dates stay `date` objects for their Date columns; only the
    # JSONB lists below are re-dumped to JSON-safe primitives.
    update_data = data.model_dump(exclude_unset=True)

    if data.cin and data.cin != company.cin:
        await _assert_unique(db, user_id, "cin", data.cin, "CIN", exclude_id=id)
    if data.gstin and data.gstin != company.gstin:
        await _assert_unique(db, user_id, "gstin", data.gstin, "GSTIN", exclude_id=id)
    if data.iec_code and data.iec_code != company.iec_code:
        await _assert_unique(db, user_id, "iec_code", data.iec_code, "IEC", exclude_id=id)

    # The state code is derived, so it follows the GSTIN rather than the client.
    if "gstin" in update_data:
        update_data["gstin_state_code"] = _state_code_from(data.gstin)

    # These three columns are NOT NULL with a list default: an explicit null
    # would violate the constraint, so it's treated as "leave alone".
    for json_field in ("other_registrations", "bank_accounts", "directors"):
        if json_field not in update_data:
            continue
        value = update_data[json_field]
        if value is None:
            del update_data[json_field]
        else:
            update_data[json_field] = [
                item.model_dump(mode="json") if hasattr(item, "model_dump") else item
                for item in getattr(data, json_field)
            ]

    for key, value in update_data.items():
        setattr(company, key, value)

    await db.commit()
    await db.refresh(company)
    return await _enriched(db, company)


async def archive_company(db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID) -> dict:
    company = await _get_or_404(db, id, user_id)
    company.is_archived = True
    await db.commit()
    return {"message": f"{company.legal_name} archived successfully"}


async def get_company_assets(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> list[Asset]:
    await _get_or_404(db, company_id, user_id)
    result = await db.execute(
        select(Asset)
        .where(
            Asset.company_id == company_id,
            Asset.is_archived == False,  # noqa: E712
        )
        .order_by(Asset.asset_type, Asset.name)
    )
    return list(result.scalars().all())


async def link_asset_to_company(
    db: AsyncSession,
    asset_id: uuid.UUID,
    company_id: uuid.UUID | None,
    user_id: uuid.UUID,
) -> Asset:
    """Attach a property to a company, or detach it when company_id is None."""
    asset = await db.scalar(
        select(Asset).where(
            Asset.id == asset_id,
            Asset.user_id == user_id,
            Asset.is_archived == False,  # noqa: E712
        )
    )
    if not asset:
        raise NotFoundError("Asset not found")

    if company_id is not None:
        await _get_or_404(db, company_id, user_id)

    asset.company_id = company_id
    await db.commit()
    await db.refresh(asset)
    return asset


# ── Documents ────────────────────────────────────────────────────────────────


def _enrich_document(doc: CompanyDocument, today: date, warn_date: date) -> dict:
    return {
        "id": doc.id,
        "company_id": doc.company_id,
        "category": doc.category,
        "label": doc.label,
        "financial_year": doc.financial_year,
        "storage_key": doc.storage_key,
        "file_name": doc.file_name,
        "file_size_kb": doc.file_size_kb,
        "mime_type": doc.mime_type,
        "issue_date": doc.issue_date,
        "expiry_date": doc.expiry_date,
        "download_url": document_service.presign_get_for_key(doc.storage_key),
        "notes": doc.notes,
        "uploaded_at": doc.uploaded_at,
        "is_expiring": bool(
            doc.expiry_date and today <= doc.expiry_date <= warn_date
        ),
        "is_expired": bool(doc.expiry_date and doc.expiry_date < today),
    }


async def list_company_documents(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    category: str | None = None,
    financial_year: str | None = None,
) -> list[dict]:
    await _get_or_404(db, company_id, user_id)

    query = select(CompanyDocument).where(
        CompanyDocument.company_id == company_id,
        CompanyDocument.is_deleted == False,  # noqa: E712
    )
    if category:
        query = query.where(CompanyDocument.category == category)
    if financial_year:
        query = query.where(CompanyDocument.financial_year == financial_year)

    # Soonest expiry first so renewals surface at the top; undated documents
    # fall to the back, newest upload first.
    query = query.order_by(
        CompanyDocument.expiry_date.asc().nulls_last(),
        CompanyDocument.uploaded_at.desc(),
    )

    docs = (await db.execute(query)).scalars().all()
    today = date.today()
    warn_date = today + timedelta(days=EXPIRY_WARNING_DAYS)
    return [_enrich_document(d, today, warn_date) for d in docs]


async def add_company_document(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    data: CompanyDocumentCreate,
) -> dict:
    await _get_or_404(db, company_id, user_id)
    doc = CompanyDocument(company_id=company_id, user_id=user_id, **data.model_dump())
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    today = date.today()
    return _enrich_document(doc, today, today + timedelta(days=EXPIRY_WARNING_DAYS))


async def delete_company_document(
    db: AsyncSession, doc_id: uuid.UUID, company_id: uuid.UUID, user_id: uuid.UUID
) -> dict:
    await _get_or_404(db, company_id, user_id)
    doc = await db.scalar(
        select(CompanyDocument).where(
            CompanyDocument.id == doc_id,
            CompanyDocument.company_id == company_id,
            CompanyDocument.is_deleted == False,  # noqa: E712
        )
    )
    if not doc:
        raise NotFoundError("Document not found")

    doc.is_deleted = True
    await db.commit()
    return {"message": f"{doc.label} deleted successfully"}


async def get_document_upload_url(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    file_name: str,
    mime_type: str,
    category: str,
    file_size_kb: int | None = None,
) -> dict:
    await _get_or_404(db, company_id, user_id)
    document_service.validate_upload_request(mime_type, file_size_kb)

    storage_key = f"companies/{user_id}/{company_id}/{category}/{uuid.uuid4()}_{file_name}"
    upload_url = document_service.presign_put_for_key(storage_key, mime_type)
    return {"upload_url": upload_url, "storage_key": storage_key}
