import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Save,
  User,
  Shield,
  Building,

  UserCheck,

  Users

} from 'lucide-react';
import type { 
  CreateAccountsFormData, 
  CreateAccountsDepartment, 
  CreateAccountsLocation 
} from '../../../types/CreateAccounts.types';

const CreateAccount = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<CreateAccountsFormData>({
    userType: 'attendant',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    hireDate: new Date().toISOString().split('T')[0],
    position: '',
    employeeId: '',
    department: '',
    location: '',
    shift: '',
    assignedAreas: [],
    status: 'active',
    username: '',
    password: '',
    confirmPassword: '',
  });

  // Available departments with user type restrictions
  const departments: CreateAccountsDepartment[] = [
    { id: 'dept_1', name: 'Guest Services', userTypes: ['attendant'] },
    { id: 'dept_2', name: 'Entertainment', userTypes: ['attendant'] },
    { id: 'dept_3', name: 'Food & Beverage', userTypes: ['attendant'] },
    { id: 'dept_4', name: 'Maintenance', userTypes: ['attendant'] },
    { id: 'dept_5', name: 'Security', userTypes: ['attendant', 'manager'] },
    { id: 'dept_6', name: 'Administration', userTypes: ['manager'] },
    { id: 'dept_7', name: 'Operations', userTypes: ['manager'] }
  ];

  // Available locations
  const locations: CreateAccountsLocation[] = [
    { id: 'loc_1', name: 'Brighton', managers: ['John Smith'] },
    { id: 'loc_2', name: 'Canton', managers: ['Sarah Wilson'] },
    { id: 'loc_3', name: 'Farmington', managers: ['Michael Davis'] },
    { id: 'loc_4', name: 'Lansing', managers: ['Patricia Miller'] },
    { id: 'loc_5', name: 'Taylor', managers: ['Daniel Clark'] },
    { id: 'loc_6', name: 'Escape Room Zone', managers: ['Jessica Thompson'] }
  ];

  // Available shifts
  const shifts = [
    'Morning Shift (8:00 AM - 4:00 PM)',
    'Evening Shift (2:00 PM - 10:00 PM)',
    'Night Shift (6:00 PM - 2:00 AM)',
    'Weekend Shift (10:00 AM - 6:00 PM)',
    'Flexible Shift'
  ];

  // Available areas for assignment
  const areas = [
    'Laser Tag Arena',
    'Bowling Alley',
    'VR Experience',
    'Arcade Zone',
    'Escape Room',
    'Mini Golf',
    'Food Court',
    'Ticket Counter',
    'Customer Service',
    'Maintenance'
  ];

  // Position options based on user type
  const positionOptions = {
    attendant: [
      'Senior Attendant',
      'Team Lead',
      'Attendant',
      'Trainee',
      'Specialist'
    ],
    manager: [
      'Location Manager',
      'Assistant Manager',
      'Operations Manager',
      'Department Manager',
      'Area Supervisor'
    ]
  };

  const handleInputChange = (field: keyof CreateAccountsFormData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
    const prefix = formData.userType === 'manager' ? 'ZAP-MGR' : 'ZAP-ATT';
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const newId = `${prefix}-${randomNum}`;
    handleInputChange('employeeId', newId);
  };

  const generateUsername = () => {
    if (formData.email) {
      const username = formData.email.split('@')[0];
      handleInputChange('username', username);
    }
  };

  const filteredDepartments = departments.filter(dept => 
    dept.userTypes.includes(formData.userType)
  );

  const nextStep = () => {
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password || !formData.confirmPassword) {
      alert('Password and confirm password are required.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get existing accounts from localStorage
      const existingAccounts = JSON.parse(localStorage.getItem('zapzone_accounts') || '[]');
      
      const newAccount = {
        id: `acc_${Date.now()}`,
        ...formData,
        createdAt: new Date().toISOString(),
        accountCreated: true,
        lastLogin: new Date().toISOString()
      };

      // Add to localStorage
      const updatedAccounts = [...existingAccounts, newAccount];
      localStorage.setItem('zapzone_accounts', JSON.stringify(updatedAccounts));

      // Show success message
      alert('Account created successfully!');
      
      // Navigate back to accounts page
      navigate('/accounts');
    } catch (error) {
      console.error('Error creating account:', error);
      alert('Error creating account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Basic Information
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-blue-800" />
          Basic Information
        </h3>
        
        {/* User Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => handleInputChange('userType', 'attendant')}
            className={`p-4 border-2 rounded-xl text-left transition-all ${
              formData.userType === 'attendant'
                ? 'border-blue-800 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                formData.userType === 'attendant' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Attendant</h4>
                <p className="text-sm text-gray-600 mt-1">Frontline staff member</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleInputChange('userType', 'manager')}
            className={`p-4 border-2 rounded-xl text-left transition-all ${
              formData.userType === 'manager'
                ? 'border-blue-800 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                formData.userType === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
              }`}>
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Location Manager</h4>
                <p className="text-sm text-gray-600 mt-1">Management staff</p>
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              placeholder="Enter password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              placeholder="Confirm password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              placeholder="Enter first name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              placeholder="Enter last name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hire Date *
            </label>
            <input
              type="date"
              required
              value={formData.hireDate}
              onChange={(e) => handleInputChange('hireDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position *
            </label>
            <select
              required
              value={formData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            >
              <option value="">Select Position</option>
              {positionOptions[formData.userType].map(position => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  // Step 2: Work Details
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building className="h-5 w-5 text-blue-800" />
          Work Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee ID *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={formData.employeeId}
                onChange={(e) => handleInputChange('employeeId', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                placeholder="Employee ID"
              />
              <button
                type="button"
                onClick={generateEmployeeId}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department *
            </label>
            <select
              required
              value={formData.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            >
              <option value="">Select Department</option>
              {filteredDepartments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <select
              required
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            >
              <option value="">Select Location</option>
              {locations.map(location => (
                <option key={location.id} value={location.name}>{location.name}</option>
              ))}
            </select>
          </div>

          {formData.userType === 'attendant' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift
              </label>
              <select
                value={formData.shift}
                onChange={(e) => handleInputChange('shift', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              >
                <option value="">Select Shift</option>
                {shifts.map(shift => (
                  <option key={shift} value={shift}>{shift}</option>
                ))}
              </select>
            </div>
          )}

         
        </div>

        {/* Assigned Areas - Only for Attendants */}
        {formData.userType === 'attendant' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Assigned Areas
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {areas.map(area => (
                <label key={area} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.assignedAreas.includes(area)}
                    onChange={() => handleAreaToggle(area)}
                    className="rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                  />
                  <span className="text-sm text-gray-700">{area}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Step 3: Additional Information & Settings
  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-800" />
          Additional Information
        </h3>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                placeholder="Username"
              />
              <button
                type="button"
                onClick={generateUsername}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value as 'active' | 'inactive')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>


      </div>
    </div>
  );

  const getStepTitle = () => {
    const titles = {
      1: 'Basic Information',
      2: 'Work Details',
      3: 'Additional Information'
    };
    return titles[step as keyof typeof titles];
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
              <p className="text-gray-600 mt-2">
                Create new {formData.userType === 'manager' ? 'Location Manager' : 'Attendant'} account
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">
              Step {step}: {getStepTitle()}
            </h2>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-3 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                Next Step
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Create Account
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAccount;