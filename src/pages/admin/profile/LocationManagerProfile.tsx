import { useState, useEffect } from 'react';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Edit2, 
  Save, 
  X,
  Camera,
  Building,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { API_BASE_URL, ASSET_URL, getStoredUser, setStoredUser } from '../../../utils/storage';
import StandardButton from '../../../components/ui/StandardButton';
import type { LocationManagerProfileData } from '../../../types/LocationManagerProfile.types';
import { getAuthToken } from '../../../services';

const LocationManagerProfile = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Profile data state
  const [profileData, setProfileData] = useState<LocationManagerProfileData>({
    personal: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      avatar: '',
      department: '',
      employeeId: '',
      shift: '',
      hireDate: '',
      status: ''
    },
    location: {
      name: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: ''
      },
      timezone: '',
      isActive: true
    }
  });

  const [editedData, setEditedData] = useState(profileData);

  // Fetch user and location data on mount
  useEffect(() => {
    fetchProfileData();
  }, []);

  // Update profile picture when localStorage changes
  useEffect(() => {
    const user = getStoredUser();
    if (user?.profile_path && user.profile_path !== profileData.personal.avatar) {
      setProfileData(prev => ({
        ...prev,
        personal: {
          ...prev.personal,
          avatar: user.profile_path || ''
        }
      }));
    }
  }, [profileData.personal.avatar]);

  const fetchProfileData = async () => {
    setIsFetching(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      const user = getStoredUser();
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }
      
      if (!user) {
        setError('No user data found. Please log in again.');
        return;
      }
      
      if (!user.location_id) {
        setError('User has no location assigned. Please contact support.');
        return;
      }
      
      setUserId(user.id);
      setLocationId(user.location_id);

      // Fetch location data
      const locationResponse = await fetch(`${API_BASE_URL}/locations/${user.location_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!locationResponse.ok) {
        throw new Error('Failed to fetch location data');
      }

      const locationData = await locationResponse.json();
      const location = locationData.data;
      
      const newProfileData = {
        personal: {
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          email: user.email || '',
          phone: user.phone || '',
          position: user.position || '',
          avatar: user.profile_path || '',
          department: user.department || '',
          employeeId: user.employee_id || '',
          shift: user.shift || '',
          hireDate: user.hire_date || '',
          status: user.status || 'active'
        },
        location: {
          name: location.name || '',
          email: location.email || '',
          phone: location.phone || '',
          address: {
            street: location.address || '',
            city: location.city || '',
            state: location.state || '',
            zipCode: location.zip_code || ''
          },
          timezone: location.timezone || '',
          isActive: location.is_active !== undefined ? location.is_active : true
        }
      };

      setProfileData(newProfileData);
      setEditedData(newProfileData);
    } catch (err) {
      console.error('Fetch Profile Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile data');
    } finally {
      setIsFetching(false);
    }
  };

  const handleEdit = () => {
    setEditedData(profileData);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedData(profileData);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      
      if (!token || !userId || !locationId) {
        throw new Error('Missing authentication or user data');
      }
      
      // Update user data
      const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: editedData.personal.firstName,
          last_name: editedData.personal.lastName,
          email: editedData.personal.email,
          phone: editedData.personal.phone,
          position: editedData.personal.position,
          department: editedData.personal.department,
          employee_id: editedData.personal.employeeId,
          shift: editedData.personal.shift,
          hire_date: editedData.personal.hireDate || null,
          status: editedData.personal.status
        })
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to update personal information');
      }
      
      // const userData = await userResponse.json();
      
      // Update location data
      const locationResponse = await fetch(`${API_BASE_URL}/locations/${locationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editedData.location.name,
          email: editedData.location.email,
          phone: editedData.location.phone,
          address: editedData.location.address.street,
          city: editedData.location.address.city,
          state: editedData.location.address.state,
          zip_code: editedData.location.address.zipCode,
          timezone: editedData.location.timezone,
          is_active: editedData.location.isActive
        })
      });
      
      if (!locationResponse.ok) {
        throw new Error('Failed to update location information');
      }
      
      // Update localStorage with new user data
      setStoredUser({
        ...getStoredUser(),
        first_name: editedData.personal.firstName,
        last_name: editedData.personal.lastName,
        email: editedData.personal.email,
        phone: editedData.personal.phone,
        position: editedData.personal.position,
        department: editedData.personal.department,
        employee_id: editedData.personal.employeeId,
        shift: editedData.personal.shift,
        hire_date: editedData.personal.hireDate,
        status: editedData.personal.status
      }, true);
      
      setProfileData(editedData);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Save Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (section: keyof LocationManagerProfileData, field: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        address: {
          ...prev.location.address,
          [field]: value
        }
      }
    }));
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const token = getAuthToken();
        const response = await fetch(`${API_BASE_URL}/users/${userId}/update-profile-path`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_path: base64String
          })
        });

        if (!response.ok) {
          throw new Error('Failed to upload profile picture');
        }

        const data = await response.json();
        const newProfilePath = data.data.profile_path;
        
        // Update localStorage first
        const currentUser = getStoredUser();
        if (currentUser) {
          setStoredUser({
            ...currentUser,
            profile_path: newProfilePath
          }, true);
        }
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('zapzone_profile_updated'));
        
        // Then update component state
        setProfileData(prev => ({
          ...prev,
          personal: {
            ...prev.personal,
            avatar: newProfilePath
          }
        }));
        
        setSuccessMessage('Profile picture updated successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload Error:', err);
      setError('Failed to upload profile picture');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: User },
    { id: 'location', label: 'Location Details', icon: MapPin },
  ];

  if (isFetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto">
        {/* Success Message */}
        {successMessage && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
            <CheckCircle size={20} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
            <AlertCircle size={20} />
            <span>{error}</span>
            <StandardButton onClick={() => setError(null)} variant="ghost" size="sm" icon={X} className="ml-2 text-white hover:text-white hover:bg-red-600">
              {''}
            </StandardButton>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <div className="relative group">
                <div className="relative">
                  {profileData.personal.avatar ? (
                    <>
                      <img 
                        src={`${ASSET_URL}${profileData.personal.avatar}`}
                        alt="Profile" 
                        className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                        onError={(e) => {
                          console.error('Image failed to load:', `${ASSET_URL}${profileData.personal.avatar}`);
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <div className={`hidden w-20 h-20 bg-gradient-to-br from-${themeColor}-400 via-${themeColor}-600 to-${themeColor}-800 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white`}>
                        <span className="text-3xl font-bold tracking-tight">
                          {profileData.personal.firstName?.[0]?.toUpperCase() || ''}{profileData.personal.lastName?.[0]?.toUpperCase() || ''}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className={`w-20 h-20 bg-gradient-to-br from-${themeColor}-400 via-${themeColor}-600 to-${themeColor}-800 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white`}>
                      <span className="text-3xl font-bold tracking-tight">
                        {profileData.personal.firstName?.[0]?.toUpperCase() || ''}{profileData.personal.lastName?.[0]?.toUpperCase() || ''}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"></div>
                </div>
                <label className={`absolute -bottom-1 -right-1 bg-${fullColor} text-white p-2 rounded-full hover:bg-${themeColor}-900 transition cursor-pointer shadow-lg border-2 border-white group-hover:scale-110 transform`}>
                  <Camera size={16} />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                    disabled={uploadingPhoto}
                  />
                </label>
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-white"></div>
                      <span className="text-white text-xs mt-1">Uploading...</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profileData.personal.firstName} {profileData.personal.lastName}
                </h1>
                <p className="text-gray-600 flex items-center">
                  <Building size={16} className={`mr-1.5 text-${fullColor}`} />
                  {profileData.personal.position} • {profileData.location.name}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              {isEditing ? (
                <>
                  <StandardButton
                    onClick={handleCancel}
                    variant="secondary"
                    size="md"
                    icon={X}
                  >
                    Cancel
                  </StandardButton>
                  <StandardButton
                    onClick={handleSave}
                    disabled={isLoading}
                    loading={isLoading}
                    variant="primary"
                    size="md"
                    icon={Save}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </StandardButton>
                </>
              ) : (
                <StandardButton
                  onClick={handleEdit}
                  variant="primary"
                  size="md"
                  icon={Edit2}
                >
                  Edit Profile
                </StandardButton>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <StandardButton
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  variant="ghost"
                  size="md"
                  icon={Icon}
                  className={`rounded-none border-b-2 ${
                    activeTab === tab.id
                      ? `border-${fullColor} text-${fullColor} bg-${themeColor}-50`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </StandardButton>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Personal Information Tab */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <User size={20} className={`mr-2 text-${themeColor}-600`} />
                Personal Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.firstName : profileData.personal.firstName}
                    onChange={(e) => handleInputChange('personal', 'firstName', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.lastName : profileData.personal.lastName}
                    onChange={(e) => handleInputChange('personal', 'lastName', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Mail size={16} className="mr-2 text-gray-400" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={isEditing ? editedData.personal.email : profileData.personal.email}
                    onChange={(e) => handleInputChange('personal', 'email', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Phone size={16} className="mr-2 text-gray-400" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={isEditing ? editedData.personal.phone : profileData.personal.phone}
                    onChange={(e) => handleInputChange('personal', 'phone', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.position : profileData.personal.position}
                    onChange={(e) => handleInputChange('personal', 'position', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.department : profileData.personal.department}
                    onChange={(e) => handleInputChange('personal', 'department', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.employeeId : profileData.personal.employeeId}
                    onChange={(e) => handleInputChange('personal', 'employeeId', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shift</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.shift : profileData.personal.shift}
                    onChange={(e) => handleInputChange('personal', 'shift', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                    placeholder="e.g., Morning, Evening, Night"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hire Date</label>
                  <input
                    type="date"
                    value={isEditing ? editedData.personal.hireDate : profileData.personal.hireDate}
                    onChange={(e) => handleInputChange('personal', 'hireDate', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={isEditing ? editedData.personal.status : profileData.personal.status}
                    onChange={(e) => handleInputChange('personal', 'status', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Location Details Tab */}
          {activeTab === 'location' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <MapPin size={20} className={`mr-2 text-${themeColor}-600`} />
                Location Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location Name</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.location.name : profileData.location.name}
                    onChange={(e) => handleInputChange('location', 'name', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Mail size={16} className="mr-2 text-gray-400" />
                    Location Email
                  </label>
                  <input
                    type="email"
                    value={isEditing ? editedData.location.email : profileData.location.email}
                    onChange={(e) => handleInputChange('location', 'email', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Phone size={16} className="mr-2 text-gray-400" />
                    Location Phone
                  </label>
                  <input
                    type="tel"
                    value={isEditing ? editedData.location.phone : profileData.location.phone}
                    onChange={(e) => handleInputChange('location', 'phone', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.location.timezone : profileData.location.timezone}
                    onChange={(e) => handleInputChange('location', 'timezone', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                    placeholder="e.g., America/New_York"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location Status</label>
                  <select
                    value={isEditing ? (editedData.location.isActive ? 'active' : 'inactive') : (profileData.location.isActive ? 'active' : 'inactive')}
                    onChange={(e) => {
                      const newValue = e.target.value === 'active';
                      setEditedData(prev => ({
                        ...prev,
                        location: {
                          ...prev.location,
                          isActive: newValue
                        }
                      }));
                    }}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                    <MapPin size={18} className={`mr-2 text-${themeColor}-600`} />
                    Location Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.location.address.street : profileData.location.address.street}
                        onChange={(e) => handleAddressChange('street', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.location.address.city : profileData.location.address.city}
                        onChange={(e) => handleAddressChange('city', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.location.address.state : profileData.location.address.state}
                        onChange={(e) => handleAddressChange('state', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.location.address.zipCode : profileData.location.address.zipCode}
                        onChange={(e) => handleAddressChange('zipCode', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          
        </div>
      </div>
    </div>
  );
};

export default LocationManagerProfile;