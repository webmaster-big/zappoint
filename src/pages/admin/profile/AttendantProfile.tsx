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
  CheckCircle,
  BadgeCheck
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { API_BASE_URL, ASSET_URL, getStoredUser, setStoredUser } from '../../../utils/storage';
import StandardButton from '../../../components/ui/StandardButton';
import type { AttendantProfileData } from '../../../types/AttendantProfile.types';
import { getAuthToken } from '../../../services';

const AttendantProfile = () => {
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
  const [profileData, setProfileData] = useState<AttendantProfileData>({
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

  const handleInputChange = (section: keyof AttendantProfileData, field: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // const handleAddressChange = (field: string, value: string) => {
  //   setEditedData(prev => ({
  //     ...prev,
  //     location: {
  //       ...prev.location,
  //       address: {
  //         ...prev.location.address,
  //         [field]: value
  //       }
  //     }
  //   }));
  // };

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
    { id: 'location', label: 'Location Details', icon: MapPin }
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
                {profileData.personal.avatar ? (
                  <div className="relative">
                    <img 
                      src={`${ASSET_URL}${profileData.personal.avatar}`}
                      alt="Profile" 
                      className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                      onError={(e) => {
                        console.error('Image failed to load:', `${ASSET_URL}${profileData.personal.avatar}`);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 rounded-full bg-black opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className={`w-20 h-20 bg-gradient-to-br from-${themeColor}-400 via-${themeColor}-600 to-${themeColor}-800 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white`}>
                      <span className="text-3xl font-bold tracking-tight">
                        {profileData.personal.firstName?.[0]?.toUpperCase() || ''}{profileData.personal.lastName?.[0]?.toUpperCase() || ''}
                      </span>
                    </div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                )}
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
                <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <BadgeCheck size={14} className={`mr-1 text-${fullColor}`} />
                    ID: {profileData.personal.employeeId}
                  </span>
                </div>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Building size={20} className={`mr-2 text-${themeColor}-600`} />
                  Location Information
                </h2>
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  profileData.location.isActive 
                    ? `bg-green-100 text-green-700 border border-green-200` 
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {profileData.location.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="space-y-6">
                  {/* Location Name */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{profileData.location.name}</h3>
                    <p className="text-sm text-gray-500">Assigned Location</p>
                  </div>

                  <div className="border-t border-gray-300 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Email */}
                      <div className="flex items-start space-x-3">
                        <Mail size={18} className={`text-${themeColor}-600 mt-0.5`} />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Email</p>
                          <p className="text-gray-900 mt-0.5">{profileData.location.email}</p>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-start space-x-3">
                        <Phone size={18} className={`text-${themeColor}-600 mt-0.5`} />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Phone</p>
                          <p className="text-gray-900 mt-0.5">{profileData.location.phone}</p>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="flex items-start space-x-3 md:col-span-2">
                        <MapPin size={18} className={`text-${themeColor}-600 mt-0.5`} />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Address</p>
                          <p className="text-gray-900 mt-0.5">
                            {profileData.location.address.street}<br />
                            {profileData.location.address.city}, {profileData.location.address.state} {profileData.location.address.zipCode}
                          </p>
                        </div>
                      </div>

                      {/* Timezone */}
                      <div className="flex items-start space-x-3">
                        <svg className={`w-[18px] h-[18px] text-${themeColor}-600 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Timezone</p>
                          <p className="text-gray-900 mt-0.5">{profileData.location.timezone}</p>
                        </div>
                      </div>
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

export default AttendantProfile;