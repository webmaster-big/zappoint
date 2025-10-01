import { useState } from 'react';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Edit2, 
  Save, 
  X,
  Camera,
  Clock,
  Calendar,
  BadgeCheck,
  Zap
} from 'lucide-react';

const AttendantProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(false);

  // Sample profile data for Attendant/Staff
  const [profileData, setProfileData] = useState({
    personal: {
      firstName: 'Jessica',
      lastName: 'Rodriguez',
      email: 'jessica.rodriguez@brighton.zapzone.com',
      phone: '+1 (555) 234-5678',
      position: 'Attendant',
      avatar: '/api/placeholder/100/100',
      hireDate: '2024-01-10',
      employeeId: 'ZAP-BTN-0487',
      department: 'Guest Services'
    },
    location: {
      name: 'Zap Zone Brighton',
      manager: 'Michael Chen',
      address: {
        street: '456 Entertainment Avenue',
        city: 'Brighton',
        state: 'MI',
        zipCode: '48116'
      },
      assignedAreas: ['Laser Tag Arena', 'Arcade Zone', 'Customer Service'],
      shift: 'Evening Shift (2:00 PM - 10:00 PM)'
    },
    schedule: {
      currentWeek: [
        { day: 'Monday', date: '2024-09-16', shift: '2:00 PM - 10:00 PM', area: 'Laser Tag' },
        { day: 'Tuesday', date: '2024-09-17', shift: '2:00 PM - 10:00 PM', area: 'Arcade' },
        { day: 'Wednesday', date: '2024-09-18', shift: '2:00 PM - 10:00 PM', area: 'Customer Service' },
        { day: 'Thursday', date: '2024-09-19', shift: '2:00 PM - 10:00 PM', area: 'Laser Tag' },
        { day: 'Friday', date: '2024-09-20', shift: '4:00 PM - 12:00 AM', area: 'VR Experience' },
        { day: 'Saturday', date: '2024-09-21', shift: 'OFF', area: '' },
        { day: 'Sunday', date: '2024-09-22', shift: 'OFF', area: '' }
      ],
      nextWeek: [
        { day: 'Monday', date: '2024-09-23', shift: '2:00 PM - 10:00 PM', area: 'Arcade' },
        { day: 'Tuesday', date: '2024-09-24', shift: '2:00 PM - 10:00 PM', area: 'Laser Tag' },
        { day: 'Wednesday', date: '2024-09-25', shift: '2:00 PM - 10:00 PM', area: 'Customer Service' },
        { day: 'Thursday', date: '2024-09-26', shift: '2:00 PM - 10:00 PM', area: 'VR Experience' },
        { day: 'Friday', date: '2024-09-27', shift: '4:00 PM - 12:00 AM', area: 'Laser Tag' },
        { day: 'Saturday', date: '2024-09-28', shift: '12:00 PM - 8:00 PM', area: 'Arcade' },
        { day: 'Sunday', date: '2024-09-29', shift: 'OFF', area: '' }
      ]
    }
  });

  const [editedData, setEditedData] = useState(profileData);

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
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProfileData(editedData);
    setIsEditing(false);
    setIsLoading(false);
  };

  const handleInputChange = (section: string, field: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'location', label: 'Work Details', icon: MapPin },
    { id: 'schedule', label: 'My Schedule', icon: Calendar }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-800 to-blue-800 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {profileData.personal.firstName[0]}{profileData.personal.lastName[0]}
                </div>
                <button className="absolute -bottom-1 -right-1 bg-blue-800 text-white p-1.5 rounded-full hover:bg-blue-700 transition">
                  <Camera size={14} />
                </button>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profileData.personal.firstName} {profileData.personal.lastName}
                </h1>
                <p className="text-gray-600 flex items-center">
                  <Zap size={16} className="mr-1.5 text-blue-800" />
                  {profileData.personal.position} • {profileData.location.name}
                </p>
                <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <BadgeCheck size={14} className="mr-1 text-blue-800" />
                    ID: {profileData.personal.employeeId}
                  </span>
                 
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition flex items-center"
                  >
                    <X size={18} className="mr-2" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition flex items-center disabled:opacity-50"
                  >
                    <Save size={18} className="mr-2" />
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition flex items-center"
                >
                  <Edit2 size={18} className="mr-2" />
                  Edit Profile
                </button>
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
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-all ${
                    activeTab === tab.id
                      ? 'border-blue-800 text-blue-800 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} className="mr-2" />
                  {tab.label}
                </button>
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
                <User size={20} className="mr-2 text-blue-800" />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.lastName : profileData.personal.lastName}
                    onChange={(e) => handleInputChange('personal', 'lastName', e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                  <input
                    type="text"
                    value={profileData.personal.employeeId}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.personal.department : profileData.personal.department}
                    onChange={(e) => handleInputChange('personal', 'department', e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hire Date</label>
                  <input
                    type="date"
                    value={isEditing ? editedData.personal.hireDate : profileData.personal.hireDate}
                    onChange={(e) => handleInputChange('personal', 'hireDate', e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Work Details Tab */}
          {activeTab === 'location' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <MapPin size={20} className="mr-2 text-blue-800" />
                Work Details
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Location</label>
                  <input
                    type="text"
                    value={profileData.location.name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location Manager</label>
                  <input
                    type="text"
                    value={profileData.location.manager}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Regular Shift</label>
                  <input
                    type="text"
                    value={isEditing ? editedData.location.shift : profileData.location.shift}
                    onChange={(e) => handleInputChange('location', 'shift', e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Work Areas</label>
                  <div className="flex flex-wrap gap-2">
                    {profileData.location.assignedAreas.map((area, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                    <MapPin size={18} className="mr-2 text-blue-800" />
                    Location Address
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{profileData.location.address.street}</p>
                    <p className="text-gray-700">{profileData.location.address.city}, {profileData.location.address.state} {profileData.location.address.zipCode}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

       
          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar size={20} className="mr-2 text-blue-800" />
                My Schedule
              </h2>
              
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock size={18} className="mr-2 text-blue-800" />
                  Current Week (September 16-22)
                </h3>
                <div className="space-y-3">
                  {profileData.schedule.currentWeek.map((day, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-lg border ${
                      day.shift === 'OFF' 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-20 font-medium text-gray-700">{day.day}</div>
                        <div className="text-sm text-gray-500">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${
                          day.shift === 'OFF' ? 'text-gray-600' : 'text-blue-700'
                        }`}>
                          {day.shift}
                        </div>
                        {day.area && <div className="text-sm text-gray-600">{day.area}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock size={18} className="mr-2 text-blue-800" />
                  Next Week (September 23-29)
                </h3>
                <div className="space-y-3">
                  {profileData.schedule.nextWeek.map((day, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-lg border ${
                      day.shift === 'OFF' 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-20 font-medium text-gray-700">{day.day}</div>
                        <div className="text-sm text-gray-500">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${
                          day.shift === 'OFF' ? 'text-gray-600' : 'text-blue-700'
                        }`}>
                          {day.shift}
                        </div>
                        {day.area && <div className="text-sm text-gray-600">{day.area}</div>}
                      </div>
                    </div>
                  ))}
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