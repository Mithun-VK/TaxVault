import type { PaymentEntityType } from './payment';

export type DocumentGroup =
  | 'property'
  | 'vehicle'
  | 'tax'
  | 'insurance'
  | 'bill'
  | 'compliance'
  | 'other';

export type DocumentCategory =
  // Property (canonical checklist)
  | 'patta'
  | 'chitta'
  | 'adangal'
  | 'fmb_sketch'
  | 'parent_document'
  | 'encumbrance' // Encumbrance Certificate (EC)
  | 'a1_registration'
  | 'sale_deed'
  | 'fssai'
  // Legacy property
  | 'deed'
  | 'plan'
  // Vehicle
  | 'rc' // RC (Registration Certificate)
  | 'hypothecation'
  | 'transfer_form'
  // Gold
  | 'jewel_photo'
  | 'purchase_bill'
  // Tax
  | 'tax_receipt'
  | 'tax_notice'
  | 'assessment'
  // Insurance
  | 'policy_doc'
  | 'premium_receipt'
  | 'claim'
  // Bill
  | 'bill_receipt'
  | 'bill_copy'
  // Compliance
  | 'itr'
  | 'gst_return'
  | 'tds_cert'
  // Other
  | 'other'
  // Legacy (existing documents may still carry these)
  | 'income_tax'
  | 'property'
  | 'gst'
  | 'vehicle'
  | 'insurance'
  | 'bills';

export interface TaxDocument {
  id: string;
  label: string;
  category: DocumentCategory;
  financial_year: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  tags: string[];
  entity_type?: PaymentEntityType | null;
  entity_id?: string | null;
  entity_name?: string | null;
  url?: string;
  created_at: string;
}

export interface DocumentMetaCreate {
  label: string;
  category: DocumentCategory;
  financial_year: string;
  tags?: string[];
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  entity_type?: PaymentEntityType | null;
  entity_id?: string | null;
}

export interface DocumentFilters {
  search?: string;
  category?: DocumentCategory | 'all';
  financial_year?: string | 'all';
}

export interface UploadUrlResponse {
  upload_url: string;
  storage_key: string;
}
