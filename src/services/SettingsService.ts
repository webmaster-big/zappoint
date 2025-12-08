import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  SettingsAuthorizeNetStatus,
  SettingsConnectAuthorizeNetData,
  SettingsUpdateEmailData,
  SettingsUpdatePasswordData,
  SettingsUser,
  SettingsApiResponse,
  SettingsAuthorizeNetAccount,
  SettingsAuthorizeNetPublicKey,
} from '../types/settings.types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredUser()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Authorize.Net Account Management Service
 */

/**
 * Get Authorize.Net account connection status
 * @returns Connection status and account details
 */
export const getAuthorizeNetAccount = async (): Promise<SettingsAuthorizeNetStatus> => {
  const response = await api.get<SettingsAuthorizeNetStatus>('/authorize-net/account');
  return response.data;
};

/**
 * Get all Authorize.Net accounts (company_admin only)
 * @returns Array of all Authorize.Net accounts across locations
 */
export const getAllAuthorizeNetAccounts = async (): Promise<SettingsApiResponse<SettingsAuthorizeNetAccount[]>> => {
  const response = await api.get<SettingsApiResponse<SettingsAuthorizeNetAccount[]>>('/authorize-net/accounts/all');
  return response.data;
};

/**
 * Connect a new Authorize.Net account
 * @param data - API Login ID, Transaction Key, and Environment
 * @returns Created account details
 */
export const connectAuthorizeNetAccount = async (
  data: SettingsConnectAuthorizeNetData
): Promise<SettingsApiResponse> => {
  const response = await api.post<SettingsApiResponse>('/authorize-net/account', data);
  return response.data;
};

/**
 * Update existing Authorize.Net account
 * @param data - Updated credentials and environment
 * @returns Updated account details
 */
export const updateAuthorizeNetAccount = async (
  data: SettingsConnectAuthorizeNetData
): Promise<SettingsApiResponse> => {
  const response = await api.put<SettingsApiResponse>('/authorize-net/account', data);
  return response.data;
};

/**
 * Disconnect Authorize.Net account
 * @param locationId - Optional location ID for company_admin to disconnect specific location
 * @returns Success message
 */
export const disconnectAuthorizeNetAccount = async (locationId?: number): Promise<SettingsApiResponse> => {
  const url = locationId ? `/authorize-net/account/${locationId}` : '/authorize-net/account';
  const response = await api.delete<SettingsApiResponse>(url);
  return response.data;
};

/**
 * Get public key for Authorize.Net (for Accept.js integration)
 * @param locationId - The location ID to get the public key for
 * @returns API Login ID and Public Client Key (transaction key never exposed)
 */
export const getAuthorizeNetPublicKey = async (locationId: number): Promise<SettingsAuthorizeNetPublicKey> => {
  const response = await api.get<SettingsAuthorizeNetPublicKey>(`/authorize-net/public-key/${locationId}`);
  return response.data;
};

/**
 * User Account Management Service
 */

/**
 * Update user email address
 * @param userId - User ID
 * @param data - New email and password confirmation
 * @returns Updated user data
 */
export const updateUserEmail = async (
  userId: number,
  data: SettingsUpdateEmailData
): Promise<SettingsApiResponse<SettingsUser>> => {
  const response = await api.patch<SettingsApiResponse<SettingsUser>>(
    `/users/${userId}/update-email`,
    data
  );
  return response.data;
};

/**
 * Update user password
 * @param userId - User ID
 * @param data - Current password, new password, and confirmation
 * @returns Success message
 */
export const updateUserPassword = async (
  userId: number,
  data: SettingsUpdatePasswordData
): Promise<SettingsApiResponse> => {
  const response = await api.patch<SettingsApiResponse>(
    `/users/${userId}/update-password`,
    data
  );
  return response.data;
};

/**
 * Theme Management (Local Storage)
 */

/**
 * Save theme color to localStorage
 * @param color - Color name (e.g., 'blue', 'red')
 * @param shade - Shade level (e.g., '500', '800')
 */
export const saveThemeColor = (color: string, shade: string): void => {
  localStorage.setItem('zapzone_theme_color', color);
  localStorage.setItem('zapzone_theme_shade', shade);
  
  // Dispatch custom event to notify other components
  window.dispatchEvent(
    new CustomEvent('zapzone_color_changed', {
      detail: {
        color,
        shade,
        fullColor: `${color}-${shade}`,
      },
    })
  );
};

/**
 * Get saved theme color from localStorage
 * @returns Object with color and shade
 */
export const getThemeColor = (): { color: string; shade: string } => {
  const color = localStorage.getItem('zapzone_theme_color') || 'blue';
  const shade = localStorage.getItem('zapzone_theme_shade') || '800';
  return { color, shade };
};

/**
 * Update stored user data in localStorage
 * @param user - Updated user object
 */
export const updateStoredUser = (user: SettingsUser): void => {
  localStorage.setItem('zapzone_user', JSON.stringify(user));
};

/**
 * Get authentication token from localStorage
 * @returns Token string or null
 */
export const getAuthToken = (): string | null => {
  return getStoredUser()?.token || null;
};
