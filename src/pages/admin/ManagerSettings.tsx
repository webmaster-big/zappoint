import { useState, useEffect } from 'react';
import { Save, Palette, Bell, Globe, Lock } from 'lucide-react';
import PageTitleSetter from '../../components/PageTitleSetter';
import Toast from '../../components/ui/Toast';
import type { ColorSelection, ColorShade } from '../../types/settings.types';
import { COLOR_OPTIONS, DEFAULT_COLOR } from '../../utils/colorOptions';

const ManagerSettings = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  const [selectedColor, setSelectedColor] = useState<ColorSelection>(DEFAULT_COLOR);
  const [selectedShade, setSelectedShade] = useState<ColorShade>(800);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false
  });
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private' | 'team'>('team');

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('zapzone_manager_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.colorScheme) {
          setSelectedColor(settings.colorScheme);
          setSelectedShade(settings.colorScheme.shade);
        }
        if (settings.notifications) setNotifications(settings.notifications);
        if (settings.language) setLanguage(settings.language);
        if (settings.timezone) setTimezone(settings.timezone);
        if (settings.profileVisibility) setProfileVisibility(settings.profileVisibility);
      }

      // Load color scheme
      const savedColor = localStorage.getItem('zapzone_color_scheme');
      if (savedColor) {
        const colorScheme = JSON.parse(savedColor);
        setSelectedColor(colorScheme);
        setSelectedShade(colorScheme.shade);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const handleSaveSettings = () => {
    try {
      const settings = {
        colorScheme: { name: selectedColor.name, shade: selectedShade },
        notifications,
        language,
        timezone,
        profileVisibility
      };

      // Save all settings
      localStorage.setItem('zapzone_manager_settings', JSON.stringify(settings));
      
      // Save color scheme separately for global access
      localStorage.setItem('zapzone_color_scheme', JSON.stringify({ name: selectedColor.name, shade: selectedShade }));

      setToastMessage('Settings saved successfully!');
      setToastType('success');
      setShowToast(true);

      // Dispatch event for other components to update
      window.dispatchEvent(new Event('zapzone_color_scheme_updated'));
    } catch (error) {
      console.error('Error saving settings:', error);
      setToastMessage('Failed to save settings');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleColorSelect = (colorName: string) => {
    const color = COLOR_OPTIONS.find(c => c.name === colorName);
    if (color) {
      setSelectedColor({ name: color.name, shade: selectedShade });
    }
  };

  const getCurrentColorHex = (): string => {
    const color = COLOR_OPTIONS.find(c => c.name === selectedColor.name);
    if (color) {
      return color.shades[selectedShade];
    }
    return COLOR_OPTIONS.find(c => c.name === DEFAULT_COLOR.name)?.shades[DEFAULT_COLOR.shade] || '#1e40af';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageTitleSetter />
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your preferences and account settings</p>
      </div>

      <div className="space-y-6">
        {/* Color Scheme Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Palette className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Color Scheme</h2>
              <p className="text-sm text-gray-600">Customize the application's color theme</p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="mb-6 p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <div 
                className="w-20 h-20 rounded-lg shadow-md border-2 border-white"
                style={{ backgroundColor: getCurrentColorHex() }}
              />
              <div>
                <p className="font-semibold text-gray-900 capitalize">
                  {selectedColor.name} {selectedShade}
                </p>
                <p className="text-sm text-gray-600">{getCurrentColorHex()}</p>
              </div>
            </div>
          </div>

          {/* Color Selection Grid */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Color
            </label>
            <div className="grid grid-cols-7 gap-3">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorSelect(color.name)}
                  className={`group relative aspect-square rounded-lg transition-all ${
                    selectedColor.name === color.name
                      ? 'ring-4 ring-offset-2 ring-gray-900 scale-110'
                      : 'hover:scale-105 hover:shadow-lg'
                  }`}
                  style={{ backgroundColor: color.shades[selectedShade] }}
                  title={color.label}
                >
                  {selectedColor.name === color.name && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-gray-900 rounded-full" />
                      </div>
                    </div>
                  )}
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {color.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Shade Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Shade
            </label>
            <div className="grid grid-cols-9 gap-2">
              {([200, 300, 400, 500, 600, 700, 800, 900, 950] as ColorShade[]).map((shade) => {
                const color = COLOR_OPTIONS.find(c => c.name === selectedColor.name);
                return (
                  <button
                    key={shade}
                    onClick={() => setSelectedShade(shade)}
                    className={`aspect-square rounded-lg transition-all ${
                      selectedShade === shade
                        ? 'ring-4 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105 hover:shadow-md'
                    }`}
                    style={{ backgroundColor: color?.shades[shade] }}
                    title={`${shade}`}
                  >
                    <span className={`text-xs font-bold ${shade >= 700 ? 'text-white' : 'text-gray-900'}`}>
                      {shade}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Bell className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-600">Manage how you receive notifications</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-600">Receive push notifications in browser</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.push}
                onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
              <div>
                <p className="font-medium text-gray-900">SMS Notifications</p>
                <p className="text-sm text-gray-600">Receive notifications via SMS</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.sms}
                onChange={(e) => setNotifications({ ...notifications, sms: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Lock className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Privacy</h2>
              <p className="text-sm text-gray-600">Control your privacy settings</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Profile Visibility
            </label>
            <select
              value={profileVisibility}
              onChange={(e) => setProfileVisibility(e.target.value as 'public' | 'private' | 'team')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="public">Public - Everyone can see</option>
              <option value="team">Team - Only team members can see</option>
              <option value="private">Private - Only you can see</option>
            </select>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Globe className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Preferences</h2>
              <p className="text-sm text-gray-600">Customize your experience</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            <Save size={20} />
            Save Settings
          </button>
        </div>
      </div>

      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default ManagerSettings;
