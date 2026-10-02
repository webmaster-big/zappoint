import { getStoredUser } from './storage';

export const hasStaffSession = (): boolean => {
  try {
    return Boolean(getStoredUser()?.token);
  } catch {
    return false;
  }
};
