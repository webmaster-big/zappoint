import { useState, useEffect } from 'react';
import { Palette, Lock, Mail, CheckCircle, X, Eye, EyeOff, Building2, MapPin, Trash2 } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  getAuthorizeNetAccount,
  getAllAuthorizeNetAccounts,
  connectAuthorizeNetAccount,
  disconnectAuthorizeNetAccount,
  updateUserEmail,
  updateUserPassword,
  saveThemeColor,
  getThemeColor,
  updateStoredUser,
} from '../../services/SettingsService';
import type {
  SettingsColorOption,
  SettingsAuthorizeNetAccount,
  SettingsLocation,
} from '../../types/settings.types';
import { getStoredUser } from '../../utils/storage';


const AVAILABLE_COLORS: SettingsColorOption[] = [
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
  
  // Authorize.Net states
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false);
  const [authorizeConnected, setAuthorizeConnected] = useState(false);
  const [authorizeAccount, setAuthorizeAccount] = useState<SettingsAuthorizeNetAccount | null>(null);
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [authorizeTransactionKey, setAuthorizeTransactionKey] = useState('');
  const [authorizePublicClientKey, setAuthorizePublicClientKey] = useState('');
  const [authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [showTransactionKey, setShowTransactionKey] = useState(false);
  const [showPublicClientKey, setShowPublicClientKey] = useState(false);
  const [loadingAuthorize, setLoadingAuthorize] = useState(false);
  const [loadingAuthorizeAccount, setLoadingAuthorizeAccount] = useState(true);
  
  // Company Admin - All Accounts Modal
  const [showAllAccountsModal, setShowAllAccountsModal] = useState(false);
  const [allAuthorizeAccounts, setAllAuthorizeAccounts] = useState<SettingsAuthorizeNetAccount[]>([]);
  const [loadingAllAccounts, setLoadingAllAccounts] = useState(false);
  
  // Company Admin - Connect for specific location
  const [availableLocations, setAvailableLocations] = useState<SettingsLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  
  // User role
  const [userRole, setUserRole] = useState<string>('');
  
  useEffect(() => {
    // Load saved color from localStorage
    const { color, shade } = getThemeColor();
    
    // Validate that the saved color exists
    const colorObj = AVAILABLE_COLORS.find((c) => c.name === color);
    if (colorObj) {
      setSelectedColor(color);
      
      // Validate that the saved shade exists for this color
      const availableShades = Object.keys(colorObj.shades);
      if (availableShades.includes(shade)) {
        setSelectedShade(shade);
      } else {
        // Use the first available shade if saved shade doesn't exist
        const firstShade = availableShades[0] || '500';
        setSelectedShade(firstShade);
        saveThemeColor(color, firstShade);
      }
    } else {
      // Default to blue if saved color doesn't exist
      setSelectedColor('blue');
      setSelectedShade('800');
    }

    // Load user data from localStorage
    const user = getStoredUser();
    if (user) {
      setCurrentEmail(user.email || '');
      setUserRole(user.role || '');
    }
    
    // Fetch Authorize.Net account status
    fetchAuthorizeAccount();
  }, []);
  
  const fetchAllAuthorizeAccounts = async () => {
    setLoadingAllAccounts(true);
    try {
      const response = await getAllAuthorizeNetAccounts();
      if (response.success) {
        const accounts = response.data || [];
        setAllAuthorizeAccounts(accounts);
        
        // For company_admin, determine which locations don't have accounts
        if (userRole === 'company_admin') {
          // Get all unique locations from accounts
          const allLocations = accounts.map(acc => acc.location);
          const connectedLocationIds = accounts.map(acc => acc.location_id);
          
          // Filter to get locations without accounts
          // Note: Backend should ideally provide all locations, not just connected ones
          // For now, we'll use locations from accounts
          setAvailableLocations(allLocations.filter(loc => 
            !connectedLocationIds.includes(loc.id)
          ));
        }
      }
    } catch (error) {
      console.error('Error fetching all Authorize.Net accounts:', error);
    } finally {
      setLoadingAllAccounts(false);
    }
  };
  
  const fetchAuthorizeAccount = async () => {
    setLoadingAuthorizeAccount(true);
    try {
      const data = await getAuthorizeNetAccount();
      if (data.connected && data.account) {
        setAuthorizeConnected(true);
        setAuthorizeAccount(data.account);
      } else {
        setAuthorizeConnected(false);
        setAuthorizeAccount(null);
      }
    } catch (error) {
      console.error('Error fetching Authorize.Net account:', error);
    } finally {
      setLoadingAuthorizeAccount(false);
    }
  };

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
    saveThemeColor(colorName, shadeToUse);
    
    setSuccessMessage(`Theme color updated to ${colorName}-${shadeToUse}!`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleShadeSelect = (shade: string) => {
    setSelectedShade(shade);
    saveThemeColor(selectedColor, shade);
    
    setSuccessMessage(`Theme color updated to ${selectedColor}-${shade}!`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailPassword) {
      alert('Please enter your password to confirm');
      return;
    }
    
    try {
      const user = getStoredUser();
      
      if (!user) {
        alert('Session expired. Please log in again.');
        return;
      }
      
      const response = await updateUserEmail(user.id, {
        new_email: newEmail,
        password: emailPassword,
      });
      
      if (response.success) {
        // Update localStorage with new user data
        updateStoredUser(response.data);
        
        // Update UI state immediately
        setCurrentEmail(newEmail);
        
        // Show success message
        setSuccessMessage('Email updated successfully!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Reset and close modal
        setNewEmail('');
        setEmailPassword('');
        setShowEmailModal(false);
      } else {
        alert(response.message || 'Failed to update email');
      }
    } catch (error: any) {
      console.error('Error updating email:', error);
      alert(error.response?.data?.message || 'Failed to update email. Please try again.');
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
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

    try {
      const user = getStoredUser();
      
      if (!user) {
        alert('Session expired. Please log in again.');
        return;
      }
      
      const response = await updateUserPassword(user.id, {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      
      if (response.success) {
        // Update localStorage if backend returns updated user data
        if (response.data) {
          updateStoredUser(response.data);
        }
        
        // Show success message - password UI doesn't need state update
        setSuccessMessage('Password updated successfully!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Reset and close modal
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(false);
      } else {
        alert(response.message || 'Failed to update password');
      }
    } catch (error: any) {
      console.error('Error updating password:', error);
      alert(error.response?.data?.message || 'Failed to update password. Please try again.');
    }
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
  
  const handleAuthorizeConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For company_admin, require location selection
    if (userRole === 'company_admin' && !selectedLocationId) {
      alert('Please select a location to connect Authorize.Net');
      return;
    }
    
    setLoadingAuthorize(true);
    
    try {
      const response = await connectAuthorizeNetAccount({
        api_login_id: authorizeApiLoginId,
        transaction_key: authorizeTransactionKey,
        public_client_key: authorizePublicClientKey,
        environment: authorizeEnvironment,
        ...(userRole === 'company_admin' && selectedLocationId && { location_id: selectedLocationId }),
      });
      
      if (response.success) {
        // Update UI state immediately
        const newAccount: SettingsAuthorizeNetAccount = {
          id: response.data?.id || Date.now(),
          location_id: selectedLocationId || 0,
          environment: authorizeEnvironment,
          is_active: true,
          connected_at: new Date().toISOString(),
          location: {
            id: selectedLocationId || 0,
            name: availableLocations.find(loc => loc.id === selectedLocationId)?.name || '',
            city: availableLocations.find(loc => loc.id === selectedLocationId)?.city || '',
            state: availableLocations.find(loc => loc.id === selectedLocationId)?.state || '',
          },
        };
        
        // Update connected state immediately
        if (userRole !== 'company_admin') {
          setAuthorizeConnected(true);
          setAuthorizeAccount(newAccount);
        }
        
        // For company_admin, add to all accounts list
        if (userRole === 'company_admin') {
          setAllAuthorizeAccounts(prev => [...prev, newAccount]);
          // Remove from available locations
          setAvailableLocations(prev => prev.filter(loc => loc.id !== selectedLocationId));
        }
        
        // Show success message
        setSuccessMessage('Authorize.Net account connected successfully!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Reset form fields
        setAuthorizeApiLoginId('');
        setAuthorizeTransactionKey('');
        setAuthorizePublicClientKey('');
        setSelectedLocationId(null);
        setLoadingAuthorize(false);
        
        // Close modal
        setShowAuthorizeModal(false);
      } else {
        setLoadingAuthorize(false);
        alert(response.message || 'Failed to connect Authorize.Net account');
      }
    } catch (error: any) {
      console.error('Error connecting Authorize.Net:', error);
      setLoadingAuthorize(false);
      alert(error.response?.data?.message || 'Failed to connect account. Please try again.');
    }
  };
  
  const handleAuthorizeDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Authorize.Net account? This will affect payment processing.')) {
      return;
    }
    
    try {
      const response = await disconnectAuthorizeNetAccount();
      
      if (response.success) {
        // Update UI state immediately - no refetch needed
        setAuthorizeConnected(false);
        setAuthorizeAccount(null);
        
        // Show success message
        setSuccessMessage('Authorize.Net account disconnected successfully');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert(response.message || 'Failed to disconnect account');
      }
    } catch (error: any) {
      console.error('Error disconnecting Authorize.Net:', error);
      alert(error.response?.data?.message || 'Failed to disconnect account. Please try again.');
    }
  };
  
  const handleLocationDisconnect = async (locationId: number, locationName: string) => {
    if (!confirm(`Are you sure you want to disconnect Authorize.Net for ${locationName}? This will affect payment processing at this location.`)) {
      return;
    }
    
    try {
      const response = await disconnectAuthorizeNetAccount(locationId);
      
      if (response.success) {
        // Find the disconnected account to get location details
        const disconnectedAccount = allAuthorizeAccounts.find(acc => acc.location_id === locationId);
        
        // Update UI state immediately - remove from all accounts list
        setAllAuthorizeAccounts(prev => prev.filter(acc => acc.location_id !== locationId));
        
        // Add back to available locations if we have the account details
        if (disconnectedAccount) {
          setAvailableLocations(prev => [...prev, disconnectedAccount.location]);
        }
        
        // Show success message
        setSuccessMessage(`Authorize.Net disconnected for ${locationName}`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert(response.message || 'Failed to disconnect account');
      }
    } catch (error: any) {
      console.error('Error disconnecting Authorize.Net:', error);
      alert(error.response?.data?.message || 'Failed to disconnect account. Please try again.');
    }
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

        {/* Authorize.Net Integration Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Integration</h2>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            {loadingAuthorizeAccount ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <span className="text-sm text-gray-600">Loading payment integration...</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${authorizeConnected ? 'bg-green-100' : 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                    <svg className={`w-6 h-6 ${authorizeConnected ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Authorize.Net</p>
                    {authorizeConnected ? (
                      <div className="space-y-1">
                        <p className="text-sm text-green-600 font-medium">✓ Connected</p>
                        <p className="text-xs text-gray-500">Environment: <span className="font-semibold capitalize">{authorizeAccount?.environment}</span></p>
                        {authorizeAccount?.connected_at && (
                          <p className="text-xs text-gray-500">Connected: {new Date(authorizeAccount.connected_at).toLocaleDateString()}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Not connected</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {userRole === 'company_admin' && (
                    <button
                      onClick={() => {
                        setShowAllAccountsModal(true);
                        fetchAllAuthorizeAccounts();
                      }}
                      className={`px-4 py-2 text-sm font-medium text-${themeColor}-600 hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors flex items-center gap-2`}
                    >
                      <Building2 size={16} />
                      View All
                    </button>
                  )}
                  {authorizeConnected ? (
                    <button
                      onClick={handleAuthorizeDisconnect}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAuthorizeModal(true)}
                      className={`px-4 py-2 text-sm font-medium text-${themeColor}-600 hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                    >
                      Connect Account
                    </button>
                  )}
                </div>
              </div>
            )}
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 relative animate-scale-in">
              <button
                onClick={() => setShowEmailModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">Change Email Address</h3>
                <p className="text-xs text-gray-600 mt-1">Enter your new email and confirm with your password</p>
              </div>

              <form onSubmit={handleEmailUpdate} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={currentEmail}
                    disabled
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="your.new.email@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEmailPassword ? 'text' : 'password'}
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-10`}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showEmailPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 px-3 py-2 text-sm bg-${themeColor}-600 text-white rounded-lg font-medium hover:bg-${themeColor}-700 transition-colors`}
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 relative animate-scale-in">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">Change Password</h3>
                <p className="text-xs text-gray-600 mt-1">Choose a strong password to keep your account secure</p>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-10`}
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-10`}
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-10`}
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 px-3 py-2 text-sm bg-${themeColor}-600 text-white rounded-lg font-medium hover:bg-${themeColor}-700 transition-colors`}
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Company Admin - All Authorize.Net Accounts Modal */}
        {showAllAccountsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 bg-${themeColor}-100 rounded-full flex items-center justify-center`}>
                      <Building2 className={`text-${themeColor}-600`} size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">All Authorize.Net Connections</h3>
                      <p className="text-sm text-gray-600 mt-1">View all connected Authorize.Net accounts across locations</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAllAccountsModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingAllAccounts ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                  </div>
                ) : allAuthorizeAccounts.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">No accounts connected</h3>
                    <p className="mt-2 text-sm text-gray-500">No locations have connected their Authorize.Net accounts yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {allAuthorizeAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin size={16} className={`text-${themeColor}-600`} />
                              <span className="font-semibold text-gray-900">
                                {account.location.name}
                              </span>
                              <span className="text-sm text-gray-500">
                                {account.location.city}, {account.location.state}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                account.environment === 'production'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {account.environment === 'production' ? 'Production' : 'Sandbox'}
                              </span>
                              {account.is_active && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              {account.api_login_id && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">API Login ID</p>
                                  <p className="text-sm font-mono bg-gray-50 px-3 py-2 rounded border border-gray-200">
                                    {account.api_login_id}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Connected</p>
                                <p className="text-sm text-gray-700">
                                  {new Date(account.connected_at).toLocaleString()}
                                </p>
                              </div>
                              {account.last_tested_at && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Last Tested</p>
                                  <p className="text-sm text-gray-700">
                                    {new Date(account.last_tested_at).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4 flex flex-col items-end gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              account.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`}></div>
                            <button
                              onClick={() => handleLocationDisconnect(account.location_id, account.location.name)}
                              className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                              title="Disconnect this location"
                            >
                              <Trash2 size={14} />
                              Disconnect
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAllAccountsModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowAllAccountsModal(false);
                      setShowAuthorizeModal(true);
                    }}
                    className={`flex-1 px-4 py-3 bg-${themeColor}-600 text-white rounded-lg font-medium hover:bg-${themeColor}-700 transition-colors`}
                  >
                    Connect New Location
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Authorize.Net Connection Modal */}
        {showAuthorizeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 relative animate-scale-in">
              <button
                onClick={() => {
                  setShowAuthorizeModal(false);
                  setAuthorizeApiLoginId('');
                  setAuthorizeTransactionKey('');
                  setAuthorizePublicClientKey('');
                  setSelectedLocationId(null);
                  setShowTransactionKey(false);
                  setShowPublicClientKey(false);
                }}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">Connect Authorize.Net</h3>
                <p className="text-xs text-gray-600 mt-1">Enter your Authorize.Net credentials to enable payment processing</p>
              </div>

              <form onSubmit={handleAuthorizeConnect} className="space-y-3">
                {userRole === 'company_admin' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Select Location
                    </label>
                    <select
                      value={selectedLocationId || ''}
                      onChange={(e) => setSelectedLocationId(Number(e.target.value))}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      required
                    >
                      <option value="">Choose a location...</option>
                      {availableLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} - {location.city}, {location.state}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Only showing locations without Authorize.Net connection
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    API Login ID
                  </label>
                  <input
                    type="text"
                    value={authorizeApiLoginId}
                    onChange={(e) => setAuthorizeApiLoginId(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="Enter API Login ID"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Transaction Key
                  </label>
                  <div className="relative">
                    <input
                      type={showTransactionKey ? 'text' : 'password'}
                      value={authorizeTransactionKey}
                      onChange={(e) => setAuthorizeTransactionKey(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-10`}
                      placeholder="Enter Transaction Key"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowTransactionKey(!showTransactionKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showTransactionKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Public Client Key
                  </label>
                  <div className="relative">
                    <input
                      type={showPublicClientKey ? 'text' : 'password'}
                      value={authorizePublicClientKey}
                      onChange={(e) => setAuthorizePublicClientKey(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 pr-10`}
                      placeholder="Enter Public Client Key"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPublicClientKey(!showPublicClientKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPublicClientKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Required for Accept.js payment processing
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Environment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthorizeEnvironment('sandbox')}
                      className={`px-3 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                        authorizeEnvironment === 'sandbox'
                          ? `border-${themeColor}-600 bg-${themeColor}-50 text-${themeColor}-700`
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Sandbox
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthorizeEnvironment('production')}
                      className={`px-3 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                        authorizeEnvironment === 'production'
                          ? `border-${themeColor}-600 bg-${themeColor}-50 text-${themeColor}-700`
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Production
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                  <div className="flex gap-2">
                    <svg className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                    </svg>
                    <div className="text-xs text-yellow-800">
                      <p className="font-semibold mb-0.5">Important</p>
                      <p>Use <span className="font-semibold">Sandbox</span> for testing. Only switch to <span className="font-semibold">Production</span> when you're ready to accept real payments.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthorizeModal(false);
                      setAuthorizeApiLoginId('');
                      setAuthorizeTransactionKey('');
                      setAuthorizePublicClientKey('');
                      setSelectedLocationId(null);
                      setShowTransactionKey(false);
                      setShowPublicClientKey(false);
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    disabled={loadingAuthorize}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 px-3 py-2 text-sm bg-${themeColor}-600 text-white rounded-lg font-medium hover:bg-${themeColor}-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={loadingAuthorize}
                  >
                    {loadingAuthorize ? 'Connecting...' : 'Connect Account'}
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
