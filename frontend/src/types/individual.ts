export interface VisaEntry {
  country: string;
  visa_type: string;
  visa_number?: string;
  issue_date?: string;
  expiry_date?: string;
}

export interface Individual {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth?: string;
  relationship_to_owner?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  photo_url?: string;
  aadhaar_number?: string;
  aadhaar_photo_url?: string;
  pan_number?: string;
  pan_photo_url?: string;
  passport_number?: string;
  passport_expiry?: string;
  passport_photo_url?: string;
  driving_license_number?: string;
  voter_id_number?: string;
  skywards_number?: string;
  maharaja_number?: string;
  indigo_chip_number?: string;
  visas: VisaEntry[];
  notes?: string;
  is_archived: boolean;
  created_at?: string;
  asset_count: number;
  active_visa_count: number;
  has_expiring_docs: boolean;
}

export type IndividualCreate = {
  full_name: string;
  date_of_birth?: string;
  relationship_to_owner?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  aadhaar_number?: string;
  pan_number?: string;
  passport_number?: string;
  passport_expiry?: string;
  driving_license_number?: string;
  voter_id_number?: string;
  skywards_number?: string;
  maharaja_number?: string;
  indigo_chip_number?: string;
  visas?: VisaEntry[];
  notes?: string;
};

export type IndividualUpdate = Partial<IndividualCreate> & {
  photo_key?: string;
  aadhaar_photo_key?: string;
  pan_photo_key?: string;
  passport_photo_key?: string;
};

/** doc_type accepted by POST /individuals/:id/documents/upload-url */
export type IdentityDocType = 'aadhaar' | 'pan' | 'passport' | 'photo';
