"""Human-readable labels for payables (bills / taxes / insurance).

Every surface that lists a payable — the payment calendar, the payments feed,
the reports — shows the same label through these helpers. They prefer the
stored ``name`` column and fall back to the historical derivation so rows
created before the column existed (or left unnamed) still read sensibly.
"""
from app.models.insurance import InsurancePolicy
from app.models.recurring_bill import RecurringBill
from app.models.tax_obligation import TaxObligation


def bill_display_name(bill: RecurringBill) -> str:
    return bill.name or bill.provider_name or bill.bill_type


def tax_display_name(tax: TaxObligation) -> str:
    return tax.name or tax.description or tax.tax_type


def insurance_display_name(policy: InsurancePolicy) -> str:
    return policy.name or f"{policy.provider_name} - {policy.policy_number}"
