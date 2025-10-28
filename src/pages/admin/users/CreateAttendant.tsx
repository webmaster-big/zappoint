import { useState } from 'react';
import { 
  UserPlus, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Zap,
  Eye,
  EyeOff,
  Save,
  Clock,
  Users,
  Check
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { CreateAttendantFormData } from '../../../types/CreateAttendant.types';

const CreateAttendant = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [formData, setFormData] = useState<CreateAttendantFormData>({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    hireDate: new Date().toISOString().split('T')[0],
    position: 'Attendant',
    employeeId: '',
    
    // Work Details
    department: 'Guest Services',
    shift: 'Evening Shift (2:00 PM - 10:00 PM)',
    assignedAreas: ['Laser Tag Arena'],
    status: 'active',

    // Login Credentials
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const areas = [
    'Laser Tag Arena',
    'Bowling Alley',
    'Arcade Zone',
    'VR Experience',
    'Escape Room',
    'Customer Service',
    'Food & Beverage',
    'Party Hosting'
  ];

  const shifts = [
    'Morning Shift (8:00 AM - 4:00 PM)',
    'Evening Shift (2:00 PM - 10:00 PM)',
    'Night Shift (6:00 PM - 2:00 AM)',
    'Weekend Shift (10:00 AM - 6:00 PM)',
    'Flexible Hours'
  ];

  const departments = [
    'Guest Services',
    'Entertainment',
    'Food & Beverage',
    'Maintenance',
    'Security',
    'Administration'
  ];

  const positions = [
    'Attendant',
    'Senior Attendant',
    'Team Lead',
    'Supervisor',
    'Specialist'
  ];

  const handleInputChange = (field: keyof CreateAttendantFormData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleAreaToggle = (area: string) => {
    setFormData(prev => ({
      ...prev,
      assignedAreas: prev.assignedAreas.includes(area)
        ? prev.assignedAreas.filter(a => a !== area)
        : [...prev.assignedAreas, area]
    }));
  };

  const generateEmployeeId = () => {
    const randomId = `ZAP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    handleInputChange('employeeId', randomId);
  };

  const generateUsername = () => {
    if (formData.firstName && formData.lastName) {
      const username = `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`;
      handleInputChange('username', username);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Email is invalid';
      }
    }

    if (step === 3) {
      if (!formData.employeeId.trim()) newErrors.employeeId = 'Employee ID is required';
      if (!formData.username.trim()) newErrors.username = 'Username is required';
      if (!formData.password) newErrors.password = 'Password is required';
      if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm password';
      if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(3, prev + 1));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep(3)) {
      setShowConfirm(true);
    }
  };

  const handleConfirmCreate = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Reset form or redirect
    console.log('Attendant created:', formData);
    setIsSubmitting(false);
    setShowConfirm(false);
    // In real app, you might redirect to attendants list or show success message
  };

  const steps = [
    { number: 1, title: 'Personal Info', icon: User },
    { number: 2, title: 'Work Details', icon: MapPin },
    { number: 3, title: 'Review', icon: Check }
  ];

  // Live Preview Data
  const previewData = {
    name: formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}` : 'New Attendant',
    position: formData.position,
    department: formData.department,
    email: formData.email || 'email@example.com',
    phone: formData.phone || '(555) 000-0000',
    hireDate: formData.hireDate ? new Date(formData.hireDate).toLocaleDateString() : 'Not set',
    status: formData.status,
    areas: formData.assignedAreas,
    shift: formData.shift
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-${fullColor}" />
            Create New Attendant
          </h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Add a new staff member to your location</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Steps */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = currentStep === step.number;
                  const isCompleted = currentStep > step.number;
                  
                  return (
                    <div key={step.number} className="flex items-center flex-1 justify-center">
                      <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 ${
                        isActive || isCompleted
                          ? 'bg-${fullColor} border-${fullColor} text-white'
                          : 'border-gray-300 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <Check size={16} className="sm:w-5 sm:h-5" />
                        ) : (
                          <Icon size={16} className="sm:w-5 sm:h-5" />
                        )}
                      </div>
                      {index < steps.length && (
                        <div className={`w-10 h-0.5 mx-1 sm:mx-2 ${
                          isCompleted ? `bg-${fullColor}` : 'bg-gray-300'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {steps.find(s => s.number === currentStep)?.title}
                </h3>
              </div>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${
                          errors.firstName ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter first name"
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${
                          errors.lastName ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter last name"
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${
                          errors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="attendant@zapzone.com"
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Hire Date</label>
                      <input
                        type="date"
                        value={formData.hireDate}
                        onChange={(e) => handleInputChange('hireDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                      <select
                        value={formData.position}
                        onChange={(e) => handleInputChange('position', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500"
                      >
                        {positions.map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Work Details */}
              {currentStep === 2 && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                      <select
                        value={formData.department}
                        onChange={(e) => handleInputChange('department', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500"
                      >
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Shift Schedule</label>
                      <select
                        value={formData.shift}
                        onChange={(e) => handleInputChange('shift', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500"
                      >
                        {shifts.map(shift => (
                          <option key={shift} value={shift}>{shift}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Assigned Work Areas</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {areas.map(area => (
                        <label key={area} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={formData.assignedAreas.includes(area)}
                            onChange={() => handleAreaToggle(area)}
                            className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                          />
                          <span className="text-sm text-gray-700">{area}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="active"
                          checked={formData.status === 'active'}
                          onChange={(e) => handleInputChange('status', e.target.value)}
                          className={`text-${fullColor} focus:ring-${themeColor}-500`}
                        />
                        <span className="ml-2 text-sm text-gray-700">Active</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="inactive"
                          checked={formData.status === 'inactive'}
                          onChange={(e) => handleInputChange('status', e.target.value)}
                          className={`text-${fullColor} focus:ring-${themeColor}-500`}
                        />
                        <span className="ml-2 text-sm text-gray-700">Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && (
                <div className="space-y-4 sm:space-y-6">
                  <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-3 sm:p-4`}>
                    <p className={`text-sm text-${fullColor}`}>
                      <strong>Ready to create:</strong> Review all information before creating the attendant account.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID *</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={formData.employeeId}
                          onChange={(e) => handleInputChange('employeeId', e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-lg ${
                            errors.employeeId ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Generate or enter ID"
                        />
                        <button
                          type="button"
                          onClick={generateEmployeeId}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                        >
                          Generate
                        </button>
                      </div>
                      {errors.employeeId && (
                        <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-lg ${
                            errors.username ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Username for login"
                        />
                        <button
                          type="button"
                          onClick={generateUsername}
                          disabled={!formData.firstName || !formData.lastName}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                        >
                          Generate
                        </button>
                      </div>
                      {errors.username && (
                        <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg pr-10 ${
                            errors.password ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg ${
                          errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4 sm:pt-6 border-t border-gray-200 gap-3">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  disabled={currentStep === 1}
                  className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  Previous
                </button>
                
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-4 sm:px-6 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 text-sm sm:text-base"
                  >
                    Next
                  </button>
                ) : (
                  showConfirm ? (
                    <button
                      type="button"
                      onClick={handleConfirmCreate}
                      disabled={isSubmitting}
                      className="px-4 sm:px-6 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 disabled:opacity-50 flex items-center text-sm sm:text-base"
                    >
                      <Save size={16} className="mr-2" />
                      {isSubmitting ? 'Creating...' : 'Create Attendant'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 sm:px-6 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 disabled:opacity-50 flex items-center text-sm sm:text-base"
                    >
                      <Save size={16} className="mr-2" />
                      Create Attendant
                    </button>
                  )
                )}
              </div>
            </form>
          </div>

          {/* Live Preview Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 sticky top-4">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Eye size={18} className="text-${fullColor}" />
                  Live Preview
                </h3>
                <p className="text-sm text-gray-600">How the attendant profile will appear</p>
              </div>

              <div className="p-4 sm:p-6">
                {/* Profile Header */}
                <div className="text-center mb-4 sm:mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-${themeColor}-500 to-${fullColor} rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold mx-auto mb-2 sm:mb-3">
                    {previewData.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold text-gray-900">{previewData.name}</h4>
                  <p className="text-gray-600 flex items-center justify-center gap-1 text-sm sm:text-base">
                    <Zap size={12} className="text-${fullColor}" />
                    {previewData.position} • {previewData.department}
                  </p>
                </div>

                {/* Status Badge */}
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-3 sm:mb-4 ${
                  previewData.status === 'active' 
                    ? `bg-${themeColor}-100 text-${fullColor}` 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    previewData.status === 'active' ? `bg-${fullColor}` : 'bg-gray-500'
                  }`} />
                  {previewData.status === 'active' ? 'Active' : 'Inactive'}
                </div>

                {/* Details */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center text-xs sm:text-sm">
                    <Mail size={14} className="text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-gray-700 truncate">{previewData.email}</span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm">
                    <Phone size={14} className="text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-gray-700">{previewData.phone}</span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm">
                    <Calendar size={14} className="text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-gray-700">Hired: {previewData.hireDate}</span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm">
                    <Clock size={14} className="text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-gray-700 truncate">{previewData.shift}</span>
                  </div>
                </div>

                {/* Assigned Areas */}
                <div className="mt-3 sm:mt-4">
                  <div className="flex items-center text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    <Users size={14} className="mr-1.5" />
                    Assigned Areas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {previewData.areas.map((area, index) => (
                      <span key={index} className={`px-1.5 py-0.5 bg-${themeColor}-100 text-${fullColor} rounded-full text-xs`}>
                        {area}
                      </span>
                    ))}
                    {previewData.areas.length === 0 && (
                      <span className="text-xs text-gray-500">No areas assigned yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAttendant;