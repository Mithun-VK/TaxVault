export interface BankAccount {
  bank_name: string;
  branch?: string;
  account_number: string;
  ifsc_code: string;
  /** current | savings | cc | od */
  account_type: string;
  is_primary: boolean;
}

export interface Director {
  /** Optional link to an Individual profile, when the director is also a family member. */
  individual_id?: string;
  name: string;
  /** Director Identification Number - 8 digits. */
  din?: string;
  /** Digital Signature Certificate used to sign MCA/GST/IT filings. */
  dsc_number?: string;
  dsc_expiry?: string;
  /** Shareholding / partnership stake, 0–100. */
  share_percentage?: number;
  designation: string;
  appointed_date?: string;
  is_active: boolean;
}

export interface OtherRegistration {
  name: string;
  number: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date?: string;
  notes?: string;
}

export interface Company {
  id: string;
  user_id: string;
  legal_name: string;
  trade_name?: string;
  company_type: string;
  status: string;
  industry?: string;
  description?: string;
  incorporation_date?: string;
  incorporation_state?: string;
  cin?: string;
  llpin?: string;
  pan_number?: string;
  tan_number?: string;
  gstin?: string;
  gstin_state_code?: string;
  income_tax_ward?: string;
  /** Import Export Code. */
  iec_code?: string;
  /** merchant | manufacturer | both */
  exporter_type?: string;
  aepc_code?: string;
  textile_committee_code?: string;
  /** Udyam (MSME) registration number. */
  msme_number?: string;
  esi_number?: string;
  epf_number?: string;
  professional_tax_number?: string;
  foreign_registration_number?: string;
  foreign_jurisdiction?: string;
  foreign_registration_date?: string;
  foreign_registration_expiry?: string;
  other_registrations: OtherRegistration[];
  registered_address?: string;
  operational_address?: string;
  phone_number?: string;
  email?: string;
  website?: string;
  bank_accounts: BankAccount[];
  directors: Director[];
  authorized_capital?: number;
  paid_up_capital?: number;
  auditor_name?: string;
  auditor_firm_number?: string;
  /** MM-DD, e.g. "03-31". */
  financial_year_end?: string;
  logo_key?: string;
  logo_url?: string;
  notes?: string;
  is_archived: boolean;
  created_at?: string;
  // Computed server-side.
  document_count: number;
  asset_count: number;
  expiring_docs_count: number;
  active_director_count: number;
  has_compliance_gap: boolean;
}

export interface CompanyDocument {
  id: string;
  company_id: string;
  category: string;
  label: string;
  /** "2025-26" for annual filings. */
  financial_year?: string;
  storage_key: string;
  file_name: string;
  file_size_kb?: number;
  mime_type?: string;
  issue_date?: string;
  expiry_date?: string;
  download_url?: string;
  notes?: string;
  uploaded_at?: string;
  is_expiring: boolean;
  is_expired: boolean;
}

export type CompanyCreate = {
  legal_name: string;
  trade_name?: string;
  company_type?: string;
  status?: string;
  industry?: string;
  description?: string;
  incorporation_date?: string;
  incorporation_state?: string;
  cin?: string;
  llpin?: string;
  pan_number?: string;
  tan_number?: string;
  gstin?: string;
  income_tax_ward?: string;
  /** Import Export Code. */
  iec_code?: string;
  /** merchant | manufacturer | both */
  exporter_type?: string;
  aepc_code?: string;
  textile_committee_code?: string;
  /** Udyam (MSME) registration number. */
  msme_number?: string;
  esi_number?: string;
  epf_number?: string;
  professional_tax_number?: string;
  foreign_registration_number?: string;
  foreign_jurisdiction?: string;
  foreign_registration_date?: string;
  foreign_registration_expiry?: string;
  other_registrations?: OtherRegistration[];
  registered_address?: string;
  operational_address?: string;
  phone_number?: string;
  email?: string;
  website?: string;
  bank_accounts?: BankAccount[];
  directors?: Director[];
  authorized_capital?: number;
  paid_up_capital?: number;
  auditor_name?: string;
  auditor_firm_number?: string;
  financial_year_end?: string;
  notes?: string;
};

export type CompanyUpdate = Partial<CompanyCreate> & { logo_key?: string };

export type CompanyDocumentCreate = {
  category: string;
  label: string;
  financial_year?: string;
  storage_key: string;
  file_name: string;
  file_size_kb?: number;
  mime_type?: string;
  issue_date?: string;
  expiry_date?: string;
  notes?: string;
};
