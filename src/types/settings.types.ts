// Types for: src/pages/admin/Settings.tsx

export interface SettingsLocation {
  id: number;
  name: string;
  city: string;
  state: string;
}

export interface SettingsAuthorizeNetAccount {
  id: number;
  location_id: number;
  api_login_id?: string;
  environment: 'sandbox' | 'production';
  is_active: boolean;
  connected_at: string;
  last_tested_at?: string;
  created_at?: string;
  updated_at?: string;
  location: SettingsLocation;
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
  location_id?: number; // For company_admin to connect for specific location
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

// Public key response from getPublicKey endpoint
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
