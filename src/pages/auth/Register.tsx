import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "../../utils/storage";

type UserRole = 'company_admin' | 'location_manager' | 'attendant';

export default function Register() {
  const [searchParams] = useSearchParams();
  
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    // Company fields
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    companyAddress: "",
    // Location fields
    locationName: "",
    locationAddress: "",
    locationCity: "",
    locationState: "",
    locationZipCode: "",
    locationPhone: "",
    locationEmail: "",
    locationTimezone: "America/New_York",
    // Employee fields
    phone: "",
    employeeId: "",
    department: "",
    position: "",
    shift: "",
    hireDate: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [tokenData, setTokenData] = useState<{ 
    email: string; 
    role: UserRole;
    company_id?: number;
    location_id?: number;
  } | null>(null);
  const [locations, setLocations] = useState<Array<{
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    phone: string;
    email: string;
    timezone: string;
    company_id: number;
  }>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [isNewLocation, setIsNewLocation] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setErrorMessage("Invalid registration link. Please use the link provided in your invitation email.");
      return;
    }

    // Validate token with backend API
    const validateToken = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/shareable-tokens/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        console.log(data)

        if (!response.ok || !data.success) {
          setTokenValid(false);
          setErrorMessage(data.message || 'Invalid or expired token');
          return;
        }

        // Token is valid, store the email, role, company_id, and location_id
        setTokenData({
          email: data.data.email,
          role: data.data.role as UserRole,
          company_id: data.data.company_id,
          location_id: data.data.location_id,
        });
        
        // Pre-fill email from token data
        setFormData(prev => ({
          ...prev,
          email: data.data.email,
        }));
        
        setTokenValid(true);
      } catch (error) {
        console.error('Token validation error:', error);
        setTokenValid(false);
        setErrorMessage("Failed to validate registration link. Please try again or contact support.");
      }
    };

    validateToken();
  }, [token]);

  // Fetch locations for location manager role
  useEffect(() => {
    if (tokenValid && tokenData?.role === 'location_manager' && tokenData.company_id) {
      const fetchLocations = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/locations`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();

          if (response.ok && data.success) {
            // Filter locations by company_id
            const companyLocations = data.data.filter(
              (loc: { company_id: number }) => loc.company_id === tokenData.company_id
            );
            setLocations(companyLocations);
          }
        } catch (error) {
          console.error('Failed to fetch locations:', error);
        }
      };

      fetchLocations();
    }
  }, [tokenValid, tokenData]);

  const getRoleDisplayName = (role: UserRole): string => {
    const roleMap = {
      'company_admin': 'Company Admin',
      'location_manager': 'Location Manager',
      'attendant': 'Attendant'
    };
    return roleMap[role];
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLocationSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (value === 'new') {
      // Create new location
      setIsNewLocation(true);
      setSelectedLocationId(null);
      setFormData(prev => ({
        ...prev,
        locationName: '',
        locationAddress: '',
        locationCity: '',
        locationState: '',
        locationZipCode: '',
        locationPhone: '',
        locationEmail: '',
        locationTimezone: 'Eastern Standard Time'
      }));
    } else if (value) {
      // Existing location selected
      const locationId = parseInt(value);
      const location = locations.find(loc => loc.id === locationId);
      
      if (location) {
        setIsNewLocation(false);
        setSelectedLocationId(locationId);
        setFormData(prev => ({
          ...prev,
          locationName: location.name,
          locationAddress: location.address,
          locationCity: location.city,
          locationState: location.state,
          locationZipCode: location.zip_code,
          locationPhone: location.phone,
          locationEmail: location.email,
          locationTimezone: location.timezone || 'Eastern Standard Time'
        }));
      }
    } else {
      // No selection
      setIsNewLocation(false);
      setSelectedLocationId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    console.log("=== REGISTRATION STARTED ===");
    console.log("Token Data:", tokenData);
    console.log("Form Data:", formData);

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      console.error("❌ Validation Error: Passwords do not match");
      setErrorMessage("Passwords do not match");
      setIsSubmitting(false);
      return;
    }

    if (formData.password.length < 8) {
      console.error("❌ Validation Error: Password too short");
      setErrorMessage("Password must be at least 8 characters long");
      setIsSubmitting(false);
      return;
    }

    // Validate all password requirements
    const allRequirementsMet = passwordRequirements.every(req => req.met);
    if (!allRequirementsMet) {
      console.error("❌ Validation Error: Password requirements not met", passwordRequirements);
      setErrorMessage("Please meet all password requirements");
      setIsSubmitting(false);
      return;
    }

    console.log("✅ All validations passed");

    // Register user with backend API
    try {
      let companyId = tokenData!.company_id;
      let locationId = tokenData!.location_id;

      console.log("Initial IDs - Company:", companyId, "Location:", locationId);

      // Step 1: Create company if needed (company_admin with no company_id)
      if (tokenData!.role === 'company_admin' && !companyId) {
        console.log("📤 STEP 1: Creating company...");
        const companyPayload = {
          name: formData.companyName,
          email: formData.companyEmail,
          phone: formData.companyPhone,
          address: formData.companyAddress
        };
        console.log("Company Payload:", companyPayload);

        const companyResponse = await fetch(`${API_BASE_URL}/companies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(companyPayload)
        });
        
        console.log("Company Response Status:", companyResponse.status);
        const companyData = await companyResponse.json();
        console.log("Company Response Data:", companyData);
        
        if (!companyResponse.ok || !companyData.success) {
          console.error("❌ Failed to create company:", companyData);
          setErrorMessage(companyData.message || 'Failed to create company');
          setIsSubmitting(false);
          return;
        }
        
        companyId = companyData.data.id;
        console.log("✅ Company created with ID:", companyId);
      }

      // Step 2: Create or use existing location for location_manager
      if (tokenData!.role === 'location_manager' && !locationId) {
        if (isNewLocation) {
          console.log("📤 STEP 2: Creating new location...");
          const locationPayload = {
            company_id: companyId,
            name: formData.locationName,
            address: formData.locationAddress,
            city: formData.locationCity,
            state: formData.locationState,
            zip_code: formData.locationZipCode,
            phone: formData.locationPhone,
            email: formData.locationEmail,
            timezone: formData.locationTimezone
          };
          console.log("Location Payload:", locationPayload);

          const locationResponse = await fetch(`${API_BASE_URL}/locations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationPayload)
          });
          
          console.log("Location Response Status:", locationResponse.status);
          const locationData = await locationResponse.json();
          console.log("Location Response Data:", locationData);
          
          if (!locationResponse.ok || !locationData.success) {
            console.error("❌ Failed to create location:", locationData);
            setErrorMessage(locationData.message || 'Failed to create location');
            setIsSubmitting(false);
            return;
          }
          
          locationId = locationData.data.id;
          console.log("✅ Location created with ID:", locationId);
        } else if (selectedLocationId) {
          console.log("📌 STEP 2: Using existing location ID:", selectedLocationId);
          locationId = selectedLocationId;
        } else {
          console.error("❌ No location selected");
          setErrorMessage('Please select a location or create a new one');
          setIsSubmitting(false);
          return;
        }
      }

      // Step 3: Create user account
      console.log("📤 STEP 3: Creating user account...");
      const userPayload: Record<string, unknown> = {
        company_id: companyId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
        role: tokenData!.role,
        status: 'active',
      };

      // Only add location_id for location_manager and attendant roles
      if (tokenData!.role !== 'company_admin') {
        userPayload.location_id = locationId;
      }

      // Add employee-specific fields for attendant role
      if (tokenData!.role === 'attendant') {
        if (formData.phone) userPayload.phone = formData.phone;
        if (formData.employeeId) userPayload.employee_id = formData.employeeId;
        if (formData.department) userPayload.department = formData.department;
        if (formData.position) userPayload.position = formData.position;
        if (formData.shift) userPayload.shift = formData.shift;
        if (formData.hireDate) userPayload.hire_date = formData.hireDate;
      }

      console.log("User Payload:", userPayload);

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload)
      });
      
      console.log("User Response Status:", response.status);
      const data = await response.json();
      console.log("User Response Data:", data);
      
      if (!response.ok || !data.success) {
        console.error("❌ Failed to create user:", data);
        setErrorMessage(data.message || 'Registration failed');
        setIsSubmitting(false);
        return;
      }

      console.log("✅ User created successfully with ID:", data.data.id);

      // Mark token as used (optional - backend might auto-mark it)
      try {
        console.log("📤 Marking token as used...");
        const markUsedResponse = await fetch(`${API_BASE_URL}/shareable-tokens/mark-used`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            token: token,
            user_id: data.data.id 
          })
        });
        const markUsedData = await markUsedResponse.json();
        console.log("Mark Used Response:", markUsedData);
      } catch (err) {
        console.error('⚠️ Failed to mark token as used (non-critical):', err);
        // Don't fail registration if this fails
      }
      
      console.log("✅ REGISTRATION COMPLETE - Redirecting to login...");
      // Redirect to login page
      window.location.href = '/';
    } catch (error) {
      console.error("❌ REGISTRATION FAILED:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      setErrorMessage("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
      console.log("=== REGISTRATION PROCESS ENDED ===");
    }
  };

  const passwordRequirements = [
    { label: "At least 8 characters", met: formData.password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(formData.password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(formData.password) },
    { label: "Contains number", met: /[0-9]/.test(formData.password) },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-4 sm:py-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-zinc-100 m-3">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src="/Zap-Zone.png" alt="Zap Zone" className="w-1/3" />
        </div>

        {/* Show loading state while validating token */}
        {tokenValid === null && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800 mb-4"></div>
            <p className="text-zinc-600">Validating registration link...</p>
          </div>
        )}

        {/* Show error if token is invalid */}
        {tokenValid === false && (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Invalid Registration Link</h2>
            <p className="text-zinc-600 mb-6">{errorMessage}</p>
            <Link 
              to="/" 
              className="inline-block px-6 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition font-semibold"
            >
              Go to Login
            </Link>
          </div>
        )}

        {/* Show registration form if token is valid */}
        {tokenValid === true && tokenData && (
          <>
            {/* Header */}
            <div className="text-center mb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-1 tracking-tight">
                Create {getRoleDisplayName(tokenData.role)} Account
              </h1>
              <p className="text-zinc-500 text-xs">
                {tokenData.role === 'company_admin' && "Set up your company admin account to manage multiple locations"}
                {tokenData.role === 'location_manager' && "Set up your location manager account to manage your location"}
                {tokenData.role === 'attendant' && "Set up your attendant account to start working"}
              </p>
            </div>

            {/* Show error message */}
            {errorMessage && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Company Information - Only for Company Admin when no company_id */}
              {tokenData.role === 'company_admin' && !tokenData.company_id && (
                <>
                  <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                    <h3 className="text-xs font-semibold text-zinc-700 mb-2 uppercase">Company Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Company Name</label>
                        <input
                          type="text"
                          name="companyName"
                          className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                          placeholder="Enter your company name"
                          required
                          value={formData.companyName}
                          onChange={handleChange}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Company Email</label>
                        <input
                          type="email"
                          name="companyEmail"
                          className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                          placeholder="company@example.com"
                          required
                          value={formData.companyEmail}
                          onChange={handleChange}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Company Phone</label>
                        <input
                          type="tel"
                          name="companyPhone"
                          className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                          placeholder="(555) 123-4567"
                          required
                          value={formData.companyPhone}
                          onChange={handleChange}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Company Address</label>
                        <input
                          type="text"
                          name="companyAddress"
                          className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                          placeholder="123 Main St, City, State 12345"
                          required
                          value={formData.companyAddress}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Location Information - Only for Location Manager when no location_id */}
              {/* Location Information - Only for Location Manager when no location_id */}
              {tokenData.role === 'location_manager' && !tokenData.location_id && (
                <>
                  <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                    <h3 className="text-xs font-semibold text-zinc-700 mb-2 uppercase">Location Information</h3>
                    
                    {/* Location Selection Dropdown */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Select Location</label>
                      <select
                        onChange={handleLocationSelect}
                        className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                        required
                        value={isNewLocation ? 'new' : (selectedLocationId || '')}
                      >
                        <option value="">-- Select a location --</option>
                        <option value="new">+ Create New Location</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name} - {location.city}, {location.state}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Show location fields when new location or existing location selected */}
                    {(isNewLocation || selectedLocationId) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Location Name</label>
                          <input
                            type="text"
                            name="locationName"
                            className={`w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm ${
                              !isNewLocation ? 'bg-zinc-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="Brighton Location"
                            required={isNewLocation}
                            value={formData.locationName}
                            onChange={handleChange}
                            readOnly={!isNewLocation}
                            disabled={!isNewLocation}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Address</label>
                          <input
                            type="text"
                            name="locationAddress"
                            className={`w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm ${
                              !isNewLocation ? 'bg-zinc-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="123 Main Street"
                            required={isNewLocation}
                            value={formData.locationAddress}
                            onChange={handleChange}
                            readOnly={!isNewLocation}
                            disabled={!isNewLocation}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">City</label>
                          <input
                            type="text"
                            name="locationCity"
                            className={`w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm ${
                              !isNewLocation ? 'bg-zinc-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="Brighton"
                            required={isNewLocation}
                            value={formData.locationCity}
                            onChange={handleChange}
                            readOnly={!isNewLocation}
                            disabled={!isNewLocation}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">State</label>
                          <input
                            type="text"
                            name="locationState"
                            className={`w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm ${
                              !isNewLocation ? 'bg-zinc-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="MI"
                            required={isNewLocation}
                            value={formData.locationState}
                            onChange={handleChange}
                            readOnly={!isNewLocation}
                            disabled={!isNewLocation}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Zip Code</label>
                          <input
                            type="text"
                            name="locationZipCode"
                            className={`w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm ${
                              !isNewLocation ? 'bg-zinc-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="48116"
                            required={isNewLocation}
                            value={formData.locationZipCode}
                            onChange={handleChange}
                            readOnly={!isNewLocation}
                            disabled={!isNewLocation}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Location Phone</label>
                          <input
                            type="tel"
                            name="locationPhone"
                            className={`w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm ${
                              !isNewLocation ? 'bg-zinc-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="(555) 123-4567"
                            required={isNewLocation}
                            value={formData.locationPhone}
                            onChange={handleChange}
                            readOnly={!isNewLocation}
                            disabled={!isNewLocation}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Location Email</label>
                          <input
                            type="email"
                            name="locationEmail"
                            className={`w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm ${
                              !isNewLocation ? 'bg-zinc-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="location@example.com"
                            required={isNewLocation}
                            value={formData.locationEmail}
                            onChange={handleChange}
                            readOnly={!isNewLocation}
                            disabled={!isNewLocation}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

          {/* Personal Information */}
          <div className={tokenData.role === 'company_admin' ? "space-y-3" : "grid grid-cols-1 md:grid-cols-3 gap-3"}>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                placeholder="First name"
                required
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                placeholder="Last name"
                required
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm cursor-not-allowed"
                placeholder="you@company.com"
                required
                value={formData.email}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* Employee Information - Only for Attendant */}
          {tokenData.role === 'attendant' && (
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
              <h3 className="text-xs font-semibold text-zinc-700 mb-2 uppercase">Employee Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    name="employeeId"
                    className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                    placeholder="EMP-001"
                    value={formData.employeeId}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                    placeholder="Guest Services"
                    value={formData.department}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Position</label>
                  <input
                    type="text"
                    name="position"
                    className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                    placeholder="Attendant"
                    value={formData.position}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Shift</label>
                  <input
                    type="text"
                    name="shift"
                    className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                    placeholder="Morning Shift"
                    value={formData.shift}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Hire Date</label>
                  <input
                    type="date"
                    name="hireDate"
                    className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm"
                    value={formData.hireDate}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Password */}
          <div className={tokenData.role === 'company_admin' ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm pr-8"
                  placeholder="Create a password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-zinc-900 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 transition text-sm pr-8"
                  placeholder="Confirm your password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
              )}
            </div>
          </div>

          {/* Password Requirements */}
          {formData.password && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {passwordRequirements.map((req, index) => (
                <div key={index} className="flex items-center text-xs">
                  <CheckCircle 
                    size={12} 
                    className={`mr-1.5 flex-shrink-0 ${req.met ? 'text-green-500' : 'text-zinc-300'}`} 
                  />
                  <span className={`${req.met ? 'text-green-600' : 'text-zinc-400'} leading-tight`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? "Creating Account..." : "Create New Account"}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-4 text-center">
          <p className="text-zinc-500 text-xs">
            Already have an account?{" "}
            <Link 
              to="/" 
              className="text-blue-800 hover:text-blue-900 font-semibold transition"
            >
              Sign in here
            </Link>
          </p>
        </div>

        <div className="mt-3 text-center">
          <div className="mb-2 text-xs text-zinc-400">
            <a href="https://zap-zone.com/terms-conditions/" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 transition">
              Terms & Conditions
            </a>
          </div>
          <div className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Zap Zone. All rights reserved.
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}