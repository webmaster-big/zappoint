const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '');

const configuredApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);

export const API_BASE_URL = configuredApiBaseUrl.endsWith('/api')
  ? configuredApiBaseUrl
  : `${configuredApiBaseUrl}/api`;

export const ASSET_URL = `${API_BASE_URL.replace(/\/api$/, '')}/storage/`;

export const getImageUrl = (img?: string | null | any): string => {
  if (!img) return '';
  
  if (typeof img !== 'string') {
    if (Array.isArray(img) && img.length > 0) {
      img = img[0];
    } else {
      return '';
    }
  }
  
  if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
    return img;
  }
  
  if (img.startsWith(ASSET_URL)) {
    return img;
  }
  
  return ASSET_URL + img;
};

export const formatTimeTo12Hour = (time24: string): string => {
  if (!time24) return '';
  
  const [hours24, minutes] = time24.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12; // Convert 0 to 12
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export const sanitizeUserData = (userData: any, preserveToken: boolean = false) => {
  if (!userData) return null;
  
  const existingUser = getStoredUser();
  const tokenToUse = preserveToken && existingUser?.token ? existingUser.token : (userData.token || '');
  
  return {
    id: userData.id,
    company_id: typeof userData.company_id === 'object' ? userData.company_id?.id : userData.company_id,
    location_id: typeof userData.location_id === 'object' ? userData.location_id?.id : userData.location_id,
    location_name: userData.location_name ||
      (typeof userData.location_id === 'object' ? userData.location_id?.name : null) ||
      userData.location?.name ||
      '',
    first_name: userData.first_name || '',
    last_name: userData.last_name || '',
    email: userData.email || '',
    phone: userData.phone || '',
    password: userData.password || '',
    profile_path: userData.profile_path || '',
    role: userData.role || '',
    employee_id: userData.employee_id || '',
    department: userData.department || '',
    position: userData.position || '',
    shift: userData.shift || '',
    assigned_areas: userData.assigned_areas || '',
    hire_date: userData.hire_date || '',
    status: userData.status || '',
    last_login: userData.last_login || '',
    created_at: userData.created_at || '',
    updated_at: userData.updated_at || '',
    token: tokenToUse
  };
};

export const getStoredUser = () => {
  const userData = localStorage.getItem('zapzone_user');
  return userData ? JSON.parse(userData) : null;
};

export const setStoredUser = (userData: any, preserveToken: boolean = true) => {
  const sanitized = sanitizeUserData(userData, preserveToken);
  if (!sanitized) return;

  let identityChanged = false;
  try {
    const prevRaw = localStorage.getItem('zapzone_user');
    const prevId = prevRaw ? JSON.parse(prevRaw)?.id : null;
    identityChanged = prevId != null && prevId !== sanitized.id;
  } catch {
    identityChanged = true;
  }

  localStorage.setItem('zapzone_user', JSON.stringify(sanitized));

  if (identityChanged && typeof window !== 'undefined' && 'caches' in window) {
    import('./cacheGuard')
      .then((m) => m.purgeAllZapzoneCaches())
      .catch(() => { /* ignore */ });
  }
};
