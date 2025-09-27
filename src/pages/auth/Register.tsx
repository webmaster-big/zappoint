import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, CheckCircle } from "lucide-react";

export default function CompanyAdminRegistration() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      setIsSubmitting(false);
      return;
    }

    if (formData.password.length < 8) {
      alert("Password must be at least 8 characters long");
      setIsSubmitting(false);
      return;
    }

    // Simulate API call
    try {
      // In a real app, you would make an API call here
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Store user data and redirect
      localStorage.setItem('zapzone_user', JSON.stringify({
        name: `${formData.firstName} ${formData.lastName}`,
        company: formData.companyName,
        position: "Company Admin",
        role: 'company_admin'
      }));
      
      window.location.href = '/company/dashboard';
    } catch (error) {
      console.error("Registration failed:", error);
      alert("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordRequirements = [
    { label: "At least 8 characters", met: formData.password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(formData.password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(formData.password) },
    { label: "Contains number", met: /[0-9]/.test(formData.password) },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-100 m-3">
        {/* Logo */}
        <div className="flex justify-center mb-6 pt-2">
          <img src="/Zap-Zone.png" alt="Zap Zone" className="w-2/5" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2 tracking-tight">
            Create Account
          </h1>
          <p className="text-zinc-500 text-sm">
            Set up your company admin account to manage multiple locations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Information */}
         
          <div>
              <label className="block text-sm font-medium text-zinc-800 mb-1">Company Name</label>
              <input
                type="text"
                name="companyName"
                className="w-full rounded-md border border-blue-200 px-3 py-2 text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
                placeholder="Enter your company name"
                required
                value={formData.companyName}
                onChange={handleChange}
              />
            </div>

          {/* Personal Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-800 mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
                placeholder="First name"
                required
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-800 mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
                placeholder="Last name"
                required
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base"
              placeholder="you@company.com"
              required
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base pr-10"
                placeholder="Create a password"
                required
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {/* Password Requirements */}
            {formData.password && (
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center text-xs">
                    <CheckCircle 
                      size={14} 
                      className={`mr-2 ${req.met ? 'text-green-500' : 'text-zinc-300'}`} 
                    />
                    <span className={req.met ? 'text-green-600' : 'text-zinc-400'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition text-base pr-10"
                placeholder="Confirm your password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-lg font-semibold text-base shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating Account..." : "Create New Account"}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-zinc-500 text-sm">
            Already have an account?{" "}
            <Link 
              to="/" 
              className="text-blue-800 hover:text-blue-900 font-semibold transition"
            >
              Sign in here
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-zinc-400">
          &copy; {new Date().getFullYear()} Zap Zone. All rights reserved.
        </div>
      </div>
    </div>
  );
}