from enum import Enum


class AssetType(str, Enum):
    land = "land"  # legacy - split into agricultural_land / non_agricultural_land
    agricultural_land = "agricultural_land"
    vacant_land = "vacant_land"  # legacy - renamed to non_agricultural_land
    non_agricultural_land = "non_agricultural_land"
    vehicle = "vehicle"
    building = "building"  # legacy - split into residential/commercial building
    residential_building = "residential_building"
    commercial_building = "commercial_building"
    gold = "gold"
    other = "other"


# asset_category is derived from asset_type - immovable is real property,
# movable is everything else (vehicles, gold, misc).
IMMOVABLE_TYPES = frozenset(
    {
        AssetType.land.value,
        AssetType.agricultural_land.value,
        AssetType.vacant_land.value,
        AssetType.non_agricultural_land.value,
        AssetType.building.value,
        AssetType.residential_building.value,
        AssetType.commercial_building.value,
    }
)
MOVABLE_TYPES = frozenset(
    {AssetType.vehicle.value, AssetType.gold.value, AssetType.other.value}
)


def asset_category(asset_type: str) -> str:
    return "immovable" if asset_type in IMMOVABLE_TYPES else "movable"


class AssetStatus(str, Enum):
    active = "active"
    sold = "sold"
    transferred = "transferred"


class InsuranceType(str, Enum):
    medical = "medical"
    health = "health"
    life = "life"
    term = "term"
    vehicle = "vehicle"
    property = "property"
    other = "other"


class InsuranceStatus(str, Enum):
    active = "active"
    lapsed = "lapsed"
    matured = "matured"
    surrendered = "surrendered"


class PremiumFrequency(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    half_yearly = "half_yearly"
    annual = "annual"


class TaxType(str, Enum):
    land_tax = "land_tax"
    water_tax = "water_tax"
    property_tax = "property_tax"
    professional_tax = "professional_tax"
    income_tax = "income_tax"
    vehicle_tax = "vehicle_tax"
    gst = "gst"
    other = "other"


class ObligationStatus(str, Enum):
    pending = "pending"
    paid = "paid"
    overdue = "overdue"
    exempt = "exempt"


class RecurrenceRule(str, Enum):
    ANNUAL = "ANNUAL"
    QUARTERLY = "QUARTERLY"
    MONTHLY = "MONTHLY"


class BillType(str, Enum):
    """Built-in bill categories.

    Not used to validate writes - `bill_type` is a free-form slug so users can
    add their own categories (the column is a plain String). This enum documents
    the categories the UI ships with.
    """

    phone = "phone"
    electricity = "electricity"
    wifi = "wifi"
    dth = "dth"
    dubai = "dubai"
    other = "other"


class BillCycle(str, Enum):
    monthly = "monthly"
    bimonthly = "bimonthly"
    quarterly = "quarterly"
    annual = "annual"
    yearly = "yearly"


class PaymentMethod(str, Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"
    upi = "upi"
    card = "card"
    cheque = "cheque"


class EntityType(str, Enum):
    asset = "asset"
    insurance = "insurance"
    tax = "tax"
    bill = "bill"


class AlertChannel(str, Enum):
    whatsapp = "whatsapp"
    email = "email"
    sms = "sms"
    push = "push"


class DocumentCategory(str, Enum):
    # Property documents (canonical checklist for a property)
    patta = "patta"
    chitta = "chitta"
    adangal = "adangal"
    fmb_sketch = "fmb_sketch"
    parent_document = "parent_document"
    encumbrance = "encumbrance"  # Encumbrance Certificate (EC)
    a1_registration = "a1_registration"
    sale_deed = "sale_deed"
    fssai = "fssai"
    # Legacy property values (older rows / clients)
    deed = "deed"
    plan = "plan"
    # Vehicle documents (canonical checklist for a vehicle)
    rc = "rc"  # RC (Registration Certificate)
    hypothecation = "hypothecation"
    transfer_form = "transfer_form"
    # Gold documents (canonical checklist for a gold jewel)
    jewel_photo = "jewel_photo"
    purchase_bill = "purchase_bill"
    # Tax documents
    tax_receipt = "tax_receipt"
    tax_notice = "tax_notice"
    assessment = "assessment"
    # Insurance documents
    policy_doc = "policy_doc"
    premium_receipt = "premium_receipt"
    claim = "claim"
    # Bill documents
    bill_receipt = "bill_receipt"
    bill_copy = "bill_copy"
    # Compliance
    itr = "itr"
    gst_return = "gst_return"
    tds_cert = "tds_cert"
    # Other
    other = "other"

    # ── Legacy values (kept so existing rows and old clients still validate) ──
    income_tax = "income_tax"
    property = "property"
    gst = "gst"
    vehicle = "vehicle"
    insurance = "insurance"
    bills = "bills"


class AuditAction(str, Enum):
    create = "create"
    update = "update"
    delete = "delete"
