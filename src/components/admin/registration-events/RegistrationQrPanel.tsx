import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, Eye, Printer, Tablet } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import type { RegistrationEventSummary } from '../../../types/eventRegistration.types';
import { generateQRCode } from '../../../utils/qrcode';
import { formatDateLong } from '../../../utils/timeFormat';
import { locationDisplayName } from '../../../utils/locationName';
import { fileSlug } from './registrationEventUi';

interface RegistrationQrPanelProps {
  event: RegistrationEventSummary;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

const PRINT_SIZE = 1024;

const openPrintSign = (title: string, lines: string[], url: string, image: string): boolean => {
  const win = window.open('', '_blank', 'width=640,height=860');
  if (!win) return false;
  const doc = win.document;
  doc.title = title;
  const body = doc.body;
  body.style.cssText = 'font-family: Arial, Helvetica, sans-serif; text-align: center; padding: 40px; color: #111827;';
  const heading = doc.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'font-size: 30px; margin: 0 0 12px;';
  body.append(heading);
  lines.forEach((line) => {
    const text = doc.createElement('p');
    text.textContent = line;
    text.style.cssText = 'font-size: 18px; margin: 0 0 8px;';
    body.append(text);
  });
  const img = doc.createElement('img');
  img.src = image;
  img.alt = 'QR code';
  img.style.cssText = 'width: 360px; height: 360px; margin-top: 16px; image-rendering: pixelated;';
  const link = doc.createElement('p');
  link.textContent = url;
  link.style.cssText = 'font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 16px;';
  body.append(img, link);
  img.onload = () => {
    win.focus();
    win.print();
  };
  return true;
};

const RegistrationQrPanel = ({ event, onNotify }: RegistrationQrPanelProps) => {
  const urlRef = useRef<HTMLInputElement>(null);
  const kioskRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);
  const kioskUrl = `${event.public_url}?kiosk=1`;

  const copy = async (value: string, done: string, field: HTMLInputElement | null) => {
    try {
      await navigator.clipboard.writeText(value);
      onNotify(done, 'success');
    } catch {
      field?.focus();
      field?.select();
      onNotify('Copying is blocked here. The link is selected, so press Ctrl+C (or ⌘C) to copy it.', 'info');
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      const image = await generateQRCode(event.public_url, { width: PRINT_SIZE, margin: 4 });
      const link = document.createElement('a');
      link.href = image;
      link.download = `${fileSlug(event.name, 'registration-form')}-qr.png`;
      link.click();
    } catch {
      onNotify('The QR code could not be created. Please try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const print = async () => {
    setBusy('print');
    try {
      const image = await generateQRCode(event.public_url, { width: PRINT_SIZE, margin: 4 });
      const lines = [
        'Scan to register',
        [formatDateLong(event.event_date), event.location_name ? locationDisplayName(event.location_name) : null].filter(Boolean).join(' · '),
      ];
      if (!openPrintSign(event.name, lines, event.public_url, image)) {
        onNotify('The print window was blocked. Allow pop-ups for this site, or use Download QR.', 'info');
      }
    } catch {
      onNotify('The QR code could not be created. Please try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex justify-center sm:block">
          <div className="p-2 bg-white border border-gray-200 rounded-md">
            <QRCodeCanvas value={event.public_url} size={176} level="M" marginSize={4} />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">QR code and link</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Guests scan this code to open this form on their phone. It never changes, even if you rename the form.
            </p>
          </div>
          <div className="flex gap-2">
            <label htmlFor={`registration-url-${event.id}`} className="sr-only">
              Registration link
            </label>
            <input
              ref={urlRef}
              id={`registration-url-${event.id}`}
              readOnly
              value={event.public_url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <StandardButton variant="secondary" size="sm" icon={Copy} onClick={() => void copy(event.public_url, 'Link copied', urlRef.current)}>
              Copy
            </StandardButton>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StandardButton variant="secondary" size="sm" icon={Download} onClick={() => void download()} loading={busy === 'download'} disabled={busy !== null}>
              Download QR
            </StandardButton>
            <StandardButton variant="secondary" size="sm" icon={Printer} onClick={() => void print()} loading={busy === 'print'} disabled={busy !== null}>
              Print sign
            </StandardButton>
            <StandardButton
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => window.open(`${event.public_url}?preview=1`, '_blank', 'noopener')}
            >
              Preview form
            </StandardButton>
          </div>
          <p className="text-xs text-gray-500">Preview shows exactly what guests see but never saves a registration.</p>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <Tablet className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Sign-up tablet at the venue
              </span>
              <StandardButton variant="ghost" size="sm" icon={Copy} onClick={() => void copy(kioskUrl, 'Kiosk link copied', kioskRef.current)}>
                Copy kiosk link
              </StandardButton>
            </div>
            <label htmlFor={`registration-kiosk-url-${event.id}`} className="sr-only">
              Kiosk link
            </label>
            <input
              ref={kioskRef}
              id={`registration-kiosk-url-${event.id}`}
              readOnly
              value={kioskUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="text-xs text-gray-600">
              The kiosk link clears each guest&apos;s details after they register. Open it in a browser that is not signed in to
              ZapZone, turn off the browser&apos;s autofill, and use Guided Access (iPad) or screen pinning (Android).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationQrPanel;
