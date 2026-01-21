import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import type { LoginFormData } from '../../types/customer';
import customerService from '../../services/CustomerService';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginProgress, setLoginProgress] = useState(0);

  // Helper function to smoothly animate progress from current to target
  const animateProgress = (targetProgress: number, duration: number = 500) => {
    return new Promise<void>((resolve) => {
      setLoginProgress(prev => {
        const startProgress = prev;
        const diff = targetProgress - startProgress;
        const startTime = Date.now();
        
        const updateProgress = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Use easeOutCubic for more natural deceleration
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          const currentProgress = startProgress + (diff * easeProgress);
          
          setLoginProgress(Math.floor(currentProgress));
          
          if (progress < 1) {
            requestAnimationFrame(updateProgress);
          } else {
            setLoginProgress(targetProgress);
            resolve();
          }
        };
        
        requestAnimationFrame(updateProgress);
        return startProgress;
      });
    });
  };

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
    setLoginProgress(0);
    
    try {
      if (!formData.email || !formData.password) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      // Animate to 20%
      await animateProgress(20, 400);
      
      // Call the API to login
      await animateProgress(45, 500);
      const response = await customerService.login(formData.email, formData.password);

      await animateProgress(65, 600);
      if (response.token && response.user) {
        await animateProgress(85, 600);
        // Store complete user data and token in localStorage
        const customerData = {
          id: response.user.id,
          firstName: response.user.first_name || '',
          lastName: response.user.last_name || '',
          name: response.user.name || `${response.user.first_name || ''} ${response.user.last_name || ''}`.trim(),
          email: response.user.email,
          phone: response.user.phone,
          address: response.user.address || '',
          address2: response.user.address2 || '',
          city: response.user.city || '',
          state: response.user.state || '',
          zip: response.user.zip || '',
          country: response.user.country || 'United States',
          token: response.token,
          role: response.role,
        };
        localStorage.setItem('zapzone_customer', JSON.stringify(customerData));
        
        await animateProgress(100, 400);
        // Navigate to home page
        setTimeout(() => {
          navigate('/');
        }, 200);
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || 'Invalid email or password. Please try again.';
      setError(errorMessage);
    } finally {
      if (!error) {
        setTimeout(() => {
          setIsLoading(false);
          setLoginProgress(0);
        }, 500);
      } else {
        setIsLoading(false);
        setLoginProgress(0);
      }
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
              Welcome Back to the Fun!
            </h2>
            <p className="text-slate-300 text-lg">
              Sign in to access your bookings, explore new attractions, and continue your adventure with us.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
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
            <h1 className="text-2xl font-bold text-white mb-1">Welcome Back!</h1>
            <p className="text-blue-100 text-sm">Sign in to continue your adventure</p>
          </div>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center py-8 lg:py-12 px-4 sm:px-6 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">

          <div className="mb-8">
            <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Sign in to your account</h1>
            <h1 className="lg:hidden text-xl font-bold text-zinc-900 mb-2 tracking-tight">Sign in</h1>
            <p className="text-zinc-500 text-sm">
              Don't have an account?{' '}
              <Link to="/customer/register" className="font-medium text-blue-800 hover:text-blue-700 transition-colors">
                Create one here
              </Link>
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4 rounded-none">
              {error}
            </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={handleSubmit} name="customer-login" method="post">
            <div>
              <label className="block text-sm font-medium text-zinc-800 mb-1">Email</label>
              <input
                type="email"
                name="email"
                id="customer-email"
                autoComplete="username email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base rounded-none"
                placeholder="you@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base pr-10 rounded-none"
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
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3 font-semibold text-base shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed rounded-none relative"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in... {loginProgress}%</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Zap Zone. All rights reserved.
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerLogin;