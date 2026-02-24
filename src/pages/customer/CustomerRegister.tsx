import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import type { RegisterFormData } from '../../types/customer';
import customerService from '../../services/CustomerService';

const countries: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'KR', name: 'South Korea' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
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

const inputClass = 'w-full border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-gray-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelClass = 'block text-sm font-semibold text-gray-700 mb-1';

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '',
    address: '', address2: '', city: '', state: '', zip: '', country: '',
    agreeToTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'billing'>('account');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all required fields');
      return false;
    }
    if (formData.state && formData.state.length > 2) {
      setError('State must be a 2-letter code (e.g., CA, NY)');
      return false;
    }
    if (formData.country && formData.country.length > 2) {
      setError('Country must be a 2-letter code (e.g., US, CA)');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.agreeToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return false;
    }
    return true;
  };

  const isAccountTabComplete = (): boolean => {
    return !!(
      formData.firstName && formData.lastName && formData.email && formData.phone &&
      formData.password && formData.confirmPassword &&
      formData.password === formData.confirmPassword && formData.password.length >= 8 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    );
  };

  const isBillingTabComplete = (): boolean => {
    if (formData.state && formData.state.length > 2) return false;
    if (formData.country && formData.country.length > 2) return false;
    return true;
  };

  const isFormValid = (): boolean => {
    return isAccountTabComplete() && isBillingTabComplete() && formData.agreeToTerms;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    if (!validateForm()) { setIsLoading(false); return; }
    try {
      const response = await customerService.register({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
        ...(formData.address && { address: formData.address }),
        ...(formData.address2 && { address2: formData.address2 }),
        ...(formData.city && { city: formData.city }),
        ...(formData.state && { state: formData.state }),
        ...(formData.zip && { zip: formData.zip }),
        ...(formData.country && { country: formData.country }),
      });

      if (response.success && response.data) {
        localStorage.setItem('zapzone_customer', JSON.stringify({
          id: response.data.id,
          firstName: formData.firstName,
          lastName: formData.lastName,
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          phone: formData.phone,
          address: formData.address, address2: formData.address2,
          city: formData.city, state: formData.state,
          zip: formData.zip, country: formData.country,
          createdAt: new Date().toISOString(),
        }));
        navigate('/');
      } else {
        setError(response.message || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left — Video Panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/3 relative overflow-hidden items-center justify-center">
        <iframe
          src="https://customer-bu7vnagrw6ivkw73.cloudflarestream.com/ced085083150e980c481a28d1eab6747/iframe?muted=true&loop=true&autoplay=true&poster=https%3A%2F%2Fcustomer-bu7vnagrw6ivkw73.cloudflarestream.com%2Fced085083150e980c481a28d1eab6747%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600&controls=false"
          loading="lazy"
          className="absolute top-1/2 left-1/2"
          style={{ border: 'none', width: '100vw', height: '100vh', transform: 'translate(-50%, -50%)', minWidth: '100%', minHeight: '100%' }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen={true}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-blue-800/70 to-violet-700/75 z-10" />
        <div className="relative z-20 flex flex-col items-center justify-center px-16 w-full">
          <div className="max-w-lg text-center space-y-6">
            <Link to="/">
              <img src="/Zap-Zone.png" alt="Zap Zone Logo" className="w-36 h-14 object-contain mx-auto mb-6 cursor-pointer hover:opacity-80 transition" />
            </Link>
            <h2 className="text-3xl font-bold text-white tracking-tight">Join the Adventure Today!</h2>
            <p className="text-blue-200 text-sm leading-relaxed">
              Create your account and unlock access to exclusive attractions, special packages, and unforgettable experiences.
            </p>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 max-w-full lg:w-1/2 xl:w-1/3 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 px-4 py-5">
          <Link to="/" className="inline-flex items-center text-white hover:text-blue-100 transition mb-3 text-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold text-white mb-0.5">Join the Adventure!</h1>
          <p className="text-blue-200 text-sm">Create your account to get started</p>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center py-6 lg:py-10 px-4 sm:px-6 lg:px-10 xl:px-14">
          <div className="mx-auto w-full max-w-lg">
            <div className="mb-6">
              <h1 className="hidden lg:block text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
              <h1 className="lg:hidden text-xl font-bold text-gray-900 mb-1">Create account</h1>
              <p className="text-gray-500 text-sm">
                Already have an account?{' '}
                <Link to="/customer/login" className="font-semibold text-blue-700 hover:text-blue-600 transition">Sign in</Link>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-3 py-2.5 text-sm rounded-lg mb-4">
                {error}
              </div>
            )}

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('account')}
                  className={`flex-1 py-2.5 text-sm font-semibold transition relative ${
                    activeTab === 'account' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    Account Info
                    {isAccountTabComplete() && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className={`flex-1 py-2.5 text-sm font-semibold transition relative ${
                    activeTab === 'billing' ? 'text-blue-700 border-b-2 border-blue-700' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
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
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>First Name</label>
                      <input type="text" name="firstName" autoComplete="given-name" required value={formData.firstName} onChange={handleChange} className={inputClass} placeholder="First name" />
                    </div>
                    <div>
                      <label className={labelClass}>Last Name</label>
                      <input type="text" name="lastName" autoComplete="family-name" required value={formData.lastName} onChange={handleChange} className={inputClass} placeholder="Last name" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input type="email" name="email" autoComplete="email" required value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@email.com" />
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input type="tel" name="phone" autoComplete="tel" required value={formData.phone} onChange={handleChange} className={inputClass} placeholder="Phone number" />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password" autoComplete="new-password" required
                        value={formData.password} onChange={handleChange}
                        className={`${inputClass} pr-10`}
                        placeholder="Min. 8 characters"
                      />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword" autoComplete="new-password" required
                        value={formData.confirmPassword} onChange={handleChange}
                        className={`${inputClass} pr-10`}
                        placeholder="Re-enter password"
                      />
                      <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {!isAccountTabComplete() && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Complete all required fields to continue
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => { if (isAccountTabComplete()) { setActiveTab('billing'); setError(''); } }}
                    disabled={!isAccountTabComplete()}
                    className="w-full py-2.5 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue to Billing
                  </button>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === 'billing' && (
                <div className="space-y-4">
                  <p className="text-[11px] text-gray-400">Billing information is optional.</p>

                  <div>
                    <label className={labelClass}>Street Address <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <input type="text" name="address" autoComplete="address-line1" value={formData.address} onChange={handleChange} className={inputClass} placeholder="123 Main Street" maxLength={255} />
                  </div>

                  <div>
                    <label className={labelClass}>Apt / Suite <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <input type="text" name="address2" autoComplete="address-line2" value={formData.address2} onChange={handleChange} className={inputClass} placeholder="Apt 4B, Suite 200" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>City <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <input type="text" name="city" autoComplete="address-level2" value={formData.city} onChange={handleChange} className={inputClass} placeholder="City" maxLength={100} />
                    </div>
                    <div>
                      <label className={labelClass}>State <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <select
                        name="state" autoComplete="address-level1" value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Select...</option>
                        {usStates.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>ZIP Code <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <input type="text" name="zip" autoComplete="postal-code" value={formData.zip} onChange={handleChange} className={inputClass} placeholder="12345" maxLength={10} />
                    </div>
                    <div>
                      <label className={labelClass}>Country <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <select
                        name="country" autoComplete="country" value={formData.country}
                        onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Select...</option>
                        {countries.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <input
                      id="terms" type="checkbox" checked={formData.agreeToTerms}
                      onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
                      required className="h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500 mt-0.5"
                    />
                    <label htmlFor="terms" className="text-xs text-gray-600 leading-relaxed">
                      I agree to the{' '}
                      <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-700 hover:text-blue-600 underline font-medium">Terms of Service</button>
                      {' '}and{' '}
                      <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-blue-700 hover:text-blue-600 underline font-medium">Privacy Policy</button>
                    </label>
                  </div>

                  <div className="flex gap-2.5">
                    <button type="button" onClick={() => setActiveTab('account')}
                      className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      Back
                    </button>
                    <button type="submit" disabled={isLoading || !isFormValid()}
                      className="flex-1 py-2.5 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating...
                        </span>
                      ) : 'Create Account'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className="mt-6 text-center text-[10px] text-gray-400">
              &copy; {new Date().getFullYear()} Zap Zone. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-violet-700 px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'white' }}>Terms of Service</h3>
              <button onClick={() => setShowTermsModal(false)} className="p-1 hover:bg-white/15 rounded-md transition text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 text-xs text-gray-600 space-y-4">
              <p className="text-[11px] text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
              {[
                ['1. Acceptance of Terms', 'By accessing and using Zap Zone\'s services, you accept and agree to be bound by the terms and provision of this agreement.'],
                ['2. Use of Services', 'You agree to use our services only for lawful purposes and in accordance with these Terms. You must be at least 18 years old to create an account.'],
                ['3. Booking and Reservations', 'All bookings are subject to availability. We reserve the right to cancel or modify reservations in case of unforeseen circumstances.'],
                ['4. Payment Terms', 'Payment is required at the time of booking unless otherwise specified. All prices are in USD and are subject to change without notice.'],
                ['5. User Accounts', 'You are responsible for maintaining the confidentiality of your account credentials.'],
                ['6. Limitation of Liability', 'Zap Zone shall not be liable for any indirect, incidental, special, consequential or punitive damages.'],
                ['7. Changes to Terms', 'We reserve the right to modify these terms at any time.'],
              ].map(([title, body]) => (
                <div key={title}>
                  <h4 className="font-semibold text-gray-800 mb-1">{title}</h4>
                  <p className="leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowTermsModal(false)} className="px-4 py-1.5 text-xs bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPrivacyModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-violet-700 px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'white' }}>Privacy Policy</h3>
              <button onClick={() => setShowPrivacyModal(false)} className="p-1 hover:bg-white/15 rounded-md transition text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 text-xs text-gray-600 space-y-4">
              <p className="text-[11px] text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
              {[
                ['1. Information We Collect', 'We collect personal information that you provide to us, including your name, email address, phone number, and payment information.'],
                ['2. How We Use Your Information', 'We use your information to process bookings, send confirmations, provide customer support, and improve our services.'],
                ['3. Data Security', 'We implement appropriate technical and organizational security measures to protect your personal information.'],
                ['4. Sharing of Information', 'We do not sell your personal information. We may share your information with service providers who assist us.'],
                ['5. Cookies and Tracking', 'We use cookies and similar tracking technologies to enhance your browsing experience.'],
                ['6. Your Rights', 'You have the right to access, correct, or delete your personal information.'],
                ['7. Children\'s Privacy', 'Our services are not directed to children under 13.'],
                ['8. Contact Us', 'If you have questions about this Privacy Policy, please contact us at privacy@zapzone.com.'],
              ].map(([title, body]) => (
                <div key={title}>
                  <h4 className="font-semibold text-gray-800 mb-1">{title}</h4>
                  <p className="leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowPrivacyModal(false)} className="px-4 py-1.5 text-xs bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerRegister;
