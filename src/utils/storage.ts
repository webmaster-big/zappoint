export const API_BASE_URL = "https://zapzone-backend-yt1lm2w5.on-forge.com/api"
export const ASSET_URL = "https://zapzone-backend-yt1lm2w5.on-forge.com/storage/"

// Convert 24-hour time format (HH:MM) to 12-hour format (h:MM AM/PM)
export const formatTimeTo12Hour = (time24: string): string => {
  if (!time24) return '';
  
  const [hours24, minutes] = time24.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12; // Convert 0 to 12
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Sanitize user data to ensure no nested objects are stored
export const sanitizeUserData = (userData: any, preserveToken: boolean = false) => {
  if (!userData) return null;
  
  // Get existing token if we need to preserve it
  const existingUser = getStoredUser();
  const tokenToUse = preserveToken && existingUser?.token ? existingUser.token : (userData.token || '');
  
  return {
    id: userData.id,
    company_id: typeof userData.company_id === 'object' ? userData.company_id?.id : userData.company_id,
    location_id: typeof userData.location_id === 'object' ? userData.location_id?.id : userData.location_id,
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

// fetch user from local storage
export const getStoredUser = () => {
  const userData = localStorage.getItem('zapzone_user');
  return userData ? JSON.parse(userData) : null;
};

// Store user data safely (sanitized)
export const setStoredUser = (userData: any, preserveToken: boolean = true) => {
  const sanitized = sanitizeUserData(userData, preserveToken);
  if (sanitized) {
    localStorage.setItem('zapzone_user', JSON.stringify(sanitized));
  }
};
