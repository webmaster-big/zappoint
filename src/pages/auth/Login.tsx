import { useState } from "react";
import { API_BASE_URL } from "../../utils/storage";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showLoader, setShowLoader] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setShowLoader(true);
    setLoginProgress(0);

    try {
      // Animate to 20%
      await animateProgress(20, 400);
      
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      await animateProgress(45, 500);

      if (!response.ok) {
        if (data.errors) {
          const errorMessages = Object.values(data.errors).flat().join(' ');
          setErrorMessage(errorMessages);
        } else if (data.message) {
          setErrorMessage(data.message);
        } else {
          setErrorMessage('Login failed. Please check your credentials.');
        }
        setIsSubmitting(false);
        setShowLoader(false);
        setLoginProgress(0);
        return;
      }

      await animateProgress(65, 600);
      const { user, role, token } = data;

      // Update last login timestamp
      try {
        await fetch(`${API_BASE_URL}/users/${user.id}/update-last-login`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Failed to update last login:', error);
      }

      // Determine redirect path based on role
      const redirectPaths: Record<string, string> = {
        'company_admin': '/company/dashboard',
        'location_manager': '/manager/dashboard',
        'attendant': '/attendant/dashboard',
      };
      const redirect = redirectPaths[role] || '/attendant/dashboard';

      await animateProgress(85, 600);
      // Store user data
      localStorage.setItem('zapzone_user', JSON.stringify({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone || '',
        profile_path: user.profile_path || '',
        company: user.company?.company_name || '',
        company_id: user.company_id || null,
        location_id: user.location_id || null,
        location_name: role !== 'company_admin' ? (user.location?.name || '') : '',
        position: user.position || role.replace('_', ' '),
        role: role,
        token: token,
        last_login: user.last_login || null,
      }));

      await animateProgress(100, 400);
      setTimeout(() => {
        window.location.href = redirect;
      }, 200);
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage('An error occurred during login. Please try again.');
      setIsSubmitting(false);
      setShowLoader(false);
      setLoginProgress(0);
    }
  };

  return (
    <>
      {/* Loader Overlay */}
      {showLoader && <LoadingSpinner fullScreen showProgress={true} progress={loginProgress} message="Signing in..." />}

      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-100 m-3">
        <div className="flex justify-center mb-8 pt-2">
          <img src="/Zap-Zone.png" alt="Logo" className="w-2/4" />
        </div>

        <div className="mb-8">
          <h1 className="text-center text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Sign in to your account</h1>
          <p className="text-center text-zinc-500 text-sm">Enter your email and password to continue</p>
        </div>
        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} name="login" method="post">
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              autoComplete="username email"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base sm:text-base"
              placeholder="you@email.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
                autoComplete="current-password"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 pr-10 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base sm:text-base"
                placeholder="••••••••"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full py-2 rounded-lg font-semibold text-base sm:text-lg shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Signing In..." : "Sign In"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <div className="mb-2 text-xs text-zinc-400">
            <a href="https://zap-zone.com/terms-conditions/" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 transition">
              Terms & Conditions
            </a>
          </div>
          <div className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} zapzone. All rights reserved.
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
