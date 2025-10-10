import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

const CustomerRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
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
      // Simulate API call - replace with actual registration
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Mock user registration - replace with real API call
      const newUser = {
        id: Math.random().toString(36).substr(2, 9),
        name: formData.firstName + ' ' + formData.lastName,
        email: formData.email,
        phone: formData.phone,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('customer_user', JSON.stringify(newUser));
      navigate('/');
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Design Section */}
      <div className="hidden lg:flex lg:w-3/5 xl:w-2/3 bg-gradient-to-br from-blue-900 to-blue-800 relative overflow-hidden items-center justify-center">
        <div className="relative z-10 flex flex-col items-center justify-center p-16 text-white h-full w-full">
          <div className="flex items-center space-x-3 mb-8">
            <img src="/Zap-Zone.png" alt="Zap Zone Logo" className="w-35 h-14" />
          </div>
          <div className="max-w-lg text-center">
            <h2 className="text-4xl font-extrabold mb-6">Book Your Next Adventure</h2>
            <p className="text-blue-100 text-lg leading-relaxed">
              Create your Zap Zone account to reserve attractions, manage your bookings, and unlock exclusive offers. Fast, secure, and easy—your next fun experience is just a few clicks away!
            </p>
          </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute top-1/4 -left-10 w-40 h-40 bg-blue-400 rounded-full mix-blend-overlay opacity-20"></div>
        <div className="absolute bottom-1/4 -right-10 w-60 h-60 bg-purple-400 rounded-full mix-blend-overlay opacity-20"></div>
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-cyan-400 rounded-full mix-blend-overlay opacity-30"></div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 max-w-full lg:w-2/5 xl:w-1/3 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Back Button - Mobile */}
          <button
            onClick={() => navigate(-1)}
            className="lg:hidden flex items-center text-zinc-600 hover:text-zinc-800 mb-6 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </button>

          {/* Logo - Mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-white rounded-full"></div>
              </div>
              <span className="text-xl font-bold text-zinc-900">Zap Zone</span>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Create your account</h1>
            <p className="text-zinc-500 text-sm">
              Already have an account?{' '}
              <Link to="/customer/login" className="font-medium text-blue-800 hover:text-blue-700 transition-colors">
                Sign in here
              </Link>
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
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
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
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
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
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
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
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
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
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
              <p className="mt-1 text-xs text-zinc-500">Must be at least 6 characters long</p>
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
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base pr-10"
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
                <a href="#" className="text-blue-800 hover:text-blue-700 transition-colors">Terms of Service</a>{' '}
                and{' '}
                <a href="#" className="text-blue-800 hover:text-blue-700 transition-colors">Privacy Policy</a>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3 rounded-lg font-semibold text-base shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};

export default CustomerRegister;