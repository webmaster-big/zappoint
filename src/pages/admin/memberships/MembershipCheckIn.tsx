import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  ScanLine,
  Keyboard,
  QrCode,
  User as UserIcon,
  MapPin,
  Clock,
  RotateCcw,
  Upload,
  Ticket,
} from 'lucide-react';
import membershipService from '../../../services/MembershipService';
import { membershipCache } from '../../../services/MembershipCacheService';
import type { MembershipScanResponse } from '../../../types/Membership.types';
import { API_BASE_URL, getImageUrl, getStoredUser } from '../../../utils/storage';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import MembershipStatusBadge from '../../../components/membership/MembershipStatusBadge';
import { useToast } from '../../../hooks/useToast';
import { useThemeColor } from '../../../hooks/useThemeColor';

const MembershipCheckIn = () => {
  const { themeColor } = useThemeColor();
  const [qr, setQr] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<MembershipScanResponse | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [overrideNote, setOverrideNote] = useState('');
  const [passNote, setPassNote] = useState<Record<number, string>>({}); // benefitId → note
  const [streamActive, setStreamActive] = useState(false);
  const { toast, show, showError, clear } = useToast();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const user = getStoredUser();
  const isCompanyAdmin = user?.role === 'company_admin';
  const fixedLocationId: number | undefined = user?.location_id || user?.locations?.[0]?.id;

  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | undefined>(fixedLocationId);

  const locationId = isCompanyAdmin ? selectedLocationId : fixedLocationId;

  const fetchLocations = useCallback(async () => {
    if (!isCompanyAdmin) return;
    try {
      const res = await fetch(`${API_BASE_URL}/locations`, {
        headers: { Authorization: `Bearer ${user?.token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      const list: { id: number; name: string }[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setLocations(list);
      if (list.length > 0 && !selectedLocationId) setSelectedLocationId(list[0].id);
    } catch { /* silently ignore */ }
  }, [isCompanyAdmin, user?.token]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = await scannerRef.current.getState();
        if (state === 2) await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {/* ignore */}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startScanner = async () => {
    setScanning(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
      scannerRef.current = new Html5Qrcode('qr-reader');
      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async (decoded) => {
          await stopScanner();
          setQr(decoded);
          await doScan(decoded);
        },
        () => { /* ignore frame errors */ }
      );
    } catch (e: unknown) {
      showError(e, 'Camera error');
      setScanning(false);
    }
  };

  useEffect(() => { void fetchLocations(); return () => { stopScanner(); }; }, [fetchLocations]);

  const doScan = async (token: string) => {
    try {
      const res = await membershipService.scanMembershipQr(token, locationId);
      setResult(res);
      setPhotoDataUrl(null);
      setOverrideNote('');
      setPassNote({});
    } catch (e: unknown) {
      showError(e, 'Scan failed');
    }
  };

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qr.trim()) doScan(qr.trim());
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setStreamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: unknown) {
      showError(e, 'Camera denied');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    closeCamera();
  };

  const handleFileUpload = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      show('Please choose an image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      show('Image must be under 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        closeCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const dataUrlToFile = (dataUrl: string, name = 'photo.jpg'): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new File([u8], name, { type: mime });
  };

  const handleCheckIn = async (action: 'allowed' | 'denied' | 'override') => {
    if (!result || !locationId) return;
    setActing(action);
    try {
      if (action === 'allowed' && result.photo_required && photoDataUrl) {
        await membershipService.uploadMembershipPhoto(result.membership.id, dataUrlToFile(photoDataUrl));
      }
      await membershipService.checkInMembership(result.membership.id, {
        result: action,
        location_id: locationId,
        override_note: action === 'override' ? overrideNote : undefined,
      });
      show(`Check-in ${action}`, action === 'denied' ? 'info' : 'success');
      void membershipCache.invalidate('list');
      setTimeout(() => { setResult(null); setQr(''); setPhotoDataUrl(null); setOverrideNote(''); setPassNote({}); }, 1200);
    } catch (e: unknown) {
      showError(e, 'Check-in failed');
    } finally {
      setActing(null);
    }
  };

  const handleRedeemPass = async (benefitId: number) => {
    if (!result || !locationId) return;
    const key = `pass-${benefitId}`;
    setActing(key);
    try {
      const updated = await membershipService.redeemPass(
        result.membership.id,
        benefitId,
        locationId,
        passNote[benefitId] || undefined
      );
      // Update passes count in place so staff can see remaining count drop
      setResult((prev) => prev ? { ...prev, passes: updated.passes } : prev);
      show('Pass redeemed — member admitted', 'success');
      void membershipCache.invalidate('list');
      setTimeout(() => { setResult(null); setQr(''); setPhotoDataUrl(null); setOverrideNote(''); setPassNote({}); }, 1400);
    } catch (e: unknown) {
      showError(e, 'Pass redemption failed');
    } finally {
      setActing(null);
    }
  };

  const resetScan = () => {
    setResult(null);
    setQr('');
    setPhotoDataUrl(null);
    setOverrideNote('');
    setPassNote({});
    closeCamera();
  };

  const m = result?.membership;
  const eligible = !!result?.eligibility?.eligible;
  const reason = result?.eligibility?.reason;
  const photoRequired = !!result?.photo_required;
  const hasAvailablePasses = !eligible && (result?.passes ?? []).some(
    (p) => p.remaining === null || p.remaining > 0
  );

  const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-100';
  const inputCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          Membership Check-In
          <InfoTooltip
            widthClass="w-80"
            content={
              <>
                <p className="font-semibold mb-1">How check-in works</p>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>Member shows their QR code (from My Membership in the customer app).</li>
                  <li>Scan with the camera or paste the token manually.</li>
                  <li>The system verifies status, visit allowance and location access.</li>
                  <li>If first visit, capture a member photo for future identification.</li>
                  <li>Approve, Deny, or Manual Override with a staff note.</li>
                </ol>
              </>
            }
          />
        </h1>
        <p className="text-gray-600 mt-1">Scan a member QR code or paste a token to verify eligibility.</p>
      </div>

      {isCompanyAdmin ? (
        <div className="flex items-center gap-3 mb-4">
          <MapPin size={16} className="text-gray-500 flex-shrink-0" />
          <label className="text-sm font-medium text-gray-700 flex-shrink-0">Check-in location:</label>
          <select
            value={selectedLocationId ?? ''}
            onChange={(e) => setSelectedLocationId(Number(e.target.value) || undefined)}
            className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
          >
            {locations.length === 0 && <option value="">Loading locations…</option>}
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
      ) : !locationId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2 mb-4">
          <ShieldAlert size={16} /> No location detected on your account — check-ins cannot be saved.
        </div>
      ) : null}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className={cardCls}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className={`p-2 rounded-lg bg-${themeColor}-100 text-${themeColor}-600`}>
                <ScanLine size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-1">
                  Scanner
                  <InfoTooltip content="Use a webcam to scan the member's QR, or type the token shown under their QR image in the customer app." />
                </h3>
                <p className="text-xs text-gray-500">Camera or manual token entry</p>
              </div>
            </div>

            <div className="relative bg-gray-900" style={{ minHeight: 280 }}>
              <div id="qr-reader" className="mx-auto" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <QrCode size={56} className="opacity-30 mb-2" />
                  <p className="text-xs uppercase tracking-wider">Camera idle</p>
                </div>
              )}
            </div>

            <div className="p-5 space-y-3">
              {!scanning ? (
                <StandardButton fullWidth variant="primary" size="md" icon={Camera} onClick={startScanner}>
                  Start Camera Scanner
                </StandardButton>
              ) : (
                <StandardButton fullWidth variant="danger" size="md" icon={XCircle} onClick={stopScanner}>
                  Stop Camera
                </StandardButton>
              )}

              <form onSubmit={onManualSubmit} className="space-y-2">
                <label className="text-xs font-medium text-gray-800 flex items-center gap-1">
                  <Keyboard size={12} /> Manual Token
                  <InfoTooltip content="The member's QR token starts with 'mbr_'. Useful if the camera is unavailable or the printed QR is damaged." />
                </label>
                <div className="flex gap-2">
                  <input
                    value={qr}
                    onChange={(e) => setQr(e.target.value)}
                    placeholder="mbr_…"
                    className={`${inputCls} font-mono`}
                  />
                  <StandardButton type="submit" variant="secondary" size="md">Scan</StandardButton>
                </div>
              </form>
            </div>
          </div>

          {result && (
            <StandardButton fullWidth variant="ghost" size="sm" icon={RotateCcw} onClick={resetScan}>
              Scan Next Member
            </StandardButton>
          )}
        </div>

        <div className="lg:col-span-3">
          {!result && (
            <div className={`${cardCls} p-10 text-center min-h-[400px] flex flex-col items-center justify-center`}>
              <div className={`p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                <ScanLine className={`w-12 h-12 text-${themeColor}-500`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Waiting for a scan</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Member details and an eligibility check will appear here as soon as a QR code is scanned or a token is submitted.
              </p>
            </div>
          )}

          {result && m && (
            <div className={`${cardCls} overflow-hidden`}>
              <div className={`px-5 py-4 flex items-center justify-between ${eligible ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'}`}>
                <div className="flex items-center gap-3">
                  {eligible ? (
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  ) : (
                    <XCircle className="w-7 h-7 text-red-600" />
                  )}
                  <div>
                    <p className={`text-lg font-bold ${eligible ? 'text-green-800' : 'text-red-800'}`}>
                      {eligible ? 'Eligible to Check In' : 'Check-In Denied'}
                    </p>
                    <p className={`text-xs ${eligible ? 'text-green-700' : 'text-red-700'}`}>
                      {eligible ? 'Member passes all checks below' : reason || 'Member is not currently eligible'}
                    </p>
                  </div>
                </div>
                <InfoTooltip
                  widthClass="w-72"
                  content={
                    eligible
                      ? 'Status is active, location is approved, daily limit not exceeded, and visit allowance available.'
                      : 'The membership failed one of: status check, location access, daily visit limit, or remaining-visit count.'
                  }
                />
              </div>

              <div className="p-5 flex items-start gap-4 border-b border-gray-100">
                {m.photo_path ? (
                  <img
                    src={getImageUrl(m.photo_path)}
                    alt="member"
                    className="w-28 h-28 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 flex-shrink-0">
                    <UserIcon size={28} />
                    <span className="text-[10px] mt-1 uppercase">No photo</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 truncate">
                    {m.customer?.first_name} {m.customer?.last_name}
                  </h2>
                  <p className="text-sm text-gray-600 truncate">{m.customer?.email}</p>
                  {m.customer?.phone && <p className="text-xs text-gray-500">{m.customer.phone}</p>}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-${themeColor}-50 text-${themeColor}-700 text-xs font-medium border border-${themeColor}-100`}>
                      {m.plan?.name}
                    </span>
                    <MembershipStatusBadge status={m.status} size="sm" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Clock size={11} /> Today
                    <InfoTooltip content="Number of times this member has already checked in today across all locations." />
                  </p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{result.visits_today}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
                    <UserIcon size={11} /> Visits Left
                    <InfoTooltip content="Remaining visits for this term. Empty for unlimited plans." />
                  </p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{m.visits_remaining ?? '∞'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
                    <MapPin size={11} /> Home
                    <InfoTooltip content="Member's home location. Plans with 'single' access only allow check-ins here." />
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{m.home_location?.name || '—'}</p>
                </div>
              </div>

              {!eligible && reason && (
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Reason</p>
                    <p>{reason}</p>
                  </div>
                </div>
              )}

              {result.passes && result.passes.length > 0 && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                    <Ticket size={12} /> Available Passes
                    <InfoTooltip content="Free entry / guest passes this membership can redeem. Click 'Use' to admit this member and record the redemption." />
                  </p>
                  <div className="space-y-2">
                    {result.passes.map((pass) => {
                      const hasRemaining = pass.remaining === null || pass.remaining > 0;
                      return (
                        <div key={pass.benefit_id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-800 capitalize">
                              {pass.label || pass.benefit_type.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${
                                !hasRemaining ? 'text-red-500' :
                                pass.remaining !== null && pass.remaining <= 2 ? 'text-amber-600' :
                                `text-${themeColor}-700`
                              }`}>
                                {pass.remaining === null ? 'Unlimited' : `${pass.remaining} left`}
                              </span>
                              {hasRemaining && (
                                <StandardButton
                                  variant="primary"
                                  size="sm"
                                  loading={acting === `pass-${pass.benefit_id}`}
                                  onClick={() => handleRedeemPass(pass.benefit_id)}
                                >
                                  Use Pass
                                </StandardButton>
                              )}
                            </div>
                          </div>
                          {hasRemaining && (
                            <input
                              type="text"
                              placeholder="Optional note (e.g. guest name)"
                              value={passNote[pass.benefit_id] ?? ''}
                              onChange={(e) => setPassNote((prev) => ({ ...prev, [pass.benefit_id]: e.target.value }))}
                              className="mt-2 w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {eligible && photoRequired && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className={`border-2 border-dashed border-${themeColor}-300 bg-${themeColor}-50 rounded-xl p-4`}>
                    <p className={`font-semibold text-${themeColor}-900 mb-1 flex items-center gap-1`}>
                      <Camera size={14} /> Member photo required
                      <InfoTooltip content="Plan requires a staff-verified photo on the member's first visit. This helps prevent membership sharing and speeds up future check-ins." />
                    </p>
                    <p className="text-xs text-gray-600 mb-3">First visit — capture a clear face photo before approving.</p>
                    {photoDataUrl ? (
                      <div className="flex items-center gap-3">
                        <img src={photoDataUrl} alt="capture" className="w-32 h-32 rounded-lg object-cover border border-gray-200" />
                        <div className="flex flex-col gap-2">
                          <StandardButton variant="secondary" size="sm" icon={RotateCcw} onClick={() => { setPhotoDataUrl(null); openCamera(); }}>Retake</StandardButton>
                          <label className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
                            <Upload size={12} /> Replace from file
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0])} />
                          </label>
                        </div>
                      </div>
                    ) : streamActive ? (
                      <div className="space-y-2">
                        <video ref={videoRef} className="w-full max-w-sm rounded-lg border border-gray-200 bg-black" muted playsInline />
                        <div className="flex gap-2">
                          <StandardButton variant="primary" size="sm" icon={Camera} onClick={capturePhoto}>Capture</StandardButton>
                          <StandardButton variant="secondary" size="sm" onClick={closeCamera}>Cancel</StandardButton>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(`bg-${themeColor}-100`); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove(`bg-${themeColor}-100`); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove(`bg-${themeColor}-100`);
                          handleFileUpload(e.dataTransfer.files?.[0]);
                        }}
                        className="flex flex-col sm:flex-row items-stretch gap-2"
                      >
                        <StandardButton variant="primary" size="sm" icon={Camera} onClick={openCamera}>Open Camera</StandardButton>
                        <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border-2 border-dashed border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 cursor-pointer transition">
                          <Upload size={14} />
                          Upload from file <span className="text-gray-400">(or drag &amp; drop)</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0])} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!eligible && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <label className="text-xs font-medium text-gray-800 flex items-center gap-1 mb-1">
                    Manual override note
                    <InfoTooltip content="Required if you choose to admit this member despite the failed eligibility check. Recorded in the audit log with your user ID." />
                  </label>
                  <textarea
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    rows={2}
                    className={inputCls}
                    placeholder="e.g. Manager approved exception, payment will be settled at desk…"
                  />
                </div>
              )}

              <div className="px-5 py-4 bg-gray-50 space-y-3">
                {hasAvailablePasses && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Ticket size={13} className="flex-shrink-0" />
                    <span>This member has passes available above — use a pass to admit rather than a manual override.</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <StandardButton
                    variant="danger"
                    size="md"
                    icon={XCircle}
                    loading={acting === 'denied'}
                    onClick={() => handleCheckIn('denied')}
                  >
                    Deny
                  </StandardButton>
                  {eligible ? (
                    <StandardButton
                      variant="success"
                      size="md"
                      icon={CheckCircle2}
                      loading={acting === 'allowed'}
                      disabled={photoRequired && !photoDataUrl}
                      onClick={() => handleCheckIn('allowed')}
                    >
                      Approve Check-In
                    </StandardButton>
                  ) : (
                    <StandardButton
                      variant={hasAvailablePasses ? 'secondary' : 'primary'}
                      size="md"
                      icon={ShieldAlert}
                      loading={acting === 'override'}
                      disabled={!overrideNote.trim()}
                      onClick={() => handleCheckIn('override')}
                    >
                      Manual Override
                    </StandardButton>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MembershipCheckIn;
