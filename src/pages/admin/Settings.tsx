import { useState, useEffect } from 'react';
import { Palette, Lock, Mail, CheckCircle, X, Eye, EyeOff } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';

interface ColorOption {
  name: string;
  shades: {
    [key: string]: string;
  };
}

const AVAILABLE_COLORS: ColorOption[] = [
  {
    name: 'red',
    shades: {
      '500': '#ef4444',
      '600': '#dc2626',
    }
  },
  {
    name: 'yellow',
    shades: {
      '300': '#fde047',
      '400': '#facc15',
    }
  },

  {
    name: 'green',
    shades: {
      '500': '#22c55e',
      '600': '#16a34a',
      '800': '#166534',
    }
  },
  {
    name: 'blue',
    shades: {
      '200': '#bfdbfe',
      '400': '#60a5fa',
      '500': '#3b82f6',
      '600': '#2563eb',
      '700': '#1d4ed8',
      '800': '#1e40af',
    }
  },
  
  {
    name: 'violet',
    shades: {
      '500': '#8b5cf6',
    }
  },
  {
    name: 'purple',
    shades: {

      '400': '#c084fc',
      '600': '#9333ea',

    }
  },
];

const Settings = () => {
  const { themeColor } = useThemeColor();
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedShade, setSelectedShade] = useState('800');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Email modal states
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  
  // Password modal states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Load saved color from localStorage
    const savedColor = localStorage.getItem('zapzone_theme_color') || 'blue';
    const savedShade = localStorage.getItem('zapzone_theme_shade') || '800';
    
    // Validate that the saved color exists
    const colorObj = AVAILABLE_COLORS.find((c) => c.name === savedColor);
    if (colorObj) {
      setSelectedColor(savedColor);
      
      // Validate that the saved shade exists for this color
      const availableShades = Object.keys(colorObj.shades);
      if (availableShades.includes(savedShade)) {
        setSelectedShade(savedShade);
      } else {
        // Use the first available shade if saved shade doesn't exist
        const firstShade = availableShades[0] || '500';
        setSelectedShade(firstShade);
        localStorage.setItem('zapzone_theme_shade', firstShade);
      }
    } else {
      // Default to blue if saved color doesn't exist
      setSelectedColor('blue');
      setSelectedShade('800');
    }

    // Load user data from localStorage
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentEmail(user.email || '');
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  const handleColorSelect = (colorName: string) => {
    // Find the selected color's available shades
    const selectedColorObj = AVAILABLE_COLORS.find((c) => c.name === colorName);
    if (!selectedColorObj) return;
    
    // Get available shades for this color
    const availableShades = Object.keys(selectedColorObj.shades);
    
    // If current shade doesn't exist for this color, pick the first available shade
    let shadeToUse = selectedShade;
    if (!availableShades.includes(selectedShade)) {
      shadeToUse = availableShades[0] || '500';
      setSelectedShade(shadeToUse);
    }
    
    setSelectedColor(colorName);
    localStorage.setItem('zapzone_theme_color', colorName);
    localStorage.setItem('zapzone_theme_shade', shadeToUse);
    
    // Dispatch custom event to notify other components of color change
    window.dispatchEvent(new CustomEvent('zapzone_color_changed', { 
      detail: { 
        color: colorName,
        shade: shadeToUse,
        fullColor: `${colorName}-${shadeToUse}`
      } 
    }));
    
    setSuccessMessage(`Theme color updated to ${colorName}-${shadeToUse}!`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleShadeSelect = (shade: string) => {
    setSelectedShade(shade);
    localStorage.setItem('zapzone_theme_color', selectedColor);
    localStorage.setItem('zapzone_theme_shade', shade);
    
    // Dispatch custom event to notify other components of color change
    window.dispatchEvent(new CustomEvent('zapzone_color_changed', { 
      detail: { 
        color: selectedColor,
        shade: shade,
        fullColor: `${selectedColor}-${shade}`
      } 
    }));
    
    setSuccessMessage(`Theme color updated to ${selectedColor}-${shade}!`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleEmailUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailPassword) {
      alert('Please enter your password to confirm');
      return;
    }
    
    // In production, validate password with backend
    // For now, just update localStorage
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        user.email = newEmail;
        localStorage.setItem('zapzone_user', JSON.stringify(user));
        
        setCurrentEmail(newEmail);
        setSuccessMessage('Email updated successfully!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Reset and close modal
        setNewEmail('');
        setEmailPassword('');
        setShowEmailModal(false);
      } catch (error) {
        console.error('Error updating email:', error);
        alert('Failed to update email');
      }
    }
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword) {
      alert('Please enter your current password');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match!');
      return;
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long!');
      return;
    }

    // In production, validate and update password with backend
    // For now, just show success message
    
    setSuccessMessage('Password updated successfully!');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    
    // Reset and close modal
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(false);
  };

  const openEmailModal = () => {
    setNewEmail(currentEmail);
    setEmailPassword('');
    setShowEmailModal(true);
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Success Toast */}
        {showSuccess && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
            <CheckCircle size={20} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your preferences and account security</p>
        </div>

        {/* Account Information Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
          
          <div className="space-y-4">
            {/* Email Section */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 bg-${themeColor}-100 rounded-full flex items-center justify-center`}>
                  <Mail className={`text-${themeColor}-600`} size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Email Address</p>
                  <p className="text-sm text-gray-900">{currentEmail || 'No email set'}</p>
                </div>
              </div>
              <button
                onClick={openEmailModal}
                className={`px-4 py-2 text-sm font-medium text-${themeColor}-600 hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
              >
                Change Email
              </button>
            </div>

            {/* Password Section */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 bg-${themeColor}-100 rounded-full flex items-center justify-center`}>
                  <Lock className={`text-${themeColor}-600`} size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Password</p>
                  <p className="text-sm text-gray-500">••••••••</p>
                </div>
              </div>
              <button
                onClick={openPasswordModal}
                className={`px-4 py-2 text-sm font-medium text-${themeColor}-600 hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Theme Color Selection Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Palette className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Theme Color</h2>
              <p className="text-sm text-gray-600">Personalize your interface with your favorite color</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Color Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
              {AVAILABLE_COLORS.map((color) => {
                // Get the first two available shades for preview
                const shadeEntries = Object.entries(color.shades);
                const shade1 = shadeEntries[0]?.[1] || '#000';
                const shade2 = shadeEntries[1]?.[1] || shadeEntries[0]?.[1] || '#000';
                
                return (
                  <button
                    key={color.name}
                    onClick={() => handleColorSelect(color.name)}
                    className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                      selectedColor === color.name
                        ? 'border-gray-900 bg-gray-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    title={color.name}
                  >
                    <div className="flex gap-1">
                      <div
                        className="w-7 h-7 rounded-full shadow-sm border-2 border-white"
                        style={{ backgroundColor: shade1 }}
                      />
                      <div
                        className="w-7 h-7 rounded-full shadow-sm border-2 border-white"
                        style={{ backgroundColor: shade2 }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 capitalize truncate w-full text-center">
                      {color.name}
                    </span>
                    {selectedColor === color.name && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle size={16} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Color Preview */}
            <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Selected: {selectedColor}-{selectedShade}
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  AVAILABLE_COLORS.find((c) => c.name === selectedColor)?.shades || {}
                ).map(([shade, hex]) => (
                  <button
                    key={shade}
                    onClick={() => handleShadeSelect(shade)}
                    className={`group relative cursor-pointer transition-all ${
                      selectedShade === shade ? 'ring-4 ring-green-500 ring-offset-2' : 'hover:scale-110'
                    }`}
                    title={`${selectedColor}-${shade}: ${hex}`}
                  >
                    <div
                      className="w-14 h-14 rounded-lg shadow-md border-2 border-white"
                      style={{ backgroundColor: hex }}
                    />
                    {selectedShade === shade && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle size={14} className="text-white" />
                      </div>
                    )}
                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
                      <span className={`text-xs font-semibold ${
                        selectedShade === shade ? 'text-green-600' : 'text-gray-600'
                      } bg-white px-2 py-1 rounded shadow-sm whitespace-nowrap`}>
                        {shade}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Email Change Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in">
              <button
                onClick={() => setShowEmailModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
              
              <div className="mb-6">
                <div className={`w-12 h-12 bg-${themeColor}-100 rounded-full flex items-center justify-center mb-4`}>
                  <Mail className={`text-${themeColor}-600`} size={24} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Change Email Address</h3>
                <p className="text-sm text-gray-600 mt-1">Enter your new email and confirm with your password</p>
              </div>

              <form onSubmit={handleEmailUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={currentEmail}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="your.new.email@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEmailPassword ? 'text' : 'password'}
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-12`}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showEmailPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 px-4 py-3 bg-${themeColor}-600 text-white rounded-lg font-medium hover:bg-${themeColor}-700 transition-colors`}
                  >
                    Update Email
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
              
              <div className="mb-6">
                <div className={`w-12 h-12 bg-${themeColor}-100 rounded-full flex items-center justify-center mb-4`}>
                  <Lock className={`text-${themeColor}-600`} size={24} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Change Password</h3>
                <p className="text-sm text-gray-600 mt-1">Choose a strong password to keep your account secure</p>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-12`}
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-12`}
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-12`}
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 px-4 py-3 bg-${themeColor}-600 text-white rounded-lg font-medium hover:bg-${themeColor}-700 transition-colors`}
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
