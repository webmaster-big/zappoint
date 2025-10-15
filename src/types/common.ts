export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'booking' | 'maintenance' | 'event';
  status: string;
  participants?: number;
}

export interface CheckInData {
  bookingId: string;
  customerName: string;
  checkedInAt: string;
  notes?: string;
}

export type TimeSlot = string;

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

export interface FormErrors {
  [key: string]: string;
}

export interface FormData {
  [key: string]: string | number | boolean | string[] | File | null | undefined;
}