import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Demo customer accounts
  const demoAccounts = [
    {
      label: 'Customer Demo',
      email: 'demo.customer@example.com',
      password: 'password123'
    }
  ];

  const handleDemoSelect = (account: typeof demoAccounts[0]) => {
    setFormData({
      email: account.email,
      password: account.password
    });
    if (error) setError('');
  };
  // removed unused showPassword state
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (!formData.email || !formData.password) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockUser = {
        id: '1',
        name: 'John Doe',
        email: formData.email,
        phone: '+1234567890',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('customer_user', JSON.stringify(mockUser));
      navigate('/');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-100 m-3">
        {/* Logo container with Zap Zone logo */}
        <div className="flex justify-center mb-8 pt-2">
          <img src="/Zap-Zone.png" alt="Logo" className="w-3/5 mr-2" />
        </div>
        {/* Demo account selection */}
        <div className="mb-6">
          <div className="flex justify-center gap-2 mb-2">
            <button
              type="button"
              className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold hover:bg-blue-200 transition"
              onClick={() => handleDemoSelect(demoAccounts[0])}
            >
              Customer
            </button>
          </div>
          {/* <p className="text-center text-xs text-zinc-400">Demo accounts: autofill email & password</p> */}
        </div>
        <div className="mb-8">
          <h1 className="text-center text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Sign In Account</h1>
          <p className="text-center text-zinc-500 text-sm">
            This page is for <span className="font-semibold text-blue-800">customer</span> accounts only.<br />
            </p>
        </div>
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Email</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base sm:text-base"
              placeholder="you@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Password</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base sm:text-base"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full py-2 rounded-lg font-semibold text-base sm:text-lg shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing in...
              </div>
            ) : (
              'Sign In'
            )}
          </button>
          
        </form>
          <p className="text-center text-zinc-500 text-sm mt-3">
            Don't have an account?{' '}
            <Link to="/customer/register" className="font-medium text-blue-800 hover:text-blue-700 transition-colors">Sign up here</Link>
          </p>
        <div className="mt-6 text-center text-xs text-zinc-400">
          &copy; {new Date().getFullYear()} zapzone. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default CustomerLogin;