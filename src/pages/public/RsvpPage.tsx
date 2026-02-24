// src/pages/public/RsvpPage.tsx

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type { RsvpPageData, RsvpSubmitRequest } from '../../types/invitation.types';
import invitationService from '../../services/invitationService';

// ── Confetti ─────────────────────────────────────────────────────────
const ConfettiCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#1d4ed8', '#60a5fa', '#fbbf24', '#f472b6', '#34d399', '#f87171', '#a78bfa', '#fb923c'];
    const count = 120;

    type Piece = {
      x: number; y: number; w: number; h: number;
      color: string; speed: number; angle: number;
      tilt: number; tiltSpeed: number;
    };

    const pieces: Piece[] = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: Math.random() * 2 + 1.5,
      angle: Math.random() * Math.PI * 2,
      tilt: Math.random() * 10 - 5,
      tiltSpeed: (Math.random() - 0.5) * 0.15,
    }));

    let frame: number;
    let done = false;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allBelow = true;
      pieces.forEach(p => {
        if (p.y < canvas.height + 20) allBelow = false;
        p.y += p.speed;
        p.angle += 0.03;
        p.tilt += p.tiltSpeed;
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (!allBelow && !done) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    frame = requestAnimationFrame(draw);
    const stop = setTimeout(() => { done = true; }, 4000);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(stop);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 999 }} />;
};

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-1';

const RsvpPage = () => {
  const { token } = useParams<{ token: string }>();
  const [pageData, setPageData] = useState<RsvpPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{ message: string; rsvp_status: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'declined'>('attending');
  const [guestCount, setGuestCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (token) loadRsvpData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (pageData && !loading) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4500);
      return () => clearTimeout(t);
    }
  }, [pageData, loading]);

  const loadRsvpData = async () => {
    try {
      setLoading(true);
      const res = await invitationService.getRsvpData(token!);
      setPageData(res);
      setFullName(res.invitation.guest_name || '');
      if (res.invitation.has_responded) setSubmitted(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(axiosErr.response?.data?.message || 'This invitation link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Please enter your name';
    if (!email.trim()) errors.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email';
    if (rsvpStatus === 'attending' && guestCount < 1) errors.guestCount = 'At least 1 guest required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: RsvpSubmitRequest = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        rsvp_status: rsvpStatus,
        guest_count: rsvpStatus === 'attending' ? guestCount : 0,
        notes: notes.trim(),
        marketing_opt_in: marketingOptIn,
      };
      const res = await invitationService.submitRsvp(token!, payload);
      setSubmitted(true);
      setConfirmationData(res);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(axiosErr.response?.data?.message || 'Failed to submit RSVP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-7 h-7 border-[3px] border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error && !pageData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-xl border border-gray-100 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1.5">Invalid Invitation</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!pageData) return null;

  const { invitation, party, location, company } = pageData;

  // ── Already Responded / Success ──
  if (submitted) {
    const isAttending = confirmationData?.rsvp_status === 'attending' || invitation.rsvp_status === 'attending';

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white p-7 text-center">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/15">
              {isAttending ? (
                <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'white' }}>
              {isAttending ? 'See You There!' : 'Thanks for Letting Us Know'}
            </h1>
            <p className="text-blue-200 text-sm">Your RSVP has been recorded</p>
          </div>

          <div className="p-6 text-center">
            {isAttending ? (
              <>
                <p className="text-gray-600 text-sm mb-5">We're excited to see you at the party!</p>
                <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2.5 mb-5 border border-gray-100">
                  {[
                    ['Date', party.date],
                    ['Time', formatTime(party.time)],
                    ['Location', location.name],
                    ...(location.address ? [['Address', location.address]] : []),
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-400">{label}</span>
                      <span className="font-medium text-gray-900">{val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-600 text-sm mb-5">
                We'll let {party.host_name} know. If your plans change, feel free to reach out!
              </p>
            )}

            {party.invitation_download_link && (
              <a
                href={party.invitation_download_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Party Invitation
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── RSVP Form ──
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {showConfetti && <ConfettiCanvas />}

      <div className="max-w-lg mx-auto space-y-5">
        {/* Party Header Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white p-7 text-center">
            <p className="text-blue-200/80 text-xs font-semibold uppercase tracking-wider mb-2">You're Invited!</p>
            <h1 className="text-xl font-bold mb-2" style={{ color: 'white' }}>
              {party.host_name} invited you to a party at {company.name || 'Zap Zone'}!
            </h1>
            {party.guest_of_honor_name && (
              <p className="text-blue-200 text-sm">
                Celebrating {party.guest_of_honor_name}
                {party.guest_of_honor_age ? ` — Turning ${party.guest_of_honor_age}!` : ''}
              </p>
            )}
          </div>

          <div className="p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Party Details</h2>
            <div className="space-y-2.5">
              {[
                ['Package', party.package_name],
                ['Date', party.date],
                ['Time', formatTime(party.time)],
                ['Location', location.name],
                ...(location.address ? [['Address', location.address]] : []),
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-900 text-right">{val}</span>
                </div>
              ))}
            </div>

            {party.invitation_download_link && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <a
                  href={party.invitation_download_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold rounded-lg hover:bg-blue-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Party Invitation
                </a>
              </div>
            )}
          </div>
        </div>

        {/* RSVP Form Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">RSVP</h2>
            <p className="text-xs text-gray-500 mt-0.5">Let {party.host_name} know if you can make it!</p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-xs text-red-700">{error}</div>
            )}

            {/* RSVP Status */}
            <div>
              <label className={labelClass}>Will you attend? *</label>
              <div className="flex gap-2.5 mt-1">
                <label
                  className={`flex-1 text-center py-2.5 rounded-lg cursor-pointer transition text-xs font-semibold border ${
                    rsvpStatus === 'attending'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-500'
                  }`}
                >
                  <input type="radio" name="rsvp_status" value="attending" checked={rsvpStatus === 'attending'} onChange={() => setRsvpStatus('attending')} className="sr-only" />
                  Yes, I'll be there!
                </label>
                <label
                  className={`flex-1 text-center py-2.5 rounded-lg cursor-pointer transition text-xs font-semibold border ${
                    rsvpStatus === 'declined'
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-500'
                  }`}
                >
                  <input type="radio" name="rsvp_status" value="declined" checked={rsvpStatus === 'declined'} onChange={() => setRsvpStatus('declined')} className="sr-only" />
                  Sorry, can't make it
                </label>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className={labelClass}>Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setFormErrors(p => ({ ...p, fullName: '' })); }}
                className={`${inputClass} ${formErrors.fullName ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : ''}`}
                placeholder="Your full name"
              />
              {formErrors.fullName && <p className="text-[11px] text-red-600 mt-1">{formErrors.fullName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setFormErrors(p => ({ ...p, email: '' })); }}
                className={`${inputClass} ${formErrors.email ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : ''}`}
                placeholder="your@email.com"
              />
              {formErrors.email && <p className="text-[11px] text-red-600 mt-1">{formErrors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass}>Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className={inputClass}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            {/* Guest Count */}
            {rsvpStatus === 'attending' && (
              <div>
                <label className={labelClass}>Number of guests (including yourself) *</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={guestCount}
                  onChange={e => setGuestCount(parseInt(e.target.value, 10) || 1)}
                  className={`${inputClass} ${formErrors.guestCount ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : ''}`}
                />
                {formErrors.guestCount && <p className="text-[11px] text-red-600 mt-1">{formErrors.guestCount}</p>}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className={labelClass}>Dietary restrictions or special needs <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Any allergies, dietary preferences, or special requirements..."
              />
            </div>

            {/* Marketing Opt-In */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={e => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  Keep me updated on future events, coupons, and offers from {company.name}.
                  <span className="block text-[11px] text-gray-400 mt-1">
                    By checking this box, you consent to receive promotional emails and/or text messages
                    from {company.name}. You can unsubscribe at any time.
                  </span>
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : 'Submit RSVP'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-400 pb-2">
          Powered by {company.name || 'Zap Zone'}
        </div>
      </div>
    </div>
  );
};

export default RsvpPage;
