import type { ReactNode } from 'react';

/** Shared layout + status screens for the public waiver pages (form, kiosk, status). */

const formatDateTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const WaiverShell = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) => (
  <div className="min-h-screen bg-gray-50 py-8 px-4">
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white rounded-xl shadow-sm p-7 text-center">
        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/15">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-1" style={{ color: 'white' }}>
          {title}
        </h1>
        {subtitle && <p className="text-blue-200 text-sm">{subtitle}</p>}
      </div>
      {children}
      <div className="text-center text-[10px] text-gray-400 pb-2">Powered by ZapZone</div>
    </div>
  </div>
);

export const WaiverLoading = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-7 h-7 border-[3px] border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  </div>
);

export const WaiverError = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white max-w-md w-full p-8 rounded-xl border border-gray-100 shadow-sm text-center">
      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h1 className="text-lg font-bold text-gray-900 mb-1.5">Waiver Unavailable</h1>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  </div>
);

const StatusCard = ({
  tone,
  title,
  children,
}: {
  tone: 'success' | 'info';
  title: string;
  children: ReactNode;
}) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white max-w-lg w-full rounded-xl border border-gray-100 shadow-sm overflow-hidden text-center">
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white p-7">
        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/15">
          <svg
            className={`w-6 h-6 ${tone === 'success' ? 'text-emerald-300' : 'text-blue-200'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'white' }}>
          {title}
        </h1>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

export const WaiverSuccess = () => (
  <StatusCard tone="success" title="Waiver Completed!">
    <p className="text-gray-600 text-sm">
      Thank you. Your waiver has been recorded. You're all set for your visit — see you soon!
    </p>
  </StatusCard>
);

export const WaiverCompleted = ({
  submittedAt,
  message,
}: {
  submittedAt?: string;
  message?: string;
}) => (
  <StatusCard tone="info" title="Already Completed">
    <p className="text-gray-600 text-sm mb-3">
      {message || 'This waiver has already been completed for this booking date. No further action is needed.'}
    </p>
    {submittedAt && (
      <p className="text-xs text-gray-400">Completed on {formatDateTime(submittedAt)}</p>
    )}
  </StatusCard>
);
