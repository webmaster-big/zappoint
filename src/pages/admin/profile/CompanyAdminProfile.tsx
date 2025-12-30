import { useState, useEffect } from 'react';
import { 
  User, 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  Edit2, 
  Save, 
  X,
  Camera,
  Shield,
  Users,
  Calendar,
  Globe,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { API_BASE_URL, ASSET_URL, getStoredUser, setStoredUser } from '../../../utils/storage';
import StandardButton from '../../../components/ui/StandardButton';
import type { CompanyAdminProfileData } from '../../../types/CompanyAdminProfile.types';
import { getAuthToken } from '../../../services';

const CompanyAdminProfile = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Profile data state
  const [profileData, setProfileData] = useState<CompanyAdminProfileData>({
    personal: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      avatar: '',
      employeeId: '',
      department: ''
    },
    company: {
      name: '',
      industry: '',
      email: '',
      phone: '',
      website: '',
      foundedDate: '',
      description: '',
      logoPath: '',
      taxId: '',
      registrationNumber: '',
      companySize: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    business: {
      totalLocations: 0,
      totalEmployees: 0
    }
  });

  const [editedData, setEditedData] = useState(profileData);

  // Fetch user and company data on mount
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
      
      if (!user.company_id) {
        setError('User has no company assigned. Please contact support.');
        return;
      }

      // Check if we have complete user data in localStorage
      const hasCompleteUserData = user.first_name && user.last_name && user.email;
      
      // Check if we have company data cached in a separate localStorage key
      const cachedCompanyData = localStorage.getItem(`company_${user.company_id}`);
      const cachedBusinessMetrics = localStorage.getItem(`business_metrics_${user.company_id}`);
      
      let company;
      let totalLocations = 0;
      let totalEmployees = 0;
      
      // If we have complete cached data, use it; otherwise fetch from API
      if (hasCompleteUserData && cachedCompanyData && cachedBusinessMetrics) {
        // Use cached data
        company = JSON.parse(cachedCompanyData);
        const metrics = JSON.parse(cachedBusinessMetrics);
        totalLocations = metrics.totalLocations;
        
        // Recalculate total employees from cached company users (excluding company_admin)
        if (company.users && Array.isArray(company.users)) {
          totalEmployees = company.users.filter((u: any) => u.role !== 'company_admin').length;
        } else {
          totalEmployees = metrics.totalEmployees;
        }
      } else {
        // Fetch company data from API
        const companyResponse = await fetch(`${API_BASE_URL}/companies/${user.company_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!companyResponse.ok) {
          throw new Error('Failed to fetch company data');
        }

        const companyData = await companyResponse.json();
        company = companyData.data;
        
        // Cache company data
        localStorage.setItem(`company_${user.company_id}`, JSON.stringify(company));
        
        // Calculate total locations from company data if available
        if (company.locations && Array.isArray(company.locations)) {
          totalLocations = company.locations.length;
        } else {
          // Fallback: Fetch locations count for this company
          const locationsResponse = await fetch(`${API_BASE_URL}/locations`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (locationsResponse.ok) {
            const locationsData = await locationsResponse.json();
            const locations = Array.isArray(locationsData.data) ? locationsData.data : [];
            totalLocations = locations.filter((loc: any) => loc.company_id === user.company_id).length;
          }
        }
        
        // Calculate total employees from company data if available (excluding company_admin)
        if (company.users && Array.isArray(company.users)) {
          totalEmployees = company.users.filter((u: any) => u.role !== 'company_admin').length;
        } else {
          // Fallback: Fetch employees count for this company (excluding company_admin role)
          const usersResponse = await fetch(`${API_BASE_URL}/users`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const users = Array.isArray(usersData.data) ? usersData.data : [];
            totalEmployees = users.filter((u: any) => 
              u.company_id === user.company_id && u.role !== 'company_admin'
            ).length;
          }
        }
        
        // Cache business metrics
        localStorage.setItem(`business_metrics_${user.company_id}`, JSON.stringify({
          totalLocations,
          totalEmployees
        }));
      }
      
      const newProfileData = {
        personal: {
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          email: user.email || '',
          phone: user.phone || '',
          position: user.position || '',
          avatar: user.profile_path || '',
          employeeId: user.employee_id || '',
          department: user.department || ''
        },
        company: {
          name: company.company_name || '',
          industry: company.industry || '',
          email: company.email || '',
          phone: company.phone || '',
          website: company.website || '',
          foundedDate: company.founded_date || '',
          description: company.description || '',
          logoPath: company.logo_path || '',
          taxId: company.tax_id || '',
          registrationNumber: company.registration_number || '',
          companySize: company.company_size || '',
          address: company.address || '',
          city: company.city || '',
          state: company.state || '',
          zipCode: company.zip_code || '',
          country: company.country || ''
        },
        business: {
          totalLocations: totalLocations,
          totalEmployees: totalEmployees
        }
      };

      // Store company logo in localStorage for sidebar access
      if (company.logo_path) {
        localStorage.setItem('company_logo_path', company.logo_path);
        // Dispatch event so AdminSidebar can update
        window.dispatchEvent(new CustomEvent('zapzone_company_logo_updated', {
          detail: { logoPath: company.logo_path }
        }));
      }

      console.log('Profile avatar path:', user.profile_path);
      console.log('Full avatar URL:', `${ASSET_URL}${user.profile_path}`);
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
    setSuccessMessage(null);
    
    try {
      const token = getAuthToken();
      const userId = getStoredUser()?.id;
      const companyId = getStoredUser()?.company_id;
      console.log('Saving profile for user ID:', userId, 'and company ID:', companyId);
      if (!token) {
        throw new Error('Not authenticated');
      }



      // Update user data (personal information)
      const userPayload = {
        first_name: editedData.personal.firstName,
        last_name: editedData.personal.lastName,
        email: editedData.personal.email,
        phone: editedData.personal.phone,
        position: editedData.personal.position,
        employee_id: editedData.personal.employeeId,
        department: editedData.personal.department,
      };

      const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userPayload),
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.message || 'Failed to update user data');
      }

      // Update company data
      const companyPayload = {
        company_name: editedData.company.name,
        email: editedData.company.email,
        phone: editedData.company.phone,
        website: editedData.company.website,
        tax_id: editedData.company.taxId,
        registration_number: editedData.company.registrationNumber,
        address: editedData.company.address,
        city: editedData.company.city,
        state: editedData.company.state,
        zip_code: editedData.company.zipCode,
        country: editedData.company.country,
        industry: editedData.company.industry,
        company_size: editedData.company.companySize,
        founded_date: editedData.company.foundedDate,
        description: editedData.company.description,
      };

      const companyResponse = await fetch(`${API_BASE_URL}/companies/${companyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyPayload),
      });

      if (!companyResponse.ok) {
        const errorData = await companyResponse.json();
        throw new Error(errorData.message || 'Failed to update company data');
      }

      setProfileData(editedData);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      
      // Update stored user data in localStorage
      const storedUser = getStoredUser();
      if (storedUser) {
        storedUser.first_name = editedData.personal.firstName;
        storedUser.last_name = editedData.personal.lastName;
        storedUser.email = editedData.personal.email;
        storedUser.phone = editedData.personal.phone;
        storedUser.position = editedData.personal.position;
        storedUser.employee_id = editedData.personal.employeeId;
        storedUser.department = editedData.personal.department;
        setStoredUser(storedUser);
      }
      
      // Update cached company data
      if (companyId) {
        const companyCache = {
          company_name: editedData.company.name,
          email: editedData.company.email,
          phone: editedData.company.phone,
          website: editedData.company.website,
          tax_id: editedData.company.taxId,
          registration_number: editedData.company.registrationNumber,
          address: editedData.company.address,
          city: editedData.company.city,
          state: editedData.company.state,
          zip_code: editedData.company.zipCode,
          country: editedData.company.country,
          industry: editedData.company.industry,
          company_size: editedData.company.companySize,
          founded_date: editedData.company.foundedDate,
          description: editedData.company.description,
        };
        localStorage.setItem(`company_${companyId}`, JSON.stringify(companyCache));
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (section: keyof CompanyAdminProfileData, field: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // const handleBusinessChange = (field: string, value: string | number) => {
  //   setEditedData(prev => ({
  //     ...prev,
  //     business: {
  //       ...prev.business,
  //       [field]: value
  //     }
  //   }));
  // };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const token = getAuthToken();
      const userId = getStoredUser()?.id;
      
      if (!token || !userId) {
        throw new Error('Not authenticated');
      }

      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          const base64String = reader.result as string;

          const response = await fetch(`${API_BASE_URL}/users/${userId}/update-profile-path`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              profile_path: base64String,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to upload profile photo');
          }

          const result = await response.json();
          const newProfilePath = result.data?.profile_path || result.profile_path;

          console.log('New profile path from API:', newProfilePath);

          // Update stored user data first
          const storedUser = getStoredUser();
          if (storedUser) {
            storedUser.profile_path = newProfilePath;
            setStoredUser(storedUser);
            console.log('Updated localStorage with new profile_path:', newProfilePath);
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

          setEditedData(prev => ({
            ...prev,
            personal: {
              ...prev.personal,
              avatar: newProfilePath
            }
          }));

          setSuccessMessage('Profile photo updated successfully!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to upload profile photo');
        } finally {
          setUploadingPhoto(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read image file');
        setUploadingPhoto(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload profile photo');
      setUploadingPhoto(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 20MB for logo)
    if (file.size > 20 * 1024 * 1024) {
      setError('Logo size should be less than 20MB');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      const token = getAuthToken();
      const companyId = getStoredUser()?.company_id;
      
      if (!token || !companyId) {
        throw new Error('Not authenticated');
      }

      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          const base64String = reader.result as string;

          const response = await fetch(`${API_BASE_URL}/companies/${companyId}/logo`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              logo_path: base64String,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to upload company logo');
          }

          const result = await response.json();
          const newLogoPath = result.data?.logo_path;

          console.log('New logo path from API:', newLogoPath);

          // Update cached company data
          const cachedCompany = localStorage.getItem(`company_${companyId}`);
          if (cachedCompany) {
            const companyData = JSON.parse(cachedCompany);
            companyData.logo_path = newLogoPath;
            localStorage.setItem(`company_${companyId}`, JSON.stringify(companyData));
          }

          // Store company logo in a separate key for easy access by sidebar/layout
          localStorage.setItem('company_logo_path', newLogoPath || '');

          // Dispatch custom event to notify sidebar and other components
          window.dispatchEvent(new CustomEvent('zapzone_company_logo_updated', {
            detail: { logoPath: newLogoPath }
          }));

          // Update component state
          setProfileData(prev => ({
            ...prev,
            company: {
              ...prev.company,
              logoPath: newLogoPath || ''
            }
          }));

          setEditedData(prev => ({
            ...prev,
            company: {
              ...prev.company,
              logoPath: newLogoPath || ''
            }
          }));

          setSuccessMessage('Company logo updated successfully!');
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to upload company logo');
        } finally {
          setUploadingLogo(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read image file');
        setUploadingLogo(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload company logo');
      setUploadingLogo(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: User },
    { id: 'company', label: 'Company Details', icon: Building },
    { id: 'business', label: 'Business Overview', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto">
        {/* Loading State */}
        {isFetching && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <p className="text-sm text-green-700 mt-1">{successMessage}</p>
            </div>
          </div>
        )}

        {!isFetching && (
          <>
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
                  <Shield size={16} className={`mr-1.5 text-${fullColor}`} />
                  Company Administrator
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Position/Title</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.position : profileData.personal.position}
                    onChange={(e) => handleInputChange('personal', 'position', e.target.value)}
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
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.department : profileData.personal.department}
                    onChange={(e) => handleInputChange('personal', 'department', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Company Details Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Building size={20} className={`mr-2 text-${themeColor}-600`} />
                Company Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.company.name : profileData.company.name}
                    onChange={(e) => handleInputChange('company', 'name', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>

                {/* Company Logo Upload */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                  <div className="flex items-center space-x-4">
                    <div className="relative group">
                      {profileData.company.logoPath ? (
                        <div className="relative">
                          <img 
                            src={`${ASSET_URL}${profileData.company.logoPath}`}
                            alt="Company Logo" 
                            className="w-24 h-24 rounded-lg object-contain border-2 border-gray-200 bg-white p-2"
                            onError={(e) => {
                              console.error('Logo failed to load:', `${ASSET_URL}${profileData.company.logoPath}`);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 rounded-lg bg-black opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        </div>
                      ) : (
                        <div className={`w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300`}>
                          <Building className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                      <label className={`absolute -bottom-1 -right-1 bg-${fullColor} text-white p-2 rounded-full hover:bg-${themeColor}-900 transition cursor-pointer shadow-lg border-2 border-white group-hover:scale-110 transform`}>
                        <Camera size={16} />
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleLogoUpload} 
                          className="hidden" 
                          disabled={uploadingLogo}
                        />
                      </label>
                      {uploadingLogo && (
                        <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-white"></div>
                            <span className="text-white text-xs mt-1">Uploading...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>Upload your company logo</p>
                      <p className="text-xs">Max size: 20MB. Supported: PNG, JPG, SVG</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Mail size={16} className="mr-2 text-gray-400" />
                    Company Email
                  </label>
                  <input
                    type="email"
                    value={isEditing ? editedData.company.email : profileData.company.email}
                    onChange={(e) => handleInputChange('company', 'email', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Phone size={16} className="mr-2 text-gray-400" />
                    Company Phone
                  </label>
                  <input
                    type="tel"
                    value={isEditing ? editedData.company.phone : profileData.company.phone}
                    onChange={(e) => handleInputChange('company', 'phone', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Globe size={16} className="mr-2 text-gray-400" />
                    Website
                  </label>
                  <input
                    type="url"
                    value={isEditing ? editedData.company.website : profileData.company.website}
                    onChange={(e) => handleInputChange('company', 'website', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.company.industry : profileData.company.industry}
                    onChange={(e) => handleInputChange('company', 'industry', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Size</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.company.companySize : profileData.company.companySize}
                    onChange={(e) => handleInputChange('company', 'companySize', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g., 1-10, 11-50, 51-200"
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar size={16} className="mr-2 text-gray-400" />
                    Founded Date
                  </label>
                  <input
                    type="date"
                    value={isEditing ? editedData.company.foundedDate : profileData.company.foundedDate}
                    onChange={(e) => handleInputChange('company', 'foundedDate', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.company.taxId : profileData.company.taxId}
                    onChange={(e) => handleInputChange('company', 'taxId', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.company.registrationNumber : profileData.company.registrationNumber}
                    onChange={(e) => handleInputChange('company', 'registrationNumber', e.target.value)}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={isEditing ? editedData.company.description : profileData.company.description}
                    onChange={(e) => handleInputChange('company', 'description', e.target.value)}
                    disabled={!isEditing}
                    rows={3}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none`}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                    <MapPin size={18} className={`mr-2 text-${themeColor}-600`} />
                    Company Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.company.address : profileData.company.address}
                        onChange={(e) => handleInputChange('company', 'address', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.company.city : profileData.company.city}
                        onChange={(e) => handleInputChange('company', 'city', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State/Province</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.company.state : profileData.company.state}
                        onChange={(e) => handleInputChange('company', 'state', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ZIP/Postal Code</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.company.zipCode : profileData.company.zipCode}
                        onChange={(e) => handleInputChange('company', 'zipCode', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                      <input
                        type="text"
                        value={isEditing ? editedData.company.country : profileData.company.country}
                        onChange={(e) => handleInputChange('company', 'country', e.target.value)}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-500`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Business Overview Tab */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users size={20} className={`mr-2 text-${themeColor}-600`} />
                Business Metrics
              </h2>
              
              <p className="text-sm text-gray-600">
                These metrics are automatically calculated based on your company's locations and employees.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`bg-${themeColor}-50 rounded-lg p-6 text-center`}>
                  <div className={`text-3xl font-bold text-${fullColor} mb-2`}>{profileData.business.totalLocations}</div>
                  <div className="text-sm font-medium text-gray-700">Total Locations</div>
                </div>
                <div className={`bg-${themeColor}-50 rounded-lg p-6 text-center`}>
                  <div className={`text-3xl font-bold text-${fullColor} mb-2`}>{profileData.business.totalEmployees}</div>
                  <div className="text-sm font-medium text-gray-700">Total Employees</div>
                </div>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default CompanyAdminProfile;