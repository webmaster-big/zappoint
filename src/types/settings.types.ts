
export interface SettingsLocation {
  id: number;
  name: string;
  city: string;
  state: string;
  booking_window_days?: number | null;  // Max days in advance customers can book (1-365)
}

export interface SettingsAuthorizeNetAccount {
  id: number;
  location_id: number | null;  // null for centralized (company-level) accounts
  label?: string | null;       // human-readable name for centralized accounts
  api_login_id?: string;
  environment: 'sandbox' | 'production';
  is_active: boolean;
  connected_at: string;
  last_tested_at?: string;
  created_at?: string;
  updated_at?: string;
  location?: SettingsLocation | null;
}

export interface SettingsAuthorizeNetStatus {
  connected: boolean;
  account: SettingsAuthorizeNetAccount | null;
}

export interface SettingsConnectAuthorizeNetData {
  api_login_id: string;
  transaction_key: string;
  public_client_key: string; // Public Client Key for Accept.js
  environment: 'sandbox' | 'production';
  location_id?: number | null; // null = centralized; omit or number = specific location
  label?: string;              // human-readable name (used for centralized accounts)
}

export interface SettingsUpdateEmailData {
  new_email: string;
  password: string;
}

export interface SettingsUpdatePasswordData {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

export interface SettingsUser {
  id: number;
  name: string;
  email: string;
  role: string;
  location_id?: number;
  created_at: string;
  updated_at: string;
  token?: string;
}

export interface SettingsApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface SettingsAuthorizeNetPublicKey {
  api_login_id: string;
  client_key: string; // Public Client Key for Accept.js authentication
  environment: 'sandbox' | 'production';
}

export interface SettingsColorOption {
  name: string;
  shades: {
    [key: string]: string;
  };
}
