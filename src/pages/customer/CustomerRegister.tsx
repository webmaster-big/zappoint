import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import type { RegisterFormData } from '../../types/customer';
import customerService from '../../services/CustomerService';

// Country codes (ISO 3166-1 alpha-2) with display names
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

// US State codes for convenience
const usStates: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    // Billing Information (optional)
    address: '',
    address2: '',
    city: '',
    state: '', // 2-letter state code (e.g., 'CA', 'NY')
    zip: '',
    country: '', // 2-letter country code (e.g., 'US', 'CA')
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    // Validate required fields only (billing fields are optional/nullable in backend)
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all required fields');
      return false;
    }
    // Validate state code format if provided (max 2 characters)
    if (formData.state && formData.state.length > 2) {
      setError('State must be a 2-letter code (e.g., CA, NY)');
      return false;
    }
    // Validate country code format if provided (max 2 characters)
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.agreeToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return false;
    }
    return true;
  };

  // Check if account tab is complete
  const isAccountTabComplete = (): boolean => {
    return !!(
      formData.firstName &&
      formData.lastName &&
      formData.email &&
      formData.phone &&
      formData.password &&
      formData.confirmPassword &&
      formData.password === formData.confirmPassword &&
      formData.password.length >= 8 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    );
  };

  // Check if billing tab is complete (billing fields are optional)
  const isBillingTabComplete = (): boolean => {
    // Billing is optional, but if state or country is provided, validate format
    if (formData.state && formData.state.length > 2) return false;
    if (formData.country && formData.country.length > 2) return false;
    return true; // Billing fields are optional
  };

  // Check if form is ready to submit (billing is optional)
  const isFormValid = (): boolean => {
    return isAccountTabComplete() && isBillingTabComplete() && formData.agreeToTerms;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    if (!validateForm()) {
      setIsLoading(false);
      return;
    }
    try {
      // Call the API to register the customer with optional billing fields
      const response = await customerService.register({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
        // Optional billing fields (nullable in backend)
        ...(formData.address && { address: formData.address }),
        ...(formData.city && { city: formData.city }),
        ...(formData.state && { state: formData.state }), // 2-letter state code
        ...(formData.zip && { zip: formData.zip }),
        ...(formData.country && { country: formData.country }), // 2-letter country code
      });

      if (response.success && response.data) {
        // Store complete customer data including billing information in localStorage
        const customerData = {
          id: response.data.id,
          firstName: formData.firstName,
          lastName: formData.lastName,
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          address2: formData.address2,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          country: formData.country,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem('zapzone_customer', JSON.stringify(customerData));
        
        // Navigate to home page
        navigate('/');
      } else {
        setError(response.message || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Design Section with Video */}
      <div className="hidden lg:flex lg:w-3/5 xl:w-2/3 bg-slate-900 relative overflow-hidden items-center justify-center">
        {/* Video Background */}
        <iframe
          src="https://customer-bu7vnagrw6ivkw73.cloudflarestream.com/ced085083150e980c481a28d1eab6747/iframe?muted=true&loop=true&autoplay=true&poster=https%3A%2F%2Fcustomer-bu7vnagrw6ivkw73.cloudflarestream.com%2Fced085083150e980c481a28d1eab6747%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600&controls=false"
          loading="lazy"
          className="absolute top-1/2 left-1/2"
          style={{ 
            border: 'none', 
            width: '100vw',
            height: '100vh',
            transform: 'translate(-50%, -50%)',
            minWidth: '100%',
            minHeight: '100%'
          }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen={true}
        />
        <div className="absolute inset-0 bg-slate-900/60 z-10"></div>
        
        <div className="relative z-20 flex flex-col items-center justify-center px-16 w-full">
          <div className="max-w-lg text-center space-y-8">
            {/* Logo */}
            <Link to="/">
              <img src="/Zap-Zone.png" alt="Zap Zone Logo" className="w-40 h-16 object-contain mx-auto mb-8 cursor-pointer hover:opacity-80 transition" />
            </Link>
            
            {/* Main Content */}
            <h2 className="text-4xl font-bold text-white tracking-tight">
              Join the Adventure Today!
            </h2>
            <p className="text-slate-300 text-lg">
              Create your account and unlock access to exclusive attractions, special packages, and unforgettable experiences.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 max-w-full lg:w-2/5 xl:w-1/3 flex flex-col">
        {/* Mobile Header with Back Button and Gradient */}
        <div className="lg:hidden bg-gradient-to-br from-blue-800 via-blue-700 to-violet-600 px-4 py-6">
          <Link to="/" className="inline-flex items-center text-white hover:text-blue-100 transition mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Home</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Join the Adventure!</h1>
            <p className="text-blue-100 text-sm">Create your account to get started</p>
          </div>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center py-8 lg:py-12 px-4 sm:px-6 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">

          <div className="mb-8">
            <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Create your account</h1>
            <h1 className="lg:hidden text-xl font-bold text-zinc-900 mb-2 tracking-tight">Create account</h1>
            <p className="text-zinc-500 text-sm">
              Already have an account?{' '}
              <Link to="/customer/login" className="font-medium text-blue-800 hover:text-blue-700 transition-colors">
                Sign in here
              </Link>
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Tab Navigation */}
            <div className="flex border-b border-zinc-200">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'account'
                    ? 'text-blue-800 border-b-2 border-blue-800'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  Account Information
                  {isAccountTabComplete() && (
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'billing'
                    ? 'text-blue-800 border-b-2 border-blue-800'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  Billing Information
                  {isBillingTabComplete() && (
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </button>
            </div>

            {/* Account Information Tab */}
            {activeTab === 'account' && (
              <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-800 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  autoComplete="given-name"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-800 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  autoComplete="family-name"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-800 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-800 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Must be at least 8 characters long</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base pr-10 rounded-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Next button for Account tab */}
            {!isAccountTabComplete() && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Please complete all required fields to continue
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                if (isAccountTabComplete()) {
                  setActiveTab('billing');
                  setError('');
                }
              }}
              disabled={!isAccountTabComplete()}
              className="w-full py-3 font-semibold text-base shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
            >
              Continue to Billing Information →
            </button>
              </div>
            )}

            {/* Billing Information Tab */}
            {activeTab === 'billing' && (
              <div className="space-y-5">
            <div className="space-y-4">
                <p className="text-xs text-zinc-500 mb-2">Billing information is optional and can be added later.</p>
                <div>
                  <label className="block text-sm font-medium text-zinc-800 mb-1">Street Address <span className="text-zinc-400 font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    name="address"
                    autoComplete="address-line1"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                    placeholder="123 Main Street"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-800 mb-1">Apartment, Suite, Unit <span className="text-zinc-400 font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    name="address2"
                    autoComplete="address-line2"
                    value={formData.address2}
                    onChange={handleChange}
                    className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                    placeholder="Apt 4B, Suite 200, etc."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-800 mb-1">City <span className="text-zinc-400 font-normal">(Optional)</span></label>
                    <input
                      type="text"
                      name="city"
                      autoComplete="address-level2"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                      placeholder="City"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-800 mb-1">State <span className="text-zinc-400 font-normal">(Optional, 2-letter code)</span></label>
                    <select
                      name="state"
                      autoComplete="address-level1"
                      value={formData.state}
                      onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                    >
                      <option value="">Select state...</option>
                      {usStates.map(state => (
                        <option key={state.code} value={state.code}>
                          {state.code} - {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-800 mb-1">ZIP / Postal Code <span className="text-zinc-400 font-normal">(Optional)</span></label>
                    <input
                      type="text"
                      name="zip"
                      autoComplete="postal-code"
                      value={formData.zip}
                      onChange={handleChange}
                      className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                      placeholder="12345"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-800 mb-1">Country <span className="text-zinc-400 font-normal">(Optional, 2-letter code)</span></label>
                    <select
                      name="country"
                      autoComplete="country"
                      value={formData.country}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                    >
                      <option value="">Select country...</option>
                      {countries.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.code} - {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

            <div className="flex items-start space-x-3">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
                required
                className="h-4 w-4 text-blue-800 focus:ring-blue-800 border-gray-300 rounded mt-1"
              />
              <label htmlFor="terms" className="block text-sm text-zinc-700">
                I agree to the{' '}
                <button 
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-blue-800 hover:text-blue-700 transition-colors underline"
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button 
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-blue-800 hover:text-blue-700 transition-colors underline"
                >
                  Privacy Policy
                </button>
              </label>
            </div>

            {/* Navigation buttons for Billing tab */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className="flex-1 py-3 font-semibold text-base shadow-sm transition-all bg-zinc-200 text-zinc-700 hover:bg-zinc-300 rounded-none"
              >
                ← Back to Account
              </button>
              <button
                type="submit"
                disabled={isLoading || !isFormValid()}
                className="flex-1 py-3 font-semibold text-base shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
              </div>
            )}
          </form>

          <div className="mt-8 text-center text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Zap Zone. All rights reserved.
          </div>
        </div>
        </div>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdrop-fade" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">Terms of Service</h3>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-zinc-400 hover:text-zinc-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-zinc-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
                
                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">1. Acceptance of Terms</h4>
                <p className="text-zinc-700 mb-3">
                  By accessing and using Zap Zone's services, you accept and agree to be bound by the terms and provision of this agreement.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">2. Use of Services</h4>
                <p className="text-zinc-700 mb-3">
                  You agree to use our services only for lawful purposes and in accordance with these Terms. You must be at least 18 years old to create an account.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">3. Booking and Reservations</h4>
                <p className="text-zinc-700 mb-3">
                  All bookings are subject to availability. We reserve the right to cancel or modify reservations in case of unforeseen circumstances. Cancellation policies apply as stated at the time of booking.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">4. Payment Terms</h4>
                <p className="text-zinc-700 mb-3">
                  Payment is required at the time of booking unless otherwise specified. All prices are in USD and are subject to change without notice.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">5. User Accounts</h4>
                <p className="text-zinc-700 mb-3">
                  You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">6. Limitation of Liability</h4>
                <p className="text-zinc-700 mb-3">
                  Zap Zone shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of our services.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">7. Changes to Terms</h4>
                <p className="text-zinc-700 mb-3">
                  We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-200 flex justify-end">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdrop-fade" onClick={() => setShowPrivacyModal(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">Privacy Policy</h3>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-zinc-400 hover:text-zinc-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-zinc-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
                
                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">1. Information We Collect</h4>
                <p className="text-zinc-700 mb-3">
                  We collect personal information that you provide to us, including your name, email address, phone number, and payment information when you create an account or make a booking.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">2. How We Use Your Information</h4>
                <p className="text-zinc-700 mb-3">
                  We use your information to process bookings, send confirmations, provide customer support, and improve our services. We may also use your email to send you promotional offers with your consent.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">3. Data Security</h4>
                <p className="text-zinc-700 mb-3">
                  We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, or destruction.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">4. Sharing of Information</h4>
                <p className="text-zinc-700 mb-3">
                  We do not sell your personal information. We may share your information with service providers who assist us in operating our business, subject to confidentiality agreements.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">5. Cookies and Tracking</h4>
                <p className="text-zinc-700 mb-3">
                  We use cookies and similar tracking technologies to enhance your browsing experience, analyze site traffic, and understand user behavior.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">6. Your Rights</h4>
                <p className="text-zinc-700 mb-3">
                  You have the right to access, correct, or delete your personal information. You may also object to processing or request data portability by contacting us.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">7. Children's Privacy</h4>
                <p className="text-zinc-700 mb-3">
                  Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13.
                </p>

                <h4 className="font-semibold text-zinc-900 mt-4 mb-2">8. Contact Us</h4>
                <p className="text-zinc-700 mb-3">
                  If you have questions about this Privacy Policy, please contact us at privacy@zapzone.com.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-200 flex justify-end">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerRegister;