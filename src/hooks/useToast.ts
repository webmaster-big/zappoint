import { useCallback, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  type: ToastKind;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, type: ToastKind = 'info') => {
    setToast({ message, type });
  }, []);

  const showError = useCallback((err: unknown, fallback = 'Something went wrong') => {
    const msg = err instanceof Error ? err.message : fallback;
    setToast({ message: msg, type: 'error' });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, type: 'success' });
  }, []);

  const clear = useCallback(() => setToast(null), []);

  return { toast, show, showSuccess, showError, clear };
}

export default useToast;
