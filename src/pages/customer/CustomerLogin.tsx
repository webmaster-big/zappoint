import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import type { LoginFormData } from '../../types/customer';
import customerService from '../../services/CustomerService';

const carouselSlides = [
  {
    step: '01',
    title: 'Book Attractions',
    description: 'Browse laser tag, bowling, go-karts, arcade games and more. Pick a date, select an available time slot, set your group size, and confirm your reservation.',
    features: ['Browse all attractions', 'Select date & time slot', 'Set group size & book'],
  },
  {
    step: '02',
    title: 'Party Packages',
    description: 'Hosting a birthday or group event? Choose a party package that bundles multiple attractions together. Send digital invitations and let your guests RSVP online.',
    features: ['Bundle attraction packages', 'Send digital invitations', 'Track guest RSVPs'],
  },
  {
    step: '03',
    title: 'Gift Cards',
    description: 'Browse available gift cards by location, purchase one for yourself or someone else, and redeem the code when booking your next visit.',
    features: ['Browse & purchase cards', 'Copy redemption code', 'Redeem on your next visit'],
  },
  {
    step: '04',
    title: 'Your Reservations',
    description: 'See all upcoming and past bookings in one place. View booking details, get your QR code for check-in, and stay updated with notifications.',
    features: ['View booking details', 'QR code check-in', 'Booking notifications'],
  },
];

const GoogleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setLoginProgress] = useState(0);
  const [showGooglePopup, setShowGooglePopup] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselSlides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const animateProgress = useCallback((targetProgress: number, duration: number = 500) => {
    return new Promise<void>((resolve) => {
      setLoginProgress(prev => {
        const startProgress = prev;
        const diff = targetProgress - startProgress;
        const startTime = Date.now();
        const updateProgress = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          setLoginProgress(Math.floor(startProgress + diff * easeProgress));
          if (progress < 1) requestAnimationFrame(updateProgress);
          else { setLoginProgress(targetProgress); resolve(); }
        };
        requestAnimationFrame(updateProgress);
        return startProgress;
      });
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setLoginProgress(0);
    try {
      if (!formData.email || !formData.password) { setError('Please fill in all fields'); setIsLoading(false); return; }
      await animateProgress(20, 400);
      await animateProgress(45, 500);
      const response = await customerService.login(formData.email, formData.password);
      await animateProgress(65, 600);
      if (response.token && response.user) {
        await animateProgress(85, 600);
        localStorage.setItem('zapzone_customer', JSON.stringify({
          id: response.user.id,
          firstName: response.user.first_name || '', lastName: response.user.last_name || '',
          name: response.user.name || `${response.user.first_name || ''} ${response.user.last_name || ''}`.trim(),
          email: response.user.email, phone: response.user.phone,
          address: response.user.address || '', address2: response.user.address2 || '',
          city: response.user.city || '', state: response.user.state || '',
          zip: response.user.zip || '', country: response.user.country || 'US',
          token: response.token, role: response.role,
        }));
        await animateProgress(100, 400);
        setTimeout(() => navigate('/'), 200);
      } else { setError('Login failed. Please try again.'); }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      if (!error) { setTimeout(() => { setIsLoading(false); setLoginProgress(0); }, 500); }
      else { setIsLoading(false); setLoginProgress(0); }
    }
  };

  return (
    <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
      {/* Left — Form */}
      <div className="flex-1 flex flex-col min-h-0 bg-white lg:max-w-[480px] xl:max-w-[520px]">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <div className="ml-auto">
            <img src="/Zap-Zone.png" alt="Zap Zone" className="h-6 object-contain" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-12 overflow-hidden">
          <div className="w-full max-w-sm">
            <Link to="/" className="hidden lg:inline-block mb-4">
              <img src="/Zap-Zone.png" alt="Zap Zone" className="h-8 object-contain" />
            </Link>

            <h1 className="text-xl font-bold text-gray-900 mb-0.5">Log in to your Account</h1>
            <p className="text-sm text-gray-500 mb-3">Welcome back! Select method to log in:</p>

            <button type="button" onClick={() => setShowGooglePopup(true)}
              className="w-full flex items-center justify-center gap-2.5 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              <GoogleIcon className="w-[18px] h-[18px]" /> Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or continue with email</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" name="email" autoComplete="username email" required value={formData.email} onChange={handleChange}
                  className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm text-gray-900 bg-gray-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  placeholder="you@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required
                    value={formData.password} onChange={handleChange}
                    className="w-full h-10 border border-gray-200 rounded-lg px-3 pr-10 text-sm text-gray-900 bg-gray-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                    placeholder="••••••••" />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full h-10 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...
                  </span>
                ) : 'Log in'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/customer/register" className="font-semibold text-blue-600 hover:text-blue-700 transition">Create an account</Link>
            </p>
          </div>
        </div>

        <p className="hidden lg:block text-center text-[11px] text-gray-400 pb-3">
          &copy; {new Date().getFullYear()} Zap Zone. All rights reserved.
        </p>
      </div>

      {/* Right — Carousel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800">
        {/* Subtle dot grid */}
        <div className="absolute inset-0" style={{ opacity: 0.04, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 w-full max-w-lg px-14">
          {/* Section label */}
          <div className="flex items-center gap-3 mb-12">
            <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)' }} />
            <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>What you can do</span>
            <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)' }} />
          </div>

          {/* Carousel content */}
          <div className="relative" style={{ minHeight: '320px' }}>
            {carouselSlides.map((slide, i) => (
              <div key={i} className={`absolute inset-0 flex flex-col transition-all duration-700 ease-out ${
                i === carouselIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
              }`}>
                {/* Step number */}
                <div className="flex items-center gap-3 mb-7">
                  <span style={{ fontSize: '40px', fontWeight: 800, color: 'rgba(255,255,255,0.12)', lineHeight: 1, letterSpacing: '-0.02em' }}>{slide.step}</span>
                  <div style={{ width: '28px', height: '2px', background: 'rgba(255,255,255,0.25)', borderRadius: '1px' }} />
                </div>

                {/* Title — using div instead of h2 to avoid global CSS !important heading override */}
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', marginBottom: '14px', lineHeight: 1.2 }}>{slide.title}</div>

                {/* Description */}
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px', maxWidth: '420px' }}>{slide.description}</p>

                {/* Feature list */}
                <div className="flex flex-col gap-2.5">
                  {slide.features.map((feat, fi) => (
                    <div key={fi} className="flex items-center gap-3">
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(52,211,153,0.7)', flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Carousel indicators */}
          <div className="flex items-center gap-2 mt-6">
            {carouselSlides.map((_, i) => (
              <button key={i} onClick={() => setCarouselIndex(i)}
                style={{
                  height: '6px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.4s ease',
                  width: i === carouselIndex ? '32px' : '12px',
                  background: i === carouselIndex ? '#ffffff' : 'rgba(255,255,255,0.2)',
                }} />
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
              {String(carouselIndex + 1).padStart(2, '0')} / {String(carouselSlides.length).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Google Coming Soon Popup */}
      {showGooglePopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGooglePopup(false)}>
          <div className="bg-white rounded-2xl max-w-xs w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-7 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <GoogleIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Coming Soon!</h3>
              <p className="text-sm text-gray-500 mb-5">Google sign-in is not available yet. Please use your email and password for now.</p>
              <button onClick={() => setShowGooglePopup(false)}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerLogin;
