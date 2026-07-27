"""Seed TaxVault with the real client (Inigo Irudayaraj) asset & payable data.

Idempotent: running it twice will not create duplicates. Every insert is wrapped
in a single transaction so a partial/failed run never corrupts the database.

Usage (run from backend/):
    python scripts/seed_client_data.py             # seed (idempotent)
    python scripts/seed_client_data.py --dry-run   # print plan, touch nothing
    python scripts/seed_client_data.py --reset      # delete the user + all data, then reseed

NOTE: change CLIENT email/password/phone below before running in production, and
do not commit this file to git after populating it with real client credentials.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import re
import sys
import traceback
from datetime import date
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv

# ── Bootstrap: load backend/.env and make `app` importable regardless of cwd ──
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import delete, select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.alert_config import AlertConfig  # noqa: E402
from app.models.alert_log import AlertLog  # noqa: E402
from app.models.asset import Asset  # noqa: E402
from app.models.audit_log import AuditLog  # noqa: E402
from app.models.document import Document  # noqa: E402
from app.models.insurance import InsurancePolicy  # noqa: E402
from app.models.payment import Payment  # noqa: E402
from app.models.recurring_bill import RecurringBill  # noqa: E402
from app.models.tax_obligation import TaxObligation  # noqa: E402
from app.models.user import User  # noqa: E402

TODAY = date.today()

# ════════════════════════════════════════════════════════════════════════════
# CLIENT — change these before a real handover.
# ════════════════════════════════════════════════════════════════════════════
CLIENT = {
    "full_name": "Inigo Irudayaraj",
    "email": "inigo@taxvault.in",          # CHANGE before production
    "password": "TaxVault@2026",            # CHANGE before handover
    "phone_number": "+919999999999",       # UPDATE with real number
}

# ════════════════════════════════════════════════════════════════════════════
# SECTION A — BUILDINGS
# ════════════════════════════════════════════════════════════════════════════
BUILDINGS = [
    {
        "name": "Neelangari House",
        "description": "Owned residential property at Neelankarai, Chennai",
        "asset_type": "building",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "address": "Neelankarai, Chennai",
            "patta_number": "4569",
            "deed_type": "Sale Deed",
            "deed_number": "4458/2010",
            "deed_date": "2010-08-27",
            "sro": "SRO, Neelankarai",
            "tneb_number": "294 018 105",
            "property_tax_id": "15 192 003226",
            "water_tax_id": "15 192 003226",
        },
    },
    {
        "name": "Trichy Karumandam House",
        "description": "Family property at Karumandam, Trichy",
        "asset_type": "building",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "address": "Karumandam, Trichy",
            "patta_numbers": ["534", "420"],
            "deed_type": "Family Release Deed",
            "deed_number": "7333/2010",
            "deed_date": "2010-11-01",
            "sro": "SRO, Joint-1, Trichy",
            "tneb_numbers": ["062 1300 54806", "062 1300 5942", "062 1300 5943"],
            "property_tax_ids": ["086/056/903516", "086/056/903517"],
            "water_tax_id": "086/056/901136",
        },
    },
    {
        "name": "Idaikattur Guest House",
        "description": "Guest house property at Idaikattur",
        "asset_type": "building",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "address": "Idaikattur",
            "patta_number": "3115",
            "deed_type": "Sale Deed",
            "deed_numbers": ["1726/2015", "275/2016"],
            "deed_dates": ["2015-09-23", "2016-02-19"],
            "sro": "SRO, Sivagangai",
            "tneb_numbers": ["05 428 007 557", "05 428 018 1020", "05 428 0231188"],
            "tax_ids": ["891", "892"],
        },
    },
    {
        "name": "St. Thomas Mount Property",
        "description": "Property at St. Thomas Mount, Chennai",
        "asset_type": "building",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "address": "St. Thomas Mount, Chennai",
            "deed_type": "Lease Deed + Sale Deed for Building",
            "deed_numbers": ["455/2010", "286/2010"],
            "deed_dates": ["2010-03-10", "2010-02-17"],
            "sro": "SRO, Joint-2, Saidapet",
            "tneb_numbers": ["092 420 74213", "092 420 74245"],
            "tax_id": "P01835/PSTMWD-2BLOCK-05000386",
            "lease_note": "Chingleput Diocese Property - Lease paid till May 2027",
        },
    },
]

# ════════════════════════════════════════════════════════════════════════════
# SECTION B — LAND PARCELS (25)
# ════════════════════════════════════════════════════════════════════════════
LAND_ASSETS = [
    {
        "name": "Fencing Thopu Land - Manaparai",
        "description": "Agricultural land, Family Partition",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Fencing Thopu, Manaparai",
            "patta_numbers": ["2189", "1899", "1957"],
            "deed_type": "Family Partition",
            "deed_number": "1611/2016",
            "deed_date": "2016-02-18",
            "sro": "SRO, Manaparai",
            "tax_paid_dates": ["2024-02-20", "2026-03-01"],
        },
    },
    {
        "name": "JR Layout Land - Kulathur",
        "description": "Land parcel, JR Layout",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "JR Layout, Kulathur",
            "deed_type": "Sale Deed",
            "deed_number": "2954/2008",
            "deed_date": "2008-06-27",
            "sro": "SRO, Kulathur",
        },
    },
    {
        "name": "Country Gift Land - Andhra (Nagari)",
        "description": "Land parcel in Andhra Pradesh",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Nagari, Andhra Pradesh",
            "deed_type": "Sale Deed",
            "deed_number": "1634/2008",
            "deed_date": "2008-06-27",
            "sro": "SRO, Nagari",
        },
    },
    {
        "name": "Alwin Villa - Tambaram",
        "description": "Land at Tambaram, Felci Rajam",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Felci Rajam",
            "location": "Alwin Villa, Tambaram",
            "patta_number": "14693",
            "deed_type": "Sale Deed",
            "deed_number": "4649/2016",
            "deed_date": "2016-09-02",
            "sro": "SRO, Padapai",
            "tneb_numbers": ["284 020 292", "284 020 293", "284 020 294", "284 020 295", "284 202 296"],
            "property_tax_id": "3443",
        },
    },
    {
        "name": "Sirugudi Village Land (Patta 1190)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1190",
            "deed_type": "Sale Deed",
            "deed_number": "3517/2018",
            "deed_date": "2018-10-26",
            "sro": "SRO, Sivagangai Joint II",
            "tax_paid_dates": ["2024-02-12", "2026-03-01"],
        },
    },
    {
        "name": "Sirugudi Village Land (Patta 1191)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1191",
            "deed_type": "Sale Deed",
            "deed_number": "3518/2018",
            "deed_date": "2018-10-26",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "Sirugudi Village Land (Patta 1199 - Deed 3519)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1199",
            "deed_type": "Sale Deed",
            "deed_number": "3519/2018",
            "deed_date": "2018-10-26",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "Sirugudi Village Land - Felci Rajam (Patta 1200)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Felci Rajam",
            "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1200",
            "deed_type": "Sale Deed",
            "deed_number": "3800/2018",
            "deed_date": "2018-10-26",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "Sirugudi Village Land (Patta 1199 - Deed 54/2019)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1199",
            "deed_type": "Sale Deed",
            "deed_number": "54/2019",
            "deed_date": "2019-01-07",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land (Patta 1587 - Deed 744/2019)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed",
            "deed_number": "744/2019",
            "deed_date": "2019-03-05",
            "sro": "SRO, Sivagangai (J2)",
            "tax_id": "749",
        },
    },
    {
        "name": "V.Pudukulam Land Periyakottai (Patta 1587 - Deed 743/2019)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "V.Pudukulam Periyakottai, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed",
            "deed_number": "743/2019",
            "deed_date": "2019-03-05",
            "sro": "SRO, Sivagangai",
            "tax_id": "749",
        },
    },
    {
        "name": "V.Pudukulam Land (Patta 1587 - Deed 745/2019)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed",
            "deed_number": "745/2019",
            "deed_date": "2019-03-05",
            "sro": "SRO, Sivagangai",
            "tax_id": "749",
        },
    },
    {
        "name": "V.Pudukulam Land - Allwyn Farms (Patta 1609 - Deed 2850/2019)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Allwyn Farms",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1609",
            "deed_type": "Sale Deed",
            "deed_number": "2850/2019",
            "deed_date": "2019-08-28",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land - Allwyn Farms (Patta 1609 - Deed 2853/2019)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Allwyn Farms",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1609",
            "deed_type": "Sale Deed",
            "deed_number": "2853/2019",
            "deed_date": "2019-08-28",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land - Allwyn Farms (Patta 1222)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Allwyn Farms",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1222",
            "deed_type": "Sale Deed",
            "deed_number": "2851/2019",
            "deed_date": "2019-08-28",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land (Patta 1587 - Deed 2854/2019)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed",
            "deed_number": "2854/2019",
            "deed_date": "2019-08-28",
            "sro": "SRO, Sivagangai",
            "tax_id": "749",
        },
    },
    {
        "name": "Sirugudi Village Land (Deed 2730/2020)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1199",
            "deed_type": "Sale Deed",
            "deed_number": "2730/2020",
            "deed_date": "2020-09-28",
            "sro": "SRO, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land (Old Patta 1915 - Deed 961/2025)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1915 (old)",
            "deed_type": "Sale Deed",
            "deed_number": "961/2025",
            "deed_date": "2025-02-24",
            "sro": "SRO, Joint-2, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land (Old Patta 1905 - Deed 962/2025)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1905 (old)",
            "deed_type": "Sale Deed",
            "deed_number": "962/2025",
            "deed_date": "2025-02-24",
            "sro": "SRO, Joint-2, Sivagangai",
        },
    },
    {
        "name": "Sirugudi Chettikulam Land (Patta 1357 - Deed 3938/2025)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village (Chettikulam), Sivagangai",
            "patta_number": "1357",
            "deed_type": "Sale Deed",
            "deed_number": "3938/2025",
            "deed_date": "2025-08-14",
            "sro": "SRO, Joint-2, Sivagangai",
        },
    },
    {
        "name": "Sirugudi Chettikulam Land (Patta 1357 - Deed 3939/2025)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village (Chettikulam), Sivagangai",
            "patta_number": "1357",
            "deed_type": "Sale Deed",
            "deed_number": "3939/2025",
            "deed_date": "2025-08-14",
            "sro": "SRO, Joint-2, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land - Jesurajan (Patta 1724)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Jesurajan",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1724",
            "deed_type": "Sale Deed",
            "deed_number": "2084/2021",
            "deed_date": "2021-07-13",
            "sro": "SRO, Joint-2, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land - Jesurajan (Old Patta 782)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Jesurajan",
            "location": "V.Pudukulam, Sivagangai",
            "patta_number": "782 (old)",
            "deed_type": "Sale Deed",
            "deed_number": "2627/2022",
            "deed_date": "2022-06-30",
            "sro": "SRO, Joint-2, Sivagangai",
        },
    },
    {
        "name": "V.Pudukulam Land - Jesurajan (Patta 1746/1809/1914)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Jesurajan",
            "location": "V.Pudukulam, Sivagangai",
            "patta_numbers": ["1746", "1809", "1914"],
            "deed_type": "Sale Deed",
            "deed_number": "3331/2021",
            "deed_date": "2021-09-30",
            "sro": "SRO, Joint-2, Sivagangai",
        },
    },
    {
        "name": "Sirugudi Village Land - Jesurajan (Patta 3116)",
        "asset_type": "land",
        "status": "active",
        "metadata": {
            "owner_name": "Jesurajan",
            "location": "Sirugudi Village, Sivagangai",
            "patta_number": "3116",
            "deed_type": "Sale Deed",
            "deed_number": "533/2019",
            "deed_date": "2019-03-15",
            "sro": "SRO, Joint-1, Sivagangai",
            "tax_id": "483",
        },
    },
]

# ════════════════════════════════════════════════════════════════════════════
# SECTION C — TAX OBLIGATIONS
# ════════════════════════════════════════════════════════════════════════════
TAX_OBLIGATIONS = [
    {
        "asset_name": "Neelangari House",
        "tax_type": "property_tax",
        "description": "Neelangari House Property Tax - ID: 15 192 003226",
        "jurisdiction": "Neelankarai, Chennai",
        "tax_id": "15 192 003226",
        "recurrence": "BIANNUAL",
        "next_due": "2026-11-30",
        "last_paid": "2025-11-27",
    },
    {
        "asset_name": "Neelangari House",
        "tax_type": "water_tax",
        "description": "Neelangari House Water Tax - ID: 15 192 003226",
        "jurisdiction": "Neelankarai, Chennai",
        "tax_id": "15 192 003226",
        "recurrence": "BIANNUAL",
        "next_due": "2026-11-30",
        "last_paid": "2025-11-27",
    },
    {
        "asset_name": "Trichy Karumandam House",
        "tax_type": "property_tax",
        "description": "Trichy Karumandam Property Tax 1 - ID: 086/056/903516",
        "jurisdiction": "Trichy",
        "tax_id": "086/056/903516",
        "recurrence": "ANNUAL",
        "next_due": "2026-11-14",
        "last_paid": "2025-04-29",
    },
    {
        "asset_name": "Trichy Karumandam House",
        "tax_type": "property_tax",
        "description": "Trichy Karumandam Property Tax 2 - ID: 086/056/903517",
        "jurisdiction": "Trichy",
        "tax_id": "086/056/903517",
        "recurrence": "ANNUAL",
        "next_due": "2026-11-14",
        "last_paid": "2025-04-29",
    },
    {
        "asset_name": "Trichy Karumandam House",
        "tax_type": "water_tax",
        "description": "Trichy Karumandam Water Tax 1 - ID: 086/056/901136",
        "jurisdiction": "Trichy",
        "tax_id": "086/056/901136",
        "recurrence": "ANNUAL",
        "next_due": "2026-11-14",
        "last_paid": "2025-05-08",
    },
    {
        "asset_name": "Trichy Karumandam House",
        "tax_type": "water_tax",
        "description": "Trichy Karumandam Water Tax 2 - ID: 086/056/901136",
        "jurisdiction": "Trichy",
        "tax_id": "086/056/901136-2",
        "recurrence": "ANNUAL",
        "next_due": "2026-11-14",
        "last_paid": "2025-04-29",
    },
    {
        "asset_name": "Idaikattur Guest House",
        "tax_type": "property_tax",
        "description": "Idaikattur Guest House Tax - ID: 891",
        "jurisdiction": "Idaikattur, Sivagangai",
        "tax_id": "891",
        "recurrence": "BIANNUAL",
        "next_due": "2026-09-20",
        "last_paid": "2025-09-01",
    },
    {
        "asset_name": "Idaikattur Guest House",
        "tax_type": "property_tax",
        "description": "Idaikattur Guest House Tax - ID: 892",
        "jurisdiction": "Idaikattur, Sivagangai",
        "tax_id": "892",
        "recurrence": "BIANNUAL",
        "next_due": "2026-09-20",
        "last_paid": "2025-09-01",
    },
    {
        "asset_name": "St. Thomas Mount Property",
        "tax_type": "other",
        "description": "PSTMWD Water Tax - ID: P01835/PSTMWD-2BLOCK-05000386",
        "jurisdiction": "St. Thomas Mount, Chennai",
        "tax_id": "P01835/PSTMWD-2BLOCK-05000386",
        "recurrence": "ANNUAL",
        "next_due": "2026-05-30",
        "last_paid": "2024-05-15",
    },
    {
        "asset_name": None,
        "tax_type": "property_tax",
        "description": "Mudichur House Property Tax - 1st Half",
        "jurisdiction": "Mudichur",
        "recurrence": "BIANNUAL",
        "next_due": "2026-09-18",
    },
    {
        "asset_name": None,
        "tax_type": "land_tax",
        "description": "Sirugudi Land Tax - Inigo Irudayaraj Properties",
        "jurisdiction": "Sirugudi Village, Sivagangai",
        "recurrence": "ANNUAL",
        "next_due": "2027-03-18",
        "last_paid": "2026-03-01",
    },
    {
        "asset_name": None,
        "tax_type": "land_tax",
        "description": "Sirugudi Land Tax - Felci Rajam Properties",
        "jurisdiction": "Sirugudi Village, Sivagangai",
        "recurrence": "ANNUAL",
        "next_due": "2027-03-18",
        "last_paid": "2026-03-01",
    },
    {
        "asset_name": None,
        "tax_type": "land_tax",
        "description": "Sirugudi Land Tax - Jesurajan Properties",
        "jurisdiction": "Sirugudi Village, Sivagangai",
        "recurrence": "ANNUAL",
        "next_due": "2027-03-18",
        "last_paid": "2025-09-01",
    },
    {
        "asset_name": "V.Pudukulam Land (Patta 1587 - Deed 744/2019)",
        "tax_type": "land_tax",
        "description": "V.Pudukulam Land Tax - Tax ID: 749 (Inigo Sir Properties)",
        "jurisdiction": "V.Pudukulam, Sivagangai",
        "tax_id": "749",
        "recurrence": "ANNUAL",
        "next_due": "2027-03-18",
        "last_paid": "2025-09-01",
    },
    {
        "asset_name": None,
        "tax_type": "land_tax",
        "description": "V.Pudukulam Land Tax - Allwyn Farms Properties",
        "jurisdiction": "V.Pudukulam, Sivagangai",
        "recurrence": "ANNUAL",
        "next_due": "2027-03-18",
        "last_paid": "2026-03-01",
    },
    {
        "asset_name": None,
        "tax_type": "land_tax",
        "description": "V.Pudukulam Land Tax - Jesurajan Properties",
        "jurisdiction": "V.Pudukulam, Sivagangai",
        "recurrence": "ANNUAL",
        "next_due": "2027-03-18",
        "last_paid": "2026-03-01",
    },
    {
        "asset_name": "Fencing Thopu Land - Manaparai",
        "tax_type": "land_tax",
        "description": "Fencing Thopu Land Tax - Manaparai",
        "jurisdiction": "Manaparai",
        "recurrence": "ANNUAL",
        "next_due": "2027-03-20",
        "last_paid": "2026-03-01",
    },
    {
        "asset_name": "Alwin Villa - Tambaram",
        "tax_type": "property_tax",
        "description": "Alwin Villa Property Tax - ID: 3443",
        "jurisdiction": "Tambaram, Chennai",
        "tax_id": "3443",
        "recurrence": "BIANNUAL",
        "next_due": "2026-09-01",
        "last_paid": "2025-09-01",
    },
    {
        "asset_name": "Sirugudi Village Land - Jesurajan (Patta 3116)",
        "tax_type": "land_tax",
        "description": "Sirugudi Jesurajan Land Tax - ID: 483",
        "jurisdiction": "Sirugudi Village, Sivagangai",
        "tax_id": "483",
        "recurrence": "ANNUAL",
        "next_due": "2026-09-01",
        "last_paid": "2025-09-01",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "TDS Payable (Monthly 7th)",
        "jurisdiction": "India",
        "recurrence": "MONTHLY",
        "next_due": "2026-07-07",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "GST Return 1 Filing (Monthly 11th)",
        "jurisdiction": "India",
        "recurrence": "MONTHLY",
        "next_due": "2026-07-11",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "EPF Return Filing (Monthly 14th)",
        "jurisdiction": "India",
        "recurrence": "MONTHLY",
        "next_due": "2026-07-14",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "ESI Return Filing (Monthly 14th)",
        "jurisdiction": "India",
        "recurrence": "MONTHLY",
        "next_due": "2026-07-14",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "EPF Online Payable (Monthly 15th)",
        "jurisdiction": "India",
        "recurrence": "MONTHLY",
        "next_due": "2026-07-15",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "ESI Online Payable (Monthly 15th)",
        "jurisdiction": "India",
        "recurrence": "MONTHLY",
        "next_due": "2026-07-15",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "TDS Quarterly Return Filing",
        "jurisdiction": "India",
        "recurrence": "QUARTERLY",
        "next_due": "2026-07-30",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "GST Return 3B Filing (June 20)",
        "jurisdiction": "India",
        "recurrence": "ANNUAL",
        "next_due": "2027-06-20",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "Company Income Tax Filing (Sep 30)",
        "jurisdiction": "India",
        "recurrence": "ANNUAL",
        "next_due": "2026-09-30",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "Partnership Firm Income Tax Filing (Jun 30)",
        "jurisdiction": "India",
        "recurrence": "ANNUAL",
        "next_due": "2027-06-30",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "ROC Return Filing (Oct 12)",
        "jurisdiction": "India",
        "recurrence": "ANNUAL",
        "next_due": "2026-10-12",
    },
    {
        "asset_name": None,
        "tax_type": "other",
        "description": "DPT-3 Return Filing (Jun 5)",
        "jurisdiction": "India",
        "recurrence": "ANNUAL",
        "next_due": "2027-06-05",
    },
]

# ════════════════════════════════════════════════════════════════════════════
# SECTION D — RECURRING BILLS
# ════════════════════════════════════════════════════════════════════════════
RECURRING_BILLS = [
    {"bill_type": "phone", "provider_name": "Vodafone", "description": "Vodafone Monthly Payable", "billing_cycle": "monthly", "next_due": "2026-07-04", "is_active": True},
    {"bill_type": "other", "provider_name": "Dubai Property", "description": "Dubai Rent Amount (Monthly 4th)", "billing_cycle": "monthly", "next_due": "2026-07-04", "is_active": True},
    {"bill_type": "other", "provider_name": "Dubai Office", "description": "Dubai MD Salary (Monthly 5th)", "billing_cycle": "monthly", "next_due": "2026-07-05", "is_active": True},
    {"bill_type": "phone", "provider_name": "Dubai Mobile", "description": "Dubai Mobile Bill (Monthly 5th)", "billing_cycle": "monthly", "next_due": "2026-07-05", "is_active": True},
    {"bill_type": "other", "provider_name": "Axis Bank", "description": "Axis Bank Loan EMI (Monthly 5th)", "billing_cycle": "monthly", "next_due": "2026-07-05", "is_active": True},
    {"bill_type": "wifi", "provider_name": "Hathway", "description": "Hathway Broadband Payable (Monthly 5th)", "billing_cycle": "monthly", "next_due": "2026-07-05", "is_active": True},
    {"bill_type": "other", "provider_name": "ICICI Bank", "description": "ICICI Bank Credit Card (Monthly 10th)", "billing_cycle": "monthly", "next_due": "2026-07-10", "is_active": True},
    {"bill_type": "other", "provider_name": "Innova Car Finance", "description": "Innova Car Loan EMI (Monthly 10th, from April)", "billing_cycle": "monthly", "next_due": "2026-07-10", "is_active": True},
    {"bill_type": "other", "provider_name": "Axis Bank", "description": "Axis Credit Card (Monthly 12th)", "billing_cycle": "monthly", "next_due": "2026-07-12", "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB", "description": "EB - Fashion Profiles (Due 15th, bimonthly Jan/Mar/May/Jul/Sep/Nov)", "billing_cycle": "bimonthly", "next_due": "2026-07-15", "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB", "description": "EB - Guest House (Due 15th, bimonthly)", "billing_cycle": "bimonthly", "next_due": "2026-07-15", "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB", "description": "EB - Idaikattur Guest House (Due 18th, June)", "billing_cycle": "monthly", "next_due": "2026-07-18", "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB", "description": "EB - Trichy House (Due 18th, Jul/Sep/Nov)", "billing_cycle": "bimonthly", "next_due": "2026-07-18", "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB", "description": "EB - Godown (Due 19th, bimonthly)", "billing_cycle": "bimonthly", "next_due": "2026-07-19", "is_active": True},
    {"bill_type": "phone", "provider_name": "Airtel", "description": "Airtel Mobile Bill Payable (Monthly 30th, from July)", "billing_cycle": "monthly", "next_due": "2026-07-30", "is_active": True},
    {"bill_type": "phone", "provider_name": "BSNL", "description": "BSNL Landline (July 19)", "billing_cycle": "monthly", "next_due": "2026-07-19", "is_active": True},
    {"bill_type": "other", "provider_name": "Zoho", "description": "Zoho Subscription (November 1)", "billing_cycle": "annual", "next_due": "2026-11-01", "is_active": True},
    {"bill_type": "other", "provider_name": "Textiles Committee", "description": "Textiles Committee Renewal (June 6)", "billing_cycle": "annual", "next_due": "2027-06-06", "is_active": True},
    {"bill_type": "other", "provider_name": "Textiles Committee Causeway Bay", "description": "Textiles Committee - Causeway Bay Renewal (July 23)", "billing_cycle": "annual", "next_due": "2027-07-23", "is_active": True},
    {"bill_type": "other", "provider_name": "FSSAI", "description": "FSSAI License Renewal (November 24)", "billing_cycle": "annual", "next_due": "2026-11-24", "is_active": True},
    {"bill_type": "other", "provider_name": "Spice Board", "description": "Spice Board Renewal (November 25)", "billing_cycle": "annual", "next_due": "2026-11-25", "is_active": True},
    {"bill_type": "other", "provider_name": "AEPC", "description": "AEPC Renewal - Fashion Profiles (May 31)", "billing_cycle": "annual", "next_due": "2027-05-31", "is_active": True},
    {"bill_type": "other", "provider_name": "AEPC", "description": "AEPC Renewal - Causeway Bay (June 30)", "billing_cycle": "annual", "next_due": "2027-06-30", "is_active": True},
    {"bill_type": "other", "provider_name": "Import Export Code", "description": "Import Export Code Renewal (June 30)", "billing_cycle": "annual", "next_due": "2027-06-30", "is_active": True},
    {"bill_type": "other", "provider_name": "CNI", "description": "CNI Domain Renewal (June 16)", "billing_cycle": "annual", "next_due": "2027-06-16", "is_active": True},
    {"bill_type": "other", "provider_name": "All Domains", "description": "Domain Renewal - All (August 16)", "billing_cycle": "annual", "next_due": "2026-08-16", "is_active": True},
    {"bill_type": "other", "provider_name": "Dubai Domain", "description": "Dubai Domain Renewal (September 13)", "billing_cycle": "annual", "next_due": "2026-09-13", "is_active": True},
    {"bill_type": "other", "provider_name": "JAFZA", "description": "JAFZA Trading License Renewal (September 5)", "billing_cycle": "annual", "next_due": "2026-09-05", "is_active": True},
    {"bill_type": "other", "provider_name": "CNI", "description": "CNI 12A Registration Renewal (September 18)", "billing_cycle": "annual", "next_due": "2026-09-18", "is_active": True},
    {"bill_type": "other", "provider_name": "Emirates", "description": "Emirates Card Renewal (September 13)", "billing_cycle": "annual", "next_due": "2026-09-13", "is_active": True},
]

# ════════════════════════════════════════════════════════════════════════════
# SECTION E — INSURANCE POLICIES
# ════════════════════════════════════════════════════════════════════════════
INSURANCE_POLICIES = [
    {"provider_name": "United India Insurance", "insurance_type": "medical", "description": "Mediclaim Policy - Inigo Irudayaraj (United India)", "policy_holder": "Inigo Irudayaraj", "premium_frequency": "annual", "next_premium_date": "2026-04-11", "status": "active"},
    {"provider_name": "Insurance Company", "insurance_type": "medical", "description": "Jesu Rajan Medical Policy", "policy_holder": "Jesurajan", "premium_frequency": "annual", "next_premium_date": "2027-07-03", "last_paid": "2026-07-03", "status": "active"},
    {"provider_name": "LIC", "insurance_type": "life", "description": "LIC Policy - Felci Rajam", "policy_holder": "Felci Rajam", "premium_frequency": "quarterly", "due_months": [2, 7, 9], "due_day": 28, "next_premium_date": "2026-07-28", "last_paid": "2026-03-28", "status": "active"},
    {"provider_name": "LIC", "insurance_type": "life", "description": "LIC Policy - Allwyn Tony", "policy_holder": "Allwyn Tony", "premium_frequency": "annual", "next_premium_date": "2026-11-28", "status": "active"},
    {"provider_name": "Insurance Company", "insurance_type": "vehicle", "description": "Fortuner Car Insurance Renewal (December 9)", "policy_holder": "Inigo Irudayaraj", "premium_frequency": "annual", "next_premium_date": "2026-12-09", "status": "active"},
    {"provider_name": "Insurance Company", "insurance_type": "vehicle", "description": "Innova Car Insurance Renewal (February 10)", "policy_holder": "Inigo Irudayaraj", "premium_frequency": "annual", "next_premium_date": "2027-02-10", "last_paid": "2026-02-10", "status": "active"},
    {"provider_name": "Insurance Company", "insurance_type": "vehicle", "description": "Trichy Fortuner Car Insurance (April 10)", "policy_holder": "Inigo Irudayaraj", "premium_frequency": "annual", "next_premium_date": "2027-04-10", "last_paid": "2026-04-10", "status": "active"},
    {"provider_name": "Insurance Company", "insurance_type": "vehicle", "description": "Innova Car (Allwyn) Insurance - valid till 2028 (June 12)", "policy_holder": "Allwyn Farms", "premium_frequency": "annual", "next_premium_date": "2028-06-12", "status": "active", "notes": "Renewed till 2028"},
    {"provider_name": "Insurance Company", "insurance_type": "vehicle", "description": "Ciaz Car Insurance (June 26)", "policy_holder": "Inigo Irudayaraj", "premium_frequency": "annual", "next_premium_date": "2027-06-26", "last_paid": "2026-06-26", "status": "active"},
    {"provider_name": "Insurance Company", "insurance_type": "other", "description": "Tractor Insurance Renewal (November 26)", "policy_holder": "Inigo Irudayaraj", "premium_frequency": "annual", "next_premium_date": "2026-11-26", "status": "active"},
]


# ════════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════════
class Counter:
    """Tracks created/skipped per category plus alert-config creations."""

    def __init__(self) -> None:
        self.buildings = [0, 0]
        self.land = [0, 0]
        self.taxes = [0, 0]
        self.bills = [0, 0]
        self.insurance = [0, 0]
        self.alerts = 0


def _parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def _policy_number_for(description: str) -> str:
    """Deterministic synthetic policy number (real numbers were not supplied)."""
    digest = hashlib.md5(description.encode("utf-8")).hexdigest()[:8].upper()
    return f"SEED-{digest}"


def _insurance_notes(policy: dict) -> str:
    """Fold description + holder + payment history into the notes column
    (the model has no dedicated description / policy_holder field)."""
    parts = [policy["description"], f"Policy holder: {policy['policy_holder']}"]
    if policy.get("last_paid"):
        parts.append(f"Last paid: {policy['last_paid']}")
    if policy.get("due_months"):
        days = ", ".join(str(m) for m in policy["due_months"])
        parts.append(f"Due months: {days} (day {policy.get('due_day', '?')})")
    if policy.get("notes"):
        parts.append(policy["notes"])
    return " | ".join(parts)


async def ensure_alert_config(
    session, user_id, entity_type: str, entity_id, days_before: list[int], counter: Counter
) -> None:
    """Create an AlertConfig for a payable if one does not already exist."""
    existing = (
        await session.execute(
            select(AlertConfig.id).where(
                AlertConfig.user_id == user_id,
                AlertConfig.entity_type == entity_type,
                AlertConfig.entity_id == entity_id,
            )
        )
    ).first()
    if existing:
        return
    session.add(
        AlertConfig(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            days_before=days_before,
            channels=["email", "push"],
            is_active=True,
        )
    )
    counter.alerts += 1


# ════════════════════════════════════════════════════════════════════════════
# Reset
# ════════════════════════════════════════════════════════════════════════════
async def reset_client(session) -> None:
    user = (
        await session.execute(select(User).where(User.email == CLIENT["email"]))
    ).scalar_one_or_none()
    if not user:
        print(f"  RESET: no existing user {CLIENT['email']} — nothing to delete")
        return
    uid = user.id
    # FK-safe order: children referencing assets/users first, user last.
    for model in (
        AlertLog,
        AuditLog,
        AlertConfig,
        Payment,
        Document,
        TaxObligation,
        InsurancePolicy,
        RecurringBill,
        Asset,
    ):
        await session.execute(delete(model).where(model.user_id == uid))
    await session.execute(delete(User).where(User.id == uid))
    print(f"  RESET: deleted user {CLIENT['email']} and all associated records")


# ════════════════════════════════════════════════════════════════════════════
# Seeders
# ════════════════════════════════════════════════════════════════════════════
async def get_or_create_user(session) -> User:
    user = (
        await session.execute(select(User).where(User.email == CLIENT["email"]))
    ).scalar_one_or_none()
    if user:
        print(f"  USER: exists — {CLIENT['email']}")
        return user
    user = User(
        email=CLIENT["email"],
        hashed_password=hash_password(CLIENT["password"]),
        full_name=CLIENT["full_name"],
        phone_number=CLIENT["phone_number"],
        is_active=True,
    )
    session.add(user)
    await session.flush()
    print(f"  USER: created — {CLIENT['email']}")
    return user


async def seed_assets(session, user_id, asset_id_map: dict, counter: Counter) -> None:
    for entry in BUILDINGS + LAND_ASSETS:
        bucket = counter.buildings if entry["asset_type"] == "building" else counter.land
        existing = (
            await session.execute(
                select(Asset).where(Asset.user_id == user_id, Asset.name == entry["name"])
            )
        ).scalar_one_or_none()
        if existing:
            asset_id_map[entry["name"]] = existing.id
            bucket[1] += 1
            continue
        asset = Asset(
            user_id=user_id,
            asset_type=entry["asset_type"],
            name=entry["name"],
            description=entry.get("description"),
            status=entry.get("status", "active"),
            asset_metadata=entry.get("metadata", {}),
        )
        session.add(asset)
        await session.flush()
        asset_id_map[entry["name"]] = asset.id
        bucket[0] += 1


async def seed_taxes(session, user_id, asset_id_map: dict, counter: Counter) -> None:
    for entry in TAX_OBLIGATIONS:
        existing = (
            await session.execute(
                select(TaxObligation).where(
                    TaxObligation.user_id == user_id,
                    TaxObligation.description == entry["description"],
                )
            )
        ).scalar_one_or_none()
        if existing:
            counter.taxes[1] += 1
            await ensure_alert_config(
                session, user_id, "tax", existing.id, [30, 15, 7, 3, 1], counter
            )
            continue
        due = _parse_date(entry.get("next_due"))
        if due is None:
            raise ValueError(f"Tax obligation missing next_due: {entry['description']}")
        notes = f"Tax ID: {entry['tax_id']}" if entry.get("tax_id") else None
        if entry.get("last_paid"):
            notes = f"{notes + ' | ' if notes else ''}Last paid: {entry['last_paid']}"
        tax = TaxObligation(
            user_id=user_id,
            asset_id=asset_id_map.get(entry["asset_name"]) if entry.get("asset_name") else None,
            tax_type=entry["tax_type"],
            jurisdiction=entry.get("jurisdiction"),
            description=entry["description"],
            due_date=due,
            recurrence_rule=entry.get("recurrence"),
            status="overdue" if due < TODAY else "pending",
            notes=notes,
        )
        session.add(tax)
        await session.flush()
        counter.taxes[0] += 1
        await ensure_alert_config(session, user_id, "tax", tax.id, [30, 15, 7, 3, 1], counter)


async def seed_bills(session, user_id, counter: Counter) -> None:
    for entry in RECURRING_BILLS:
        # No description column on the model — it lives in `notes`, which is our key.
        existing = (
            await session.execute(
                select(RecurringBill).where(
                    RecurringBill.user_id == user_id,
                    RecurringBill.notes == entry["description"],
                )
            )
        ).scalar_one_or_none()
        if existing:
            counter.bills[1] += 1
            await ensure_alert_config(session, user_id, "bill", existing.id, [7, 3, 1], counter)
            continue
        due = _parse_date(entry.get("next_due"))
        if due is None:
            raise ValueError(f"Bill missing next_due: {entry['description']}")
        bill = RecurringBill(
            user_id=user_id,
            bill_type=entry["bill_type"],
            provider_name=entry.get("provider_name"),
            billing_cycle=entry["billing_cycle"],
            next_due_date=due,
            is_active=entry.get("is_active", True),
            notes=entry["description"],
        )
        session.add(bill)
        await session.flush()
        counter.bills[0] += 1
        await ensure_alert_config(session, user_id, "bill", bill.id, [7, 3, 1], counter)


async def seed_insurance(session, user_id, counter: Counter) -> None:
    for entry in INSURANCE_POLICIES:
        notes = _insurance_notes(entry)
        existing = (
            await session.execute(
                select(InsurancePolicy).where(
                    InsurancePolicy.user_id == user_id,
                    InsurancePolicy.notes == notes,
                )
            )
        ).scalar_one_or_none()
        if existing:
            counter.insurance[1] += 1
            await ensure_alert_config(
                session, user_id, "insurance", existing.id, [30, 15, 7, 3, 1], counter
            )
            continue
        policy = InsurancePolicy(
            user_id=user_id,
            policy_number=_policy_number_for(entry["description"]),
            provider_name=entry["provider_name"],
            insurance_type=entry["insurance_type"],
            premium_amount=Decimal("0"),  # real premium amounts were not supplied
            premium_frequency=entry["premium_frequency"],
            next_premium_date=_parse_date(entry.get("next_premium_date")),
            status=entry.get("status", "active"),
            notes=notes,
        )
        session.add(policy)
        await session.flush()
        counter.insurance[0] += 1
        await ensure_alert_config(
            session, user_id, "insurance", policy.id, [30, 15, 7, 3, 1], counter
        )


# ════════════════════════════════════════════════════════════════════════════
# Output
# ════════════════════════════════════════════════════════════════════════════
def print_dry_run() -> None:
    n_alerts = len(TAX_OBLIGATIONS) + len(RECURRING_BILLS) + len(INSURANCE_POLICIES)
    print("  DRY RUN — no changes will be written to the database")
    print(f"  Would create user: {CLIENT['full_name']} ({CLIENT['email']})")
    print(f"  Would create {len(BUILDINGS)} buildings")
    print(f"  Would create {len(LAND_ASSETS)} land parcels")
    print(f"  Would create {len(TAX_OBLIGATIONS)} tax obligations")
    print(f"  Would create {len(RECURRING_BILLS)} recurring bills")
    print(f"  Would create {len(INSURANCE_POLICIES)} insurance policies")
    print(f"  Would create {n_alerts} alert configs")


def print_summary(counter: Counter) -> None:
    bar = "═" * 56
    print(bar)
    print(" TaxVault Client Data Seeding — Complete")
    print(bar)
    print(f" User:        {CLIENT['full_name']} ({CLIENT['email']})")
    print(f" Buildings:   {len(BUILDINGS):<2} ({counter.buildings[0]} created, {counter.buildings[1]} skipped)")
    print(f" Land assets: {len(LAND_ASSETS):<2} ({counter.land[0]} created, {counter.land[1]} skipped)")
    print(f" Tax oblig.:  {len(TAX_OBLIGATIONS):<2} ({counter.taxes[0]} created, {counter.taxes[1]} skipped)")
    print(f" Rec. bills:  {len(RECURRING_BILLS):<2} ({counter.bills[0]} created, {counter.bills[1]} skipped)")
    print(f" Insurance:   {len(INSURANCE_POLICIES):<2} ({counter.insurance[0]} created, {counter.insurance[1]} skipped)")
    print(f" Alert cfgs:  {counter.alerts} created")
    print(bar)
    print(" Run:   uvicorn app.main:app --reload")
    print(f" Login: {CLIENT['email']} / {CLIENT['password']}")
    print(bar)


# ════════════════════════════════════════════════════════════════════════════
# Entrypoint
# ════════════════════════════════════════════════════════════════════════════
async def run(dry_run: bool, reset: bool) -> None:
    if dry_run:
        print_dry_run()
        return

    async with AsyncSessionLocal() as session:
        try:
            if reset:
                await reset_client(session)
            user = await get_or_create_user(session)
            counter = Counter()
            asset_id_map: dict = {}
            await seed_assets(session, user.id, asset_id_map, counter)
            await seed_taxes(session, user.id, asset_id_map, counter)
            await seed_bills(session, user.id, counter)
            await seed_insurance(session, user.id, counter)
            await session.commit()
        except Exception:
            await session.rollback()
            print("\nERROR — all changes rolled back:\n", file=sys.stderr)
            traceback.print_exc()
            sys.exit(1)
        print_summary(counter)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed TaxVault with real client data.")
    parser.add_argument(
        "--dry-run", action="store_true", help="Print what would be created without writing."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="DANGER: delete the client user + all their data before reseeding (dev only).",
    )
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, reset=args.reset))


if __name__ == "__main__":
    main()
