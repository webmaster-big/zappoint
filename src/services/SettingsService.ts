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

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

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


export const getAuthorizeNetAccount = async (): Promise<SettingsAuthorizeNetStatus> => {
  const response = await api.get<SettingsAuthorizeNetStatus>('/authorize-net/account');
  return response.data;
};

export const getAllAuthorizeNetAccounts = async (): Promise<SettingsApiResponse<SettingsAuthorizeNetAccount[]>> => {
  const response = await api.get<SettingsApiResponse<SettingsAuthorizeNetAccount[]>>('/authorize-net/accounts/all');
  return response.data;
};

export const connectAuthorizeNetAccount = async (
  data: SettingsConnectAuthorizeNetData
): Promise<SettingsApiResponse> => {
  const response = await api.post<SettingsApiResponse>('/authorize-net/account', data);
  return response.data;
};

export const updateAuthorizeNetAccount = async (
  data: SettingsConnectAuthorizeNetData
): Promise<SettingsApiResponse> => {
  const response = await api.put<SettingsApiResponse>('/authorize-net/account', data);
  return response.data;
};

export const disconnectAuthorizeNetAccount = async (locationId?: number): Promise<SettingsApiResponse> => {
  const url = locationId ? `/authorize-net/account/${locationId}` : '/authorize-net/account';
  const response = await api.delete<SettingsApiResponse>(url);
  return response.data;
};

export const getAuthorizeNetPublicKey = async (locationId: number): Promise<SettingsAuthorizeNetPublicKey> => {
  const response = await api.get<SettingsAuthorizeNetPublicKey>(`/authorize-net/public-key/${locationId}`);
  return response.data;
};

export const debugAuthorizeNetCredentials = async (locationId: number): Promise<any> => {
  const response = await api.get<any>(`/authorize-net/debug/${locationId}`);
  console.log('🔍 === AUTHORIZE.NET DEBUG INFO ===');
  console.log('Location ID:', locationId);
  console.log('Response:', response.data);
  console.log('===================================');
  return response.data;
};


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


export const saveThemeColor = (color: string, shade: string): void => {
  localStorage.setItem('zapzone_theme_color', color);
  localStorage.setItem('zapzone_theme_shade', shade);
  
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

export const getThemeColor = (): { color: string; shade: string } => {
  const color = localStorage.getItem('zapzone_theme_color') || 'blue';
  const shade = localStorage.getItem('zapzone_theme_shade') || '800';
  return { color, shade };
};

export const updateStoredUser = (user: SettingsUser): void => {
  localStorage.setItem('zapzone_user', JSON.stringify(user));
};

export const getAuthToken = (): string | null => {
  return getStoredUser()?.token || null;
};
