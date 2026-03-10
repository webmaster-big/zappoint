import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import type { RegisterFormData } from '../../types/customer';
import customerService from '../../services/CustomerService';

const countries: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' }, { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' }, { code: 'ES', name: 'Spain' }, { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' }, { code: 'JP', name: 'Japan' }, { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' }, { code: 'KR', name: 'South Korea' }, { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' }, { code: 'CH', name: 'Switzerland' }, { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' }, { code: 'NO', name: 'Norway' }, { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' }, { code: 'IE', name: 'Ireland' }, { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' }, { code: 'NZ', name: 'New Zealand' }, { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' }, { code: 'PH', name: 'Philippines' }, { code: 'TH', name: 'Thailand' },
  { code: 'MY', name: 'Malaysia' }, { code: 'ID', name: 'Indonesia' }, { code: 'VN', name: 'Vietnam' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'SA', name: 'Saudi Arabia' }, { code: 'IL', name: 'Israel' },
  { code: 'ZA', name: 'South Africa' }, { code: 'AR', name: 'Argentina' }, { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' }, { code: 'PE', name: 'Peru' },
];

const usStates: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
];

const inp = 'w-full h-9 border border-gray-200 rounded-lg px-3 text-sm text-gray-900 bg-gray-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const lbl = 'block text-xs font-medium text-gray-700 mb-0.5';

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

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '',
    address: '', address2: '', city: '', state: '', zip: '', country: '',
    agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'billing'>('account');
  const [showGooglePopup, setShowGooglePopup] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselSlides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all required fields'); return false;
    }
    if (formData.state && formData.state.length > 2) { setError('State must be a 2-letter code'); return false; }
    if (formData.country && formData.country.length > 2) { setError('Country must be a 2-letter code'); return false; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return false; }
    if (formData.password.length < 8) { setError('Password must be at least 8 characters'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Please enter a valid email address'); return false; }
    if (!formData.agreeToTerms) { setError('Please agree to the Terms of Service and Privacy Policy'); return false; }
    return true;
  };

  const isAccountTabComplete = (): boolean => !!(
    formData.firstName && formData.lastName && formData.email && formData.phone &&
    formData.password && formData.confirmPassword &&
    formData.password === formData.confirmPassword && formData.password.length >= 8 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
  );

  const isBillingTabComplete = (): boolean => {
    if (formData.state && formData.state.length > 2) return false;
    if (formData.country && formData.country.length > 2) return false;
    return true;
  };

  const isFormValid = () => isAccountTabComplete() && isBillingTabComplete() && formData.agreeToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    if (!validateForm()) { setIsLoading(false); return; }
    try {
      const response = await customerService.register({
        first_name: formData.firstName, last_name: formData.lastName,
        email: formData.email, phone: formData.phone,
        password: formData.password, password_confirmation: formData.confirmPassword,
        ...(formData.address && { address: formData.address }),
        ...(formData.address2 && { address2: formData.address2 }),
        ...(formData.city && { city: formData.city }),
        ...(formData.state && { state: formData.state }),
        ...(formData.zip && { zip: formData.zip }),
        ...(formData.country && { country: formData.country }),
      });
      if (response.success && response.data) {
        localStorage.setItem('zapzone_customer', JSON.stringify({
          id: response.data.id, firstName: formData.firstName, lastName: formData.lastName,
          name: `${formData.firstName} ${formData.lastName}`, email: formData.email, phone: formData.phone,
          address: formData.address, address2: formData.address2, city: formData.city,
          state: formData.state, zip: formData.zip, country: formData.country,
          createdAt: new Date().toISOString(),
        }));
        navigate('/');
      } else { setError(response.message || 'Registration failed. Please try again.'); }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Registration failed. Please try again.');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
      {/* Left — Form */}
      <div className="flex-1 flex flex-col min-h-0 bg-white lg:max-w-[520px] xl:max-w-[560px]">
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

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 lg:px-10 overflow-y-auto">
          <div className="w-full max-w-md py-5 lg:py-6">
            <Link to="/" className="hidden lg:inline-block mb-5">
              <img src="/Zap-Zone.png" alt="Zap Zone" className="h-8 object-contain" />
            </Link>

            <h1 className="text-xl font-bold text-gray-900 mb-0.5">Create your Account</h1>
            <p className="text-sm text-gray-500 mb-4">Get started by selecting a sign-up method:</p>

            <button type="button" onClick={() => setShowGooglePopup(true)}
              className="w-full flex items-center justify-center gap-2.5 h-9 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              <GoogleIcon className="w-[18px] h-[18px]" /> Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or continue with email</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}

            <form className="space-y-3" onSubmit={handleSubmit}>
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button type="button" onClick={() => setActiveTab('account')}
                  className={`flex-1 pb-2 text-sm font-semibold transition ${
                    activeTab === 'account' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <span className="flex items-center justify-center gap-1.5">
                    Account Info
                    {isAccountTabComplete() && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </button>
                <button type="button" onClick={() => setActiveTab('billing')}
                  className={`flex-1 pb-2 text-sm font-semibold transition ${
                    activeTab === 'billing' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <span className="flex items-center justify-center gap-1.5">
                    Billing Info
                    {isBillingTabComplete() && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>

              {/* Account Tab */}
              {activeTab === 'account' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={lbl}>First Name</label>
                      <input type="text" name="firstName" autoComplete="given-name" required value={formData.firstName} onChange={handleChange} className={inp} placeholder="First name" />
                    </div>
                    <div>
                      <label className={lbl}>Last Name</label>
                      <input type="text" name="lastName" autoComplete="family-name" required value={formData.lastName} onChange={handleChange} className={inp} placeholder="Last name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={lbl}>Email</label>
                      <input type="email" name="email" autoComplete="email" required value={formData.email} onChange={handleChange} className={inp} placeholder="you@email.com" />
                    </div>
                    <div>
                      <label className={lbl}>Phone</label>
                      <input type="tel" name="phone" autoComplete="tel" required value={formData.phone} onChange={handleChange} className={inp} placeholder="Phone number" />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} name="password" autoComplete="new-password" required
                        value={formData.password} onChange={handleChange} className={`${inp} pr-10`} placeholder="Min. 8 characters" />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Confirm Password</label>
                    <div className="relative">
                      <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" autoComplete="new-password" required
                        value={formData.confirmPassword} onChange={handleChange} className={`${inp} pr-10`} placeholder="Re-enter password" />
                      <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {!isAccountTabComplete() && (
                    <p className="text-[11px] text-amber-600 bg-amber-50/80 border border-amber-100 rounded-lg px-3 py-1.5">
                      Complete all required fields to continue
                    </p>
                  )}
                  <button type="button" onClick={() => { if (isAccountTabComplete()) { setActiveTab('billing'); setError(''); } }}
                    disabled={!isAccountTabComplete()}
                    className="w-full h-9 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    Continue to Billing
                  </button>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === 'billing' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-gray-400">Billing information is optional.</p>
                  <div>
                    <label className={lbl}>Street Address <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <input type="text" name="address" autoComplete="address-line1" value={formData.address} onChange={handleChange} className={inp} placeholder="123 Main Street" maxLength={255} />
                  </div>
                  <div>
                    <label className={lbl}>Apt / Suite <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <input type="text" name="address2" autoComplete="address-line2" value={formData.address2} onChange={handleChange} className={inp} placeholder="Apt 4B, Suite 200" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={lbl}>City <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <input type="text" name="city" autoComplete="address-level2" value={formData.city} onChange={handleChange} className={inp} placeholder="City" maxLength={100} />
                    </div>
                    <div>
                      <label className={lbl}>State <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <select name="state" autoComplete="address-level1" value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))} className={inp}>
                        <option value="">Select...</option>
                        {usStates.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={lbl}>ZIP Code <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <input type="text" name="zip" autoComplete="postal-code" value={formData.zip} onChange={handleChange} className={inp} placeholder="12345" maxLength={10} />
                    </div>
                    <div>
                      <label className={lbl}>Country <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <select name="country" autoComplete="country" value={formData.country}
                        onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))} className={inp}>
                        <option value="">Select...</option>
                        {countries.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <input id="terms" type="checkbox" checked={formData.agreeToTerms}
                      onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))} required
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mt-0.5" />
                    <label htmlFor="terms" className="text-xs text-gray-600 leading-relaxed">
                      I agree to the{' '}
                      <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-600 hover:text-blue-700 underline font-medium">Terms of Service</button>
                      {' '}and{' '}
                      <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-blue-600 hover:text-blue-700 underline font-medium">Privacy Policy</button>
                    </label>
                  </div>

                  <div className="flex gap-2.5">
                    <button type="button" onClick={() => setActiveTab('account')}
                      className="flex-1 h-9 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                      Back
                    </button>
                    <button type="submit" disabled={isLoading || !isFormValid()}
                      className="flex-1 h-9 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...
                        </span>
                      ) : 'Create Account'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className="mt-3 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/customer/login" className="font-semibold text-blue-600 hover:text-blue-700 transition">Sign in</Link>
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

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Terms of Service</h3>
              <button onClick={() => setShowTermsModal(false)} className="p-1 hover:bg-white/15 rounded-md transition text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 text-xs text-gray-600 space-y-3">
              <p className="text-[11px] text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
              {[
                ['1. Acceptance of Terms', 'By accessing and using Zap Zone\'s services, you accept and agree to be bound by the terms and provision of this agreement.'],
                ['2. Use of Services', 'You agree to use our services only for lawful purposes. You must be at least 18 years old to create an account.'],
                ['3. Booking and Reservations', 'All bookings are subject to availability. We reserve the right to cancel or modify reservations.'],
                ['4. Payment Terms', 'Payment is required at the time of booking unless otherwise specified.'],
                ['5. User Accounts', 'You are responsible for maintaining the confidentiality of your account credentials.'],
                ['6. Limitation of Liability', 'Zap Zone shall not be liable for any indirect, incidental, special, consequential or punitive damages.'],
                ['7. Changes to Terms', 'We reserve the right to modify these terms at any time.'],
              ].map(([title, body]) => (
                <div key={title}><h4 className="font-semibold text-gray-800 mb-0.5">{title}</h4><p className="leading-relaxed">{body}</p></div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowTermsModal(false)} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPrivacyModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Privacy Policy</h3>
              <button onClick={() => setShowPrivacyModal(false)} className="p-1 hover:bg-white/15 rounded-md transition text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 text-xs text-gray-600 space-y-3">
              <p className="text-[11px] text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
              {[
                ['1. Information We Collect', 'We collect personal information including your name, email address, phone number, and payment information.'],
                ['2. How We Use Your Information', 'We use your information to process bookings, send confirmations, and improve our services.'],
                ['3. Data Security', 'We implement appropriate security measures to protect your personal information.'],
                ['4. Sharing of Information', 'We do not sell your personal information.'],
                ['5. Cookies and Tracking', 'We use cookies and similar technologies to enhance your browsing experience.'],
                ['6. Your Rights', 'You have the right to access, correct, or delete your personal information.'],
                ['7. Children\'s Privacy', 'Our services are not directed to children under 13.'],
                ['8. Contact Us', 'If you have questions, contact us at privacy@zapzone.com.'],
              ].map(([title, body]) => (
                <div key={title}><h4 className="font-semibold text-gray-800 mb-0.5">{title}</h4><p className="leading-relaxed">{body}</p></div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowPrivacyModal(false)} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Google Coming Soon Popup */}
      {showGooglePopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGooglePopup(false)}>
          <div className="bg-white rounded-2xl max-w-xs w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-7 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <GoogleIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Coming Soon!</h3>
              <p className="text-sm text-gray-500 mb-5">Google sign-up is not available yet. Please register using your email for now.</p>
              <button onClick={() => setShowGooglePopup(false)}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerRegister;
