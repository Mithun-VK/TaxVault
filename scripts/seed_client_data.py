#!/usr/bin/env python3
"""
TaxVault v3 — Client Data Seeding Script
Seeds all real client data from Property_Details.xlsx and Payable_Calender.xlsx
Source: Inigo Irudayaraj — Chennai

Usage:
  python scripts/seed_client_data.py              # Seed all data
  python scripts/seed_client_data.py --dry-run    # Preview without inserting
  python scripts/seed_client_data.py --reset      # Delete existing + re-seed (DEV ONLY)
  python scripts/seed_client_data.py --verify     # Check what's already seeded
"""

import asyncio
import argparse
import sys
import os
from datetime import date, datetime
from typing import Optional
from uuid import UUID

# Load .env before importing app modules
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# ─── Database setup ────────────────────────────────────────────────────────────
DATABASE_URL = os.environ['DATABASE_URL']
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={'statement_cache_size': 0},
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ─── Import models after engine is configured ──────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from backend.app.models.user import User
from backend.app.models.asset import Asset
from backend.app.models.tax_obligation import TaxObligation
from backend.app.models.recurring_bill import RecurringBill
from backend.app.models.insurance import InsurancePolicy
from backend.app.models.alert_config import AlertConfig
from backend.app.core.security import hash_password

# ══════════════════════════════════════════════════════════════════════════════
# CLIENT DATA
# All data verified against Property_Details.xlsx and Payable_Calender.xlsx
# ══════════════════════════════════════════════════════════════════════════════

CLIENT = {
    "full_name":    "Inigo Irudayaraj",
    "email":        "inigo@taxvault.in",    # CHANGE before production handover
    "password":     "TaxVault@2026",        # CHANGE before production handover
    "phone_number": "+919999999999",         # UPDATE with real mobile number
}

# ─── BUILDINGS (4) ────────────────────────────────────────────────────────────
BUILDINGS = [
    {
        "name": "Neelangari House",
        "description": "Residential property at Neelankarai, Chennai",
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
        }
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
            "sro": "SRO Joint-1, Trichy",
            "tneb_numbers": ["062 1300 54806", "062 1300 5942", "062 1300 5943"],
            "property_tax_ids": ["086/056/903516", "086/056/903517"],
            "water_tax_id": "086/056/901136",
        }
    },
    {
        "name": "Idaikattur Guest House",
        "description": "Guest house property at Idaikattur",
        "asset_type": "building",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "address": "Idaikattur, Sivagangai",
            "patta_number": "3115",
            "deed_numbers": ["1726/2015", "275/2016"],
            "deed_dates": ["2015-09-23", "2016-02-19"],
            "sro": "SRO, Sivagangai",
            "tneb_numbers": ["05 428 007 557", "05 428 018 1020", "05 428 0231188"],
            "tax_ids": ["891", "892"],
        }
    },
    {
        "name": "St. Thomas Mount Property",
        "description": "Property at St. Thomas Mount — Chingleput Diocese Lease",
        "asset_type": "building",
        "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "address": "St. Thomas Mount, Chennai",
            "deed_numbers": ["455/2010", "286/2010"],
            "deed_dates": ["2010-03-10", "2010-02-17"],
            "deed_types": ["Lease Deed", "Sale Deed for Building"],
            "sro": "SRO Joint-2, Saidapet",
            "tneb_numbers": ["092 420 74213", "092 420 74245"],
            "water_tax_id": "P01835/PSTMWD-2BLOCK-05000386",
            "lease_note": "Chingleput Diocese Property — Lease paid till May 2027",
        }
    },
]

# ─── LAND PARCELS (25) ────────────────────────────────────────────────────────
LANDS = [
    # S.No 5 — Fencing Thopu
    {
        "name": "Fencing Thopu Land — Manaparai",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "Fencing Thopu, Manaparai",
            "patta_numbers": ["2189", "1899", "1957"],
            "deed_type": "Family Partition", "deed_number": "1611/2016",
            "deed_date": "2016-02-18", "sro": "SRO, Manaparai",
        }
    },
    # S.No 6 — JR Layout
    {
        "name": "JR Layout Land — Kulathur",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "JR Layout, Kulathur",
            "deed_type": "Sale Deed", "deed_number": "2954/2008",
            "deed_date": "2008-06-27", "sro": "SRO, Kulathur",
        }
    },
    # S.No 7 — Country Gift Land, Andhra
    {
        "name": "Country Gift Land — Nagari, Andhra Pradesh",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "Nagari, Andhra Pradesh",
            "deed_type": "Sale Deed", "deed_number": "1634/2008",
            "deed_date": "2008-06-27", "sro": "SRO, Nagari",
        }
    },
    # S.No 8 — Alwin Villa, Tambaram (Felci Rajam)
    {
        "name": "Alwin Villa — Tambaram (Felci Rajam)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Felci Rajam", "location": "Alwin Villa, Tambaram",
            "patta_number": "14693",
            "deed_type": "Sale Deed", "deed_number": "4649/2016",
            "deed_date": "2016-09-02", "sro": "SRO, Padapai",
            "tneb_numbers": ["284 020 292", "284 020 293", "284 020 294",
                             "284 020 295", "284 202 296"],
            "property_tax_id": "3443",
        }
    },
    # S.No 9
    {
        "name": "Sirugudi Village Land — Patta 1190",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1190",
            "deed_type": "Sale Deed", "deed_number": "3517/2018",
            "deed_date": "2018-10-26", "sro": "SRO Sivagangai Joint II",
        }
    },
    # S.No 10
    {
        "name": "Sirugudi Village Land — Patta 1191",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1191",
            "deed_type": "Sale Deed", "deed_number": "3518/2018",
            "deed_date": "2018-10-26", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 11
    {
        "name": "Sirugudi Village Land — Patta 1199 (Deed 3519/2018)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1199",
            "deed_type": "Sale Deed", "deed_number": "3519/2018",
            "deed_date": "2018-10-26", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 12 (Felci Rajam)
    {
        "name": "Sirugudi Village Land — Patta 1200 (Felci Rajam)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Felci Rajam", "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1200",
            "deed_type": "Sale Deed", "deed_number": "3800/2018",
            "deed_date": "2018-10-26", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 13
    {
        "name": "Sirugudi Village Land — Patta 1199 (Deed 54/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1199",
            "deed_type": "Sale Deed", "deed_number": "54/2019",
            "deed_date": "2019-01-07", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 14
    {
        "name": "V.Pudukulam Land — Patta 1587 (Deed 744/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed", "deed_number": "744/2019",
            "deed_date": "2019-03-05", "sro": "SRO Sivagangai J2",
            "tax_id": "749",
        }
    },
    # S.No 15
    {
        "name": "V.Pudukulam Periyakottai Land — Patta 1587 (Deed 743/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "V.Pudukulam Periyakottai, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed", "deed_number": "743/2019",
            "deed_date": "2019-03-05", "sro": "SRO, Sivagangai",
            "tax_id": "749",
        }
    },
    # S.No 16
    {
        "name": "V.Pudukulam Land — Patta 1587 (Deed 745/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed", "deed_number": "745/2019",
            "deed_date": "2019-03-05", "sro": "SRO, Sivagangai",
            "tax_id": "749",
        }
    },
    # S.No 17 (Allwyn Tony)
    {
        "name": "V.Pudukulam Land — Patta 1609 (Allwyn Tony, Deed 2850/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Allwyn Tony", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1609",
            "deed_type": "Sale Deed", "deed_number": "2850/2019",
            "deed_date": "2019-08-28", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 18 (Allwyn Tony)
    {
        "name": "V.Pudukulam Land — Patta 1609 (Allwyn Tony, Deed 2853/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Allwyn Tony", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1609",
            "deed_type": "Sale Deed", "deed_number": "2853/2019",
            "deed_date": "2019-08-28", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 19 (Allwyn Tony)
    {
        "name": "V.Pudukulam Land — Patta 1222 (Allwyn Tony, Deed 2851/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Allwyn Tony", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1222",
            "deed_type": "Sale Deed", "deed_number": "2851/2019",
            "deed_date": "2019-08-28", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 20
    {
        "name": "V.Pudukulam Land — Patta 1587 (Deed 2854/2019)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1587",
            "deed_type": "Sale Deed", "deed_number": "2854/2019",
            "deed_date": "2019-08-28", "sro": "SRO, Sivagangai",
            "tax_id": "749",
        }
    },
    # S.No 21
    {
        "name": "Sirugudi Village Land — Patta 1199 (Deed 2730/2020)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "Sirugudi Village, Sivagangai",
            "patta_number": "1199",
            "deed_type": "Sale Deed", "deed_number": "2730/2020",
            "deed_date": "2020-09-28", "sro": "SRO, Sivagangai",
        }
    },
    # S.No 22
    {
        "name": "V.Pudukulam Land — Old Patta 1915 (Deed 961/2025)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1915 (old)",
            "deed_type": "Sale Deed", "deed_number": "961/2025",
            "deed_date": "2025-02-24", "sro": "SRO Joint-2, Sivagangai",
        }
    },
    # S.No 23
    {
        "name": "V.Pudukulam Land — Old Patta 1905 (Deed 962/2025)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1905 (old)",
            "deed_type": "Sale Deed", "deed_number": "962/2025",
            "deed_date": "2025-02-24", "sro": "SRO Joint-2, Sivagangai",
        }
    },
    # S.No 24
    {
        "name": "Sirugudi Chettikulam Land — Patta 1357 (Deed 3938/2025)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village (Chettikulam), Sivagangai",
            "patta_number": "1357",
            "deed_type": "Sale Deed", "deed_number": "3938/2025",
            "deed_date": "2025-08-14", "sro": "SRO Joint-2, Sivagangai",
        }
    },
    # S.No 25
    {
        "name": "Sirugudi Chettikulam Land — Patta 1357 (Deed 3939/2025)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Inigo Irudayaraj",
            "location": "Sirugudi Village (Chettikulam), Sivagangai",
            "patta_number": "1357",
            "deed_type": "Sale Deed", "deed_number": "3939/2025",
            "deed_date": "2025-08-14", "sro": "SRO Joint-2, Sivagangai",
        }
    },
    # S.No 26 (Jesurajan)
    {
        "name": "V.Pudukulam Land — Patta 1724 (Jesurajan)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Jesurajan", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "1724",
            "deed_type": "Sale Deed", "deed_number": "2084/2021",
            "deed_date": "2021-07-13", "sro": "SRO Joint-2, Sivagangai",
        }
    },
    # S.No 27 (Jesurajan)
    {
        "name": "V.Pudukulam Land — Old Patta 782 (Jesurajan, Deed 2627/2022)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Jesurajan", "location": "V.Pudukulam, Sivagangai",
            "patta_number": "782 (old)",
            "deed_type": "Sale Deed", "deed_number": "2627/2022",
            "deed_date": "2022-06-30", "sro": "SRO Joint-2, Sivagangai",
        }
    },
    # S.No 28 (Jesurajan)
    {
        "name": "V.Pudukulam Land — Patta 1746/1809/1914 (Jesurajan)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Jesurajan", "location": "V.Pudukulam, Sivagangai",
            "patta_numbers": ["1746", "1809", "1914"],
            "deed_type": "Sale Deed", "deed_number": "3331/2021",
            "deed_date": "2021-09-30", "sro": "SRO Joint-2, Sivagangai",
        }
    },
    # S.No 29 (Jesurajan)
    {
        "name": "Sirugudi Village Land — Patta 3116 (Jesurajan)",
        "asset_type": "land", "status": "active",
        "metadata": {
            "owner_name": "Jesurajan", "location": "Sirugudi Village, Sivagangai",
            "patta_number": "3116",
            "deed_type": "Sale Deed", "deed_number": "533/2019",
            "deed_date": "2019-03-15", "sro": "SRO Joint-1, Sivagangai",
            "tax_id": "483",
        }
    },
]

# ─── TAX OBLIGATIONS ──────────────────────────────────────────────────────────
# next_due calculated from Payable_Calender.xlsx 2026 schedule
def TAXES(asset_id_map: dict) -> list:
    return [
        # ── NEELANGARI (linked to building 0) ──
        {
            "asset_name": "Neelangari House",
            "tax_type": "property_tax",
            "description": "Neelangari House Property Tax — ID: 15 192 003226",
            "jurisdiction": "Neelankarai Corporation, Chennai",
            "assessment_year": "2025-26",
            "total_amount": None,
            "due_date": date(2026, 11, 30),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        {
            "asset_name": "Neelangari House",
            "tax_type": "water_tax",
            "description": "Neelangari Water Tax — ID: 15 192 003226",
            "jurisdiction": "Neelankarai Corporation, Chennai",
            "total_amount": None,
            "due_date": date(2026, 11, 30),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        # ── TRICHY KARUMANDAM ──
        {
            "asset_name": "Trichy Karumandam House",
            "tax_type": "property_tax",
            "description": "Trichy Karumandam Property Tax 1 — ID: 086/056/903516",
            "jurisdiction": "Trichy Corporation",
            "total_amount": None,
            "due_date": date(2026, 11, 14),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        {
            "asset_name": "Trichy Karumandam House",
            "tax_type": "property_tax",
            "description": "Trichy Karumandam Property Tax 2 — ID: 086/056/903517",
            "jurisdiction": "Trichy Corporation",
            "total_amount": None,
            "due_date": date(2026, 11, 14),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        {
            "asset_name": "Trichy Karumandam House",
            "tax_type": "water_tax",
            "description": "Trichy Karumandam Water Tax 1 — ID: 086/056/901136",
            "jurisdiction": "Trichy Corporation",
            "total_amount": None,
            "due_date": date(2026, 11, 14),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        {
            "asset_name": "Trichy Karumandam House",
            "tax_type": "water_tax",
            "description": "Trichy Karumandam Water Tax 2 — ID: 086/056/901136",
            "jurisdiction": "Trichy Corporation",
            "total_amount": None,
            "due_date": date(2026, 11, 14),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        # ── IDAIKATTUR ──
        {
            "asset_name": "Idaikattur Guest House",
            "tax_type": "property_tax",
            "description": "Idaikattur Guest House Tax — ID: 891",
            "jurisdiction": "Idaikattur, Sivagangai",
            "total_amount": None,
            "due_date": date(2026, 9, 20),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        {
            "asset_name": "Idaikattur Guest House",
            "tax_type": "property_tax",
            "description": "Idaikattur Guest House Tax — ID: 892",
            "jurisdiction": "Idaikattur, Sivagangai",
            "total_amount": None,
            "due_date": date(2026, 9, 20),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        # ── ST. THOMAS MOUNT ──
        {
            "asset_name": "St. Thomas Mount Property",
            "tax_type": "other",
            "description": "PSTMWD Water Tax — ID: P01835/PSTMWD-2BLOCK-05000386",
            "jurisdiction": "St. Thomas Mount, Chennai",
            "total_amount": None,
            "due_date": date(2027, 5, 30),
            "recurrence_rule": "ANNUAL",
            "status": "paid",   # Paid 30.05.2025
        },
        # ── MUDICHUR HOUSE ──
        {
            "asset_name": None,
            "tax_type": "property_tax",
            "description": "Mudichur House Property Tax — 2nd Half",
            "jurisdiction": "Mudichur",
            "total_amount": None,
            "due_date": date(2026, 9, 18),
            "recurrence_rule": "BIANNUAL",
            "status": "pending",
        },
        # ── SIRUGUDI LAND TAXES ──
        {
            "asset_name": None,
            "tax_type": "land_tax",
            "description": "Sirugudi Land Tax — Inigo Irudayaraj Properties",
            "jurisdiction": "Sirugudi Village, Sivagangai",
            "total_amount": None,
            "due_date": date(2027, 3, 18),
            "recurrence_rule": "ANNUAL",
            "status": "paid",   # Paid March 2026
        },
        {
            "asset_name": None,
            "tax_type": "land_tax",
            "description": "Sirugudi Land Tax — Felci Rajam Properties",
            "jurisdiction": "Sirugudi Village, Sivagangai",
            "total_amount": None,
            "due_date": date(2027, 3, 18),
            "recurrence_rule": "ANNUAL",
            "status": "paid",
        },
        # ── V.PUDUKULAM LAND TAXES ──
        {
            "asset_name": "V.Pudukulam Land — Patta 1587 (Deed 744/2019)",
            "tax_type": "land_tax",
            "description": "V.Pudukulam Land Tax — Tax ID: 749 (Inigo Irudayaraj)",
            "jurisdiction": "V.Pudukulam, Sivagangai",
            "total_amount": None,
            "due_date": date(2027, 3, 18),
            "recurrence_rule": "ANNUAL",
            "status": "paid",   # Paid 01.09.2025
        },
        {
            "asset_name": None,
            "tax_type": "land_tax",
            "description": "V.Pudukulam Land Tax — Allwyn Tony Properties",
            "jurisdiction": "V.Pudukulam, Sivagangai",
            "total_amount": None,
            "due_date": date(2027, 3, 18),
            "recurrence_rule": "ANNUAL",
            "status": "paid",
        },
        {
            "asset_name": None,
            "tax_type": "land_tax",
            "description": "V.Pudukulam Land Tax — Jesurajan Properties",
            "jurisdiction": "V.Pudukulam, Sivagangai",
            "total_amount": None,
            "due_date": date(2027, 3, 18),
            "recurrence_rule": "ANNUAL",
            "status": "paid",
        },
        # ── FENCING THOPU ──
        {
            "asset_name": "Fencing Thopu Land — Manaparai",
            "tax_type": "land_tax",
            "description": "Manaparai Fencing Thopu Land Tax",
            "jurisdiction": "Manaparai",
            "total_amount": None,
            "due_date": date(2027, 3, 20),
            "recurrence_rule": "ANNUAL",
            "status": "paid",   # Paid March 2026
        },
        # ── ALWIN VILLA ──
        {
            "asset_name": "Alwin Villa — Tambaram (Felci Rajam)",
            "tax_type": "property_tax",
            "description": "Alwin Villa Property Tax — ID: 3443",
            "jurisdiction": "Tambaram, Chennai",
            "total_amount": None,
            "due_date": date(2026, 9, 1),
            "recurrence_rule": "BIANNUAL",
            "status": "paid",   # Paid 01.09.2025
        },
        # ── JESURAJAN SIRUGUDI ──
        {
            "asset_name": "Sirugudi Village Land — Patta 3116 (Jesurajan)",
            "tax_type": "land_tax",
            "description": "Sirugudi Jesurajan Land Tax — ID: 483",
            "jurisdiction": "Sirugudi Village, Sivagangai",
            "total_amount": None,
            "due_date": date(2026, 9, 1),
            "recurrence_rule": "ANNUAL",
            "status": "paid",   # Paid 01.09.2025
        },
        # ── COMPLIANCE OBLIGATIONS ──
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "TDS Payable (Monthly 7th)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2026, 7, 7),
            "recurrence_rule": "MONTHLY",
            "status": "pending",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "GST Return 1 Filing (Monthly 11th)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2026, 7, 11),
            "recurrence_rule": "MONTHLY",
            "status": "pending",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "EPF Return Filing (Monthly 14th)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2026, 7, 14),
            "recurrence_rule": "MONTHLY",
            "status": "pending",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "ESI Return Filing (Monthly 14th)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2026, 7, 14),
            "recurrence_rule": "MONTHLY",
            "status": "pending",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "TDS Quarterly Return Filing",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2026, 7, 30),
            "recurrence_rule": "QUARTERLY",
            "status": "pending",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "GST Return 3B Filing (June 20)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2027, 6, 20),
            "recurrence_rule": "ANNUAL",
            "status": "paid",   # June 2026 done
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "DPT-3 Return Filing (June 5 annual)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2027, 6, 5),
            "recurrence_rule": "ANNUAL",
            "status": "paid",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "ROC Return Filing (Oct 12)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2026, 10, 12),
            "recurrence_rule": "ANNUAL",
            "status": "pending",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "Company Income Tax Filing (Sep 30)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2026, 9, 30),
            "recurrence_rule": "ANNUAL",
            "status": "pending",
        },
        {
            "asset_name": None,
            "tax_type": "other",
            "description": "Partnership Firm Income Tax Filing (Jun 30)",
            "jurisdiction": "India",
            "total_amount": None,
            "due_date": date(2027, 6, 30),
            "recurrence_rule": "ANNUAL",
            "status": "paid",
        },
    ]

# ─── RECURRING BILLS (from Payable_Calender.xlsx) ─────────────────────────────
BILLS = [
    # Monthly — 4th
    {"bill_type": "other",       "provider_name": "Dubai Property",   "description": "Dubai Rent Amount (Monthly 4th)",      "billing_cycle": "monthly",   "next_due_date": date(2026, 7, 4),  "is_active": True},
    {"bill_type": "phone",       "provider_name": "Vodafone",          "description": "Vodafone Monthly Payable (4th)",       "billing_cycle": "monthly",   "next_due_date": date(2026, 7, 4),  "is_active": True},
    # Monthly — 5th
    {"bill_type": "other",       "provider_name": "Dubai Office",      "description": "Dubai MD Salary (Monthly 5th)",        "billing_cycle": "monthly",   "next_due_date": date(2026, 7, 5),  "is_active": True},
    {"bill_type": "phone",       "provider_name": "Dubai Mobile",      "description": "Dubai Mobile Bill (Monthly 5th)",      "billing_cycle": "monthly",   "next_due_date": date(2026, 7, 5),  "is_active": True},
    {"bill_type": "other",       "provider_name": "Axis Bank",         "description": "Axis Bank Loan EMI (Monthly 5th)",     "billing_cycle": "monthly",   "next_due_date": date(2026, 7, 5),  "is_active": True},
    {"bill_type": "wifi",        "provider_name": "Hathway",           "description": "Hathway Broadband (Monthly 5th)",      "billing_cycle": "monthly",   "next_due_date": date(2026, 7, 5),  "is_active": True},
    # Monthly — 7th
    # (TDS Payable handled in tax_obligations)
    # Monthly — 10th
    {"bill_type": "other",       "provider_name": "ICICI Bank",        "description": "ICICI Bank Credit Card (Monthly 10th)","billing_cycle": "monthly",   "next_due_date": date(2026, 7, 10), "is_active": True},
    {"bill_type": "other",       "provider_name": "Innova Car Finance", "description": "Innova Car Loan EMI (Monthly 10th, from Apr)", "billing_cycle": "monthly", "next_due_date": date(2026, 7, 10), "is_active": True},
    # Monthly — 11th (GST handled in taxes)
    # Monthly — 12th
    {"bill_type": "other",       "provider_name": "Axis Bank",         "description": "Axis Credit Card (Monthly 12th)",      "billing_cycle": "monthly",   "next_due_date": date(2026, 7, 12), "is_active": True},
    # Monthly — 14th (EPF/ESI handled in taxes)
    # Monthly — 15th (EPF/ESI Online handled in taxes)
    # Electricity bills — alternating months
    {"bill_type": "electricity", "provider_name": "TNEB",              "description": "EB — Fashion Profiles (15th, odd months Jan/Mar/May/Jul/Sep/Nov)", "billing_cycle": "bimonthly", "next_due_date": date(2026, 7, 15), "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB",              "description": "EB — Guest House (15th, even months Feb/Apr/Jun/Aug/Oct/Dec)",     "billing_cycle": "bimonthly", "next_due_date": date(2026, 8, 15), "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB",              "description": "EB — Idaikattur Guest House (18th, June 2026)",                     "billing_cycle": "bimonthly", "next_due_date": date(2026, 7, 18), "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB",              "description": "EB — Trichy House (18th, Jul/Sep/Nov/Jan)",                         "billing_cycle": "bimonthly", "next_due_date": date(2026, 7, 18), "is_active": True},
    {"bill_type": "electricity", "provider_name": "TNEB",              "description": "EB — Godown (19th, bimonthly Feb/Apr/Jun/Aug/Oct/Dec)",             "billing_cycle": "bimonthly", "next_due_date": date(2026, 8, 19), "is_active": True},
    # Monthly — 30th (from July)
    {"bill_type": "phone",       "provider_name": "Airtel",            "description": "Airtel Mobile Bill (Monthly 30th, from July)", "billing_cycle": "monthly",  "next_due_date": date(2026, 7, 30), "is_active": True},
    # July 19
    {"bill_type": "phone",       "provider_name": "BSNL",              "description": "BSNL Landline (July 19 annual)",               "billing_cycle": "monthly",  "next_due_date": date(2026, 7, 19), "is_active": True},
    # Annual renewals / licenses
    {"bill_type": "other",       "provider_name": "Zoho",              "description": "Zoho Subscription (Nov 1 annual)",             "billing_cycle": "quarterly", "next_due_date": date(2026, 11, 1),  "is_active": True},
    {"bill_type": "other",       "provider_name": "Textiles Committee","description": "Textiles Committee Renewal (Jun 6)",           "billing_cycle": "quarterly", "next_due_date": date(2027, 6, 6),   "is_active": True},
    {"bill_type": "other",       "provider_name": "Textiles Committee","description": "Textiles Committee — Causeway Bay Renewal (Jul 23)", "billing_cycle": "quarterly", "next_due_date": date(2027, 7, 23), "is_active": True},
    {"bill_type": "other",       "provider_name": "FSSAI",             "description": "FSSAI License Renewal (Nov 24)",               "billing_cycle": "quarterly", "next_due_date": date(2026, 11, 24), "is_active": True},
    {"bill_type": "other",       "provider_name": "Spice Board",       "description": "Spice Board Renewal (Nov 25)",                 "billing_cycle": "quarterly", "next_due_date": date(2026, 11, 25), "is_active": True},
    {"bill_type": "other",       "provider_name": "AEPC",              "description": "AEPC Renewal — Fashion Profiles (May 31)",     "billing_cycle": "quarterly", "next_due_date": date(2027, 5, 31),  "is_active": True},
    {"bill_type": "other",       "provider_name": "AEPC",              "description": "AEPC Renewal — Causeway Bay (Jun 30)",         "billing_cycle": "quarterly", "next_due_date": date(2027, 6, 30),  "is_active": True},
    {"bill_type": "other",       "provider_name": "Import Export Code","description": "Import Export Code Renewal (Jun 30)",          "billing_cycle": "quarterly", "next_due_date": date(2027, 6, 30),  "is_active": True},
    {"bill_type": "other",       "provider_name": "CNI",               "description": "CNI Domain Renewal (Jun 16)",                  "billing_cycle": "quarterly", "next_due_date": date(2027, 6, 16),  "is_active": True},
    {"bill_type": "other",       "provider_name": "All Domains",       "description": "Domain Renewal — All (Aug 16)",               "billing_cycle": "quarterly", "next_due_date": date(2026, 8, 16),  "is_active": True},
    {"bill_type": "other",       "provider_name": "Dubai Domain",      "description": "Dubai Domain Renewal (Sep 13)",               "billing_cycle": "quarterly", "next_due_date": date(2026, 9, 13),  "is_active": True},
    {"bill_type": "other",       "provider_name": "JAFZA",             "description": "JAFZA Trading License Renewal (Sep 5)",        "billing_cycle": "quarterly", "next_due_date": date(2026, 9, 5),   "is_active": True},
    {"bill_type": "other",       "provider_name": "CNI",               "description": "CNI 12A Registration Renewal (Sep 18)",        "billing_cycle": "quarterly", "next_due_date": date(2026, 9, 18),  "is_active": True},
    {"bill_type": "other",       "provider_name": "Emirates",          "description": "Emirates Card Renewal (Sep 13)",              "billing_cycle": "quarterly", "next_due_date": date(2026, 9, 13),  "is_active": True},
]

# ─── INSURANCE POLICIES ───────────────────────────────────────────────────────
INSURANCE = [
    {
        "policy_number":       "UNITED-INDIA-INIGO",
        "provider_name":       "United India Insurance",
        "insurance_type":      "medical",
        "description":         "Mediclaim Policy — Inigo Irudayaraj (United India)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2027, 4, 11),
        "status":              "active",
    },
    {
        "policy_number":       "JESU-MEDICAL-001",
        "provider_name":       "Insurance Company",
        "insurance_type":      "medical",
        "description":         "Jesu Rajan Medical Policy (Jul 3 annual)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2027, 7, 3),
        "status":              "active",
    },
    {
        "policy_number":       "LIC-FELCI-RAJAM",
        "provider_name":       "LIC",
        "insurance_type":      "life",
        "description":         "LIC Policy — Felci Rajam (Quarterly: Feb 28, Jul 28, Sep 28)",
        "premium_frequency":   "quarterly",
        "next_premium_date":   date(2026, 9, 28),
        "status":              "active",
    },
    {
        "policy_number":       "LIC-ALLWYN-TONY",
        "provider_name":       "LIC",
        "insurance_type":      "life",
        "description":         "LIC Policy — Allwyn Tony (Annual: Nov 28)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2026, 11, 28),
        "status":              "active",
    },
    {
        "policy_number":       "FORTUNER-INS-001",
        "provider_name":       "Insurance Company",
        "insurance_type":      "vehicle",
        "description":         "Fortuner Car Insurance Renewal (Dec 9)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2026, 12, 9),
        "status":              "active",
    },
    {
        "policy_number":       "INNOVA-INS-001",
        "provider_name":       "Insurance Company",
        "insurance_type":      "vehicle",
        "description":         "Innova Car Insurance Renewal (Feb 10)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2027, 2, 10),
        "status":              "active",
    },
    {
        "policy_number":       "TRICHY-FORTUNER-INS",
        "provider_name":       "Insurance Company",
        "insurance_type":      "vehicle",
        "description":         "Trichy Fortuner Car Insurance (Apr 10)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2027, 4, 10),
        "status":              "active",
    },
    {
        "policy_number":       "INNOVA-ALLWYN-2028",
        "provider_name":       "Insurance Company",
        "insurance_type":      "vehicle",
        "description":         "Innova Car (Allwyn) Insurance — Valid till Jun 2028",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2028, 6, 12),
        "status":              "active",
        "notes":               "Renewed till 2028 — no action needed until June 2028",
    },
    {
        "policy_number":       "CIAZ-INS-001",
        "provider_name":       "Insurance Company",
        "insurance_type":      "vehicle",
        "description":         "Ciaz Car Insurance (Jun 26)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2027, 6, 26),
        "status":              "active",
    },
    {
        "policy_number":       "TRACTOR-INS-001",
        "provider_name":       "Insurance Company",
        "insurance_type":      "other",
        "description":         "Tractor Insurance Renewal (Nov 26)",
        "premium_frequency":   "annual",
        "next_premium_date":   date(2026, 11, 26),
        "status":              "active",
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# SEEDING FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

async def create_alert_config(
    db: AsyncSession,
    user_id: str,
    entity_type: str,
    entity_id: str,
    days_before: list = None,
    channels: list = None
):
    config = AlertConfig(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        days_before=days_before or [30, 15, 7, 3, 1],
        channels=channels or ["email", "push"],
        is_active=True,
    )
    db.add(config)


async def seed_all(dry_run: bool = False, reset: bool = False):
    counts = {
        "user": 0, "assets": 0, "taxes": 0,
        "bills": 0, "insurance": 0, "alert_configs": 0,
        "skipped": 0
    }

    async with SessionLocal() as db:
        # ── RESET if requested ─────────────────────────────────────────────
        if reset:
            print("⚠  RESET mode — deleting all existing data...")
            if not dry_run:
                # Delete in FK-safe order
                for model in [AlertConfig, InsurancePolicy, RecurringBill,
                              TaxObligation, Asset, User]:
                    result = await db.execute(delete(model))
                    print(f"   Deleted {result.rowcount} {model.__tablename__}")
                await db.commit()

        # ── USER ──────────────────────────────────────────────────────────
        existing = await db.execute(
            select(User).where(User.email == CLIENT["email"])
        )
        user = existing.scalar_one_or_none()

        if user:
            print(f"ℹ  User exists: {user.email} (id: {user.id})")
            counts["skipped"] += 1
        else:
            if not dry_run:
                user = User(
                    email=CLIENT["email"],
                    full_name=CLIENT["full_name"],
                    hashed_password=hash_password(CLIENT["password"]),
                    phone_number=CLIENT["phone_number"],
                    is_active=True,
                    device_tokens=[],
                )
                db.add(user)
                await db.flush()  # Get ID without committing
                print(f"✓  Created user: {user.email}")
                counts["user"] += 1
            else:
                print(f"[DRY RUN] Would create user: {CLIENT['email']}")
                return counts

        user_id = str(user.id)

        # ── ASSETS (buildings + land) ──────────────────────────────────────
        asset_id_map = {}  # name → UUID string

        for asset_data in BUILDINGS + LANDS:
            # Check if already exists
            existing = await db.execute(
                select(Asset).where(
                    Asset.name == asset_data["name"],
                    Asset.user_id == user.id
                )
            )
            existing_asset = existing.scalar_one_or_none()

            if existing_asset:
                asset_id_map[asset_data["name"]] = str(existing_asset.id)
                counts["skipped"] += 1
                continue

            if not dry_run:
                asset = Asset(
                    user_id=user.id,
                    asset_type=asset_data["asset_type"],
                    name=asset_data["name"],
                    description=asset_data.get("description"),
                    status=asset_data.get("status", "active"),
                    metadata=asset_data.get("metadata", {}),
                    is_archived=False,
                )
                db.add(asset)
                await db.flush()
                asset_id_map[asset_data["name"]] = str(asset.id)
                counts["assets"] += 1
            else:
                print(f"[DRY RUN] Would create asset: {asset_data['name']}")
                counts["assets"] += 1

        # ── TAX OBLIGATIONS ────────────────────────────────────────────────
        for tax_data in TAXES(asset_id_map):
            # Resolve asset_id
            asset_id = None
            if tax_data.get("asset_name") and tax_data["asset_name"] in asset_id_map:
                asset_id = asset_id_map[tax_data["asset_name"]]

            # Check duplicate
            existing = await db.execute(
                select(TaxObligation).where(
                    TaxObligation.description == tax_data["description"],
                    TaxObligation.user_id == user.id
                )
            )
            if existing.scalar_one_or_none():
                counts["skipped"] += 1
                continue

            if not dry_run:
                tax = TaxObligation(
                    user_id=user.id,
                    asset_id=asset_id,
                    tax_type=tax_data["tax_type"],
                    description=tax_data["description"],
                    jurisdiction=tax_data.get("jurisdiction"),
                    assessment_year=tax_data.get("assessment_year"),
                    total_amount=tax_data.get("total_amount"),
                    due_date=tax_data["due_date"],
                    recurrence_rule=tax_data.get("recurrence_rule"),
                    status=tax_data.get("status", "pending"),
                    notes=tax_data.get("notes"),
                    is_archived=False,
                )
                db.add(tax)
                await db.flush()

                # Create alert config for pending taxes only
                if tax.status == "pending":
                    await create_alert_config(db, user_id, "tax", str(tax.id))
                    counts["alert_configs"] += 1

                counts["taxes"] += 1
            else:
                print(f"[DRY RUN] Would create tax: {tax_data['description']}")
                counts["taxes"] += 1

        # ── RECURRING BILLS ────────────────────────────────────────────────
        for bill_data in BILLS:
            existing = await db.execute(
                select(RecurringBill).where(
                    RecurringBill.description == bill_data["description"],
                    RecurringBill.user_id == user.id
                )
            )
            if existing.scalar_one_or_none():
                counts["skipped"] += 1
                continue

            if not dry_run:
                bill = RecurringBill(
                    user_id=user.id,
                    bill_type=bill_data["bill_type"],
                    provider_name=bill_data["provider_name"],
                    description=bill_data.get("description"),
                    billing_cycle=bill_data["billing_cycle"],
                    average_amount=bill_data.get("average_amount"),
                    next_due_date=bill_data["next_due_date"],
                    is_active=bill_data.get("is_active", True),
                )
                db.add(bill)
                await db.flush()

                await create_alert_config(
                    db, user_id, "bill", str(bill.id),
                    days_before=[7, 3, 1],   # Bills need shorter lead time
                )
                counts["alert_configs"] += 1
                counts["bills"] += 1
            else:
                print(f"[DRY RUN] Would create bill: {bill_data['description']}")
                counts["bills"] += 1

        # ── INSURANCE POLICIES ─────────────────────────────────────────────
        for ins_data in INSURANCE:
            existing = await db.execute(
                select(InsurancePolicy).where(
                    InsurancePolicy.policy_number == ins_data["policy_number"],
                    InsurancePolicy.user_id == user.id
                )
            )
            if existing.scalar_one_or_none():
                counts["skipped"] += 1
                continue

            if not dry_run:
                policy = InsurancePolicy(
                    user_id=user.id,
                    policy_number=ins_data["policy_number"],
                    provider_name=ins_data["provider_name"],
                    insurance_type=ins_data["insurance_type"],
                    premium_frequency=ins_data["premium_frequency"],
                    next_premium_date=ins_data.get("next_premium_date"),
                    status=ins_data.get("status", "active"),
                    notes=ins_data.get("notes"),
                )
                db.add(policy)
                await db.flush()

                await create_alert_config(db, user_id, "insurance", str(policy.id))
                counts["alert_configs"] += 1
                counts["insurance"] += 1
            else:
                print(f"[DRY RUN] Would create policy: {ins_data['description']}")
                counts["insurance"] += 1

        # ── COMMIT ─────────────────────────────────────────────────────────
        if not dry_run:
            await db.commit()

    return counts


async def verify_seed():
    """Show what's currently in the database."""
    async with SessionLocal() as db:
        user_result = await db.execute(
            select(User).where(User.email == CLIENT["email"])
        )
        user = user_result.scalar_one_or_none()

        if not user:
            print(f"\n✗  User {CLIENT['email']} not found — run seeding first\n")
            return

        # Count each entity type
        async def count(model, **filters):
            q = select(model).where(model.user_id == user.id)
            result = await db.execute(q)
            return len(result.scalars().all())

        print(f"\n{'='*52}")
        print(f"  TaxVault Database — Current State")
        print(f"{'='*52}")
        print(f"  User:         {user.full_name} ({user.email})")
        print(f"  User ID:      {user.id}")
        print(f"  Assets:       {await count(Asset)}")
        print(f"  Tax oblig.:   {await count(TaxObligation)}")
        print(f"  Recurring bills: {await count(RecurringBill)}")
        print(f"  Insurance:    {await count(InsurancePolicy)}")
        print(f"  Alert configs:{await count(AlertConfig)}")
        print(f"{'='*52}\n")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(description="TaxVault client data seeder")
    parser.add_argument("--dry-run",  action="store_true", help="Preview without inserting")
    parser.add_argument("--reset",    action="store_true", help="Delete existing data first (DEV ONLY)")
    parser.add_argument("--verify",   action="store_true", help="Show current database state")
    args = parser.parse_args()

    if args.verify:
        await verify_seed()
        return

    if args.dry_run:
        print("\n[DRY RUN] No data will be written to the database\n")

    if args.reset and not args.dry_run:
        confirm = input("⚠  Reset will delete ALL data. Type RESET to confirm: ")
        if confirm != "RESET":
            print("Aborted.")
            return

    try:
        counts = await seed_all(dry_run=args.dry_run, reset=args.reset)

        mode = "[DRY RUN] Would create" if args.dry_run else "Created"
        print(f"\n{'='*52}")
        print(f"  TaxVault — Seeding Complete")
        print(f"{'='*52}")
        print(f"  {mode}: {counts['user']} user")
        print(f"  {mode}: {counts['assets']} assets")
        print(f"  {mode}: {counts['taxes']} tax obligations")
        print(f"  {mode}: {counts['bills']} recurring bills")
        print(f"  {mode}: {counts['insurance']} insurance policies")
        print(f"  {mode}: {counts['alert_configs']} alert configs")
        print(f"  Skipped (already exist): {counts['skipped']}")
        print(f"{'='*52}")
        if not args.dry_run:
            print(f"\n  Login at: http://localhost:8000/docs or your domain")
            print(f"  Email:    {CLIENT['email']}")
            print(f"  Password: {CLIENT['password']}")
            print(f"\n  ⚠  Change email + password before client handover!\n")

    except Exception as e:
        print(f"\n✗  Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())