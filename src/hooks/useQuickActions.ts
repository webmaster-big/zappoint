import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

export interface QuickAction {
  title: string;
  icon: unknown;
  link: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const useQuickActions = <T extends QuickAction>(actions: T[]) => {
  const isAdmin = getStoredUser()?.role === 'company_admin';
  const [hidden, setHidden] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.get('/dashboard-settings')
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setHidden(res.data.data?.hidden_quick_actions ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setHidden([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (next: string[]) => {
    const previous = hidden;
    setHidden(next);
    setSaving(true);
    try {
      await api.put('/dashboard-settings', { hidden_quick_actions: next });
      return true;
    } catch {
      setHidden(previous);
      return false;
    } finally {
      setSaving(false);
    }
  }, [hidden]);

  const toggle = useCallback((title: string) => {
    const next = hidden.includes(title)
      ? hidden.filter((t) => t !== title)
      : [...hidden, title];
    return save(next);
  }, [hidden, save]);

  const visible = isAdmin ? actions : actions.filter((a) => !hidden.includes(a.title));

  return { visible, hidden, toggle, save, isAdmin, loaded, saving };
};
