export * from './asset';
export * from './individual';
export * from './company';
export * from './insurance';
export * from './tax';
export * from './bill';
export * from './payment';
export * from './document';
export * from './alert';
export * from './dashboard';
export * from './report';

import type { PayableEntityType } from './payment';

export type UserRole = 'super_admin' | 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  device_tokens: string[];
  is_active: boolean;
  role: UserRole;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
}

/** Login/register only return tokens - the profile is fetched separately via /users/me. */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/** A unified payable obligation used by the dashboard calendar and deadline lists. */
export interface Payable {
  id: string;
  entity_type: PayableEntityType;
  entity_id: string;
  name: string;
  amount: number;
  due_date: string;
  status: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}
