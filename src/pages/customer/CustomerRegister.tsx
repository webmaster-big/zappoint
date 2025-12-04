import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import type { RegisterFormData } from '../../types/customer';
import customerService from '../../services/CustomerService';

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
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
    return true;
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
      // Call the API to register the customer
      const response = await customerService.register({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
      });

      if (response.success && response.data) {
        // Store customer data in localStorage
        const customerData = {
          id: response.data.id,
          name: `${response.data.first_name} ${response.data.last_name}`,
          email: response.data.email,
          phone: response.data.phone,
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

            <div className="flex items-start space-x-3">
              <input
                id="terms"
                name="terms"
                type="checkbox"
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

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3 font-semibold text-base shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
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
          </form>

          <div className="mt-8 text-center text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Zap Zone. All rights reserved.
          </div>
        </div>
        </div>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdrop-fade">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-backdrop-fade">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
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