import { useState, useEffect, useCallback } from 'react';
import { Palette, Lock, Mail, X, Eye, EyeOff, Building2, MapPin, Trash2, CheckCircle, Calendar, RefreshCw, ExternalLink } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import StandardButton from '../../components/ui/StandardButton';
import Toast from '../../components/ui/Toast';
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
import locationService from '../../services/LocationService';
import type { Location } from '../../services/LocationService';
import {
  getGoogleCalendarStatus,
  getGoogleCalendarAuthUrl,
  disconnectGoogleCalendar,
  listGoogleCalendars,
  setGoogleCalendar,
  syncGoogleCalendar,
  getAllGoogleCalendarConnections,
} from '../../services/GoogleCalendarService';
import type {
  GoogleCalendarStatus,
  GoogleCalendar,
  GoogleCalendarSyncResult,
  GoogleCalendarConnection,
} from '../../types/googleCalendar.types';


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
  const [sidebarLayout, setSidebarLayout] = useState<'dropdown' | 'grouped'>('dropdown');
  
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
  
  // Google Calendar states
  const [gcalLocations, setGcalLocations] = useState<SettingsLocation[]>([]);
  const [gcalSelectedLocationId, setGcalSelectedLocationId] = useState<number | null>(null);
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatus | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);
  const [gcalCalendars, setGcalCalendars] = useState<GoogleCalendar[]>([]);
  const [gcalLoadingCalendars, setGcalLoadingCalendars] = useState(false);
  const [gcalSyncFromDate, setGcalSyncFromDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [gcalSyncResult, setGcalSyncResult] = useState<GoogleCalendarSyncResult | null>(null);
  const [gcalChangingCalendar, setGcalChangingCalendar] = useState(false);
  
  // Google Calendar - All Connections (company_admin)
  const [showGcalAllModal, setShowGcalAllModal] = useState(false);
  const [allGcalConnections, setAllGcalConnections] = useState<GoogleCalendarConnection[]>([]);
  const [loadingGcalAll, setLoadingGcalAll] = useState(false);
  
  // Google Calendar - user location_id for auto-select
  const [userLocationId, setUserLocationId] = useState<number | null>(null);
  
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
    
    // Load saved sidebar layout from localStorage
    const savedLayout = localStorage.getItem('zapzone_sidebar_layout');
    if (savedLayout === 'dropdown' || savedLayout === 'grouped') {
      setSidebarLayout(savedLayout);
    }

    // Load user data from localStorage
    const user = getStoredUser();
    if (user) {
      setCurrentEmail(user.email || '');
      setUserRole(user.role || '');
      // Auto-set location for non-company_admin users
      if (user.location_id && user.role !== 'company_admin') {
        setUserLocationId(user.location_id);
        setGcalSelectedLocationId(user.location_id);
      }
    }
    
    // Fetch Authorize.Net account status
    fetchAuthorizeAccount();
    
    // Fetch locations for Google Calendar
    fetchGcalLocations();
    
    // Handle Google Calendar OAuth redirect (from URL params if popup fails)
    handleGcalRedirect();
    
    // Listen for popup message
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_CALENDAR_CONNECTED') {
        const locId = event.data.location_id;
        setSuccessMessage('Google Calendar connected successfully!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        if (locId) {
          setGcalSelectedLocationId(Number(locId));
          fetchGcalStatus(Number(locId));
        }
      }
      if (event.data?.type === 'GOOGLE_CALENDAR_ERROR') {
        alert(`Google Calendar connection failed: ${event.data.error}`);
      }
    };
    window.addEventListener('message', handleMessage);
    
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // ── Google Calendar helpers ──────────────────────────────
  
  const fetchGcalLocations = async () => {
    try {
      const locationsResponse = await locationService.getLocations();
      const allLocations: Location[] = locationsResponse.data || [];
      setGcalLocations(
        allLocations.map((loc: Location) => ({
          id: loc.id,
          name: loc.name,
          city: loc.city || '',
          state: loc.state || '',
        }))
      );
      // Auto-fetch status for non-company_admin users with a location
      const user = getStoredUser();
      if (user?.location_id && user.role !== 'company_admin') {
        fetchGcalStatus(user.location_id);
      }
    } catch (error) {
      console.error('Error fetching locations for Google Calendar:', error);
    }
  };

  const fetchGcalStatus = useCallback(async (locationId: number) => {
    setGcalLoading(true);
    setGcalSyncResult(null);
    try {
      const response = await getGoogleCalendarStatus(locationId);
      if (response.success) {
        setGcalStatus(response.data);
        // If connected, fetch available calendars
        if (response.data.is_connected) {
          fetchGcalCalendars(locationId);
        } else {
          setGcalCalendars([]);
        }
      } else {
        setGcalStatus(null);
      }
    } catch (error) {
      console.error('Error fetching Google Calendar status:', error);
      setGcalStatus(null);
    } finally {
      setGcalLoading(false);
    }
  }, []);

  const fetchGcalCalendars = async (locationId: number) => {
    setGcalLoadingCalendars(true);
    try {
      const response = await listGoogleCalendars(locationId);
      if (response.success) {
        setGcalCalendars(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching Google Calendars:', error);
    } finally {
      setGcalLoadingCalendars(false);
    }
  };

  const handleGcalRedirect = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      const locationId = params.get('location_id');
      setSuccessMessage('Google Calendar connected successfully!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      window.history.replaceState({}, '', window.location.pathname);
      if (locationId) {
        const locId = Number(locationId);
        setGcalSelectedLocationId(locId);
        fetchGcalStatus(locId);
      }
    }
    if (params.get('error')) {
      alert(`Google Calendar connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleGcalLocationChange = (locationId: number) => {
    setGcalSelectedLocationId(locationId);
    setGcalStatus(null);
    setGcalCalendars([]);
    setGcalSyncResult(null);
    if (locationId) {
      fetchGcalStatus(locationId);
    }
  };

  const handleGcalConnect = async () => {
    if (!gcalSelectedLocationId) return;
    setGcalConnecting(true);
    try {
      const response = await getGoogleCalendarAuthUrl(gcalSelectedLocationId);
      if (response.success && response.data?.auth_url) {
        // Open Google consent in a centered popup window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          response.data.auth_url,
          'google-calendar-auth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
        
        // Poll for popup close (fallback if postMessage doesn't fire)
        if (popup) {
          const pollTimer = setInterval(() => {
            if (popup.closed) {
              clearInterval(pollTimer);
              // Re-check status after popup closes
              if (gcalSelectedLocationId) {
                fetchGcalStatus(gcalSelectedLocationId);
              }
              setGcalConnecting(false);
            }
          }, 500);
        } else {
          // Popup blocked — fall back to redirect
          window.location.href = response.data.auth_url;
        }
      } else {
        alert('Failed to get authorization URL');
        setGcalConnecting(false);
      }
    } catch (error: any) {
      console.error('Error getting Google Calendar auth URL:', error);
      alert(error.response?.data?.message || 'Failed to start Google Calendar connection');
      setGcalConnecting(false);
    }
  };

  const handleGcalDisconnect = async () => {
    if (!gcalSelectedLocationId) return;
    if (!confirm('Are you sure you want to disconnect Google Calendar for this location? Bookings will no longer sync.')) return;
    setGcalDisconnecting(true);
    try {
      const response = await disconnectGoogleCalendar(gcalSelectedLocationId);
      if (response.success) {
        setSuccessMessage('Google Calendar disconnected');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setGcalStatus(null);
        setGcalCalendars([]);
        setGcalSyncResult(null);
        fetchGcalStatus(gcalSelectedLocationId);
      } else {
        alert(response.message || 'Failed to disconnect Google Calendar');
      }
    } catch (error: any) {
      console.error('Error disconnecting Google Calendar:', error);
      alert(error.response?.data?.message || 'Failed to disconnect. Please try again.');
    } finally {
      setGcalDisconnecting(false);
    }
  };

  const handleGcalCalendarChange = async (calendarId: string) => {
    if (!gcalSelectedLocationId) return;
    setGcalChangingCalendar(true);
    try {
      const response = await setGoogleCalendar({
        location_id: gcalSelectedLocationId,
        calendar_id: calendarId,
      });
      if (response.success) {
        setSuccessMessage('Google Calendar updated');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        fetchGcalStatus(gcalSelectedLocationId);
      } else {
        alert(response.message || 'Failed to update calendar');
      }
    } catch (error: any) {
      console.error('Error setting calendar:', error);
      alert(error.response?.data?.message || 'Failed to update calendar');
    } finally {
      setGcalChangingCalendar(false);
    }
  };

  const handleGcalSync = async () => {
    if (!gcalSelectedLocationId) return;
    setGcalSyncing(true);
    setGcalSyncResult(null);
    try {
      const response = await syncGoogleCalendar({
        location_id: gcalSelectedLocationId,
        from_date: gcalSyncFromDate,
      });
      if (response.success) {
        setGcalSyncResult(response.data);
        setSuccessMessage('Bookings synced to Google Calendar!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        fetchGcalStatus(gcalSelectedLocationId);
      } else {
        alert(response.message || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Error syncing Google Calendar:', error);
      alert(error.response?.data?.message || 'Sync failed. Please try again.');
    } finally {
      setGcalSyncing(false);
    }
  };

  const fetchAllGcalConnections = async () => {
    setLoadingGcalAll(true);
    try {
      const response = await getAllGoogleCalendarConnections();
      if (response.success) {
        setAllGcalConnections(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching all Google Calendar connections:', error);
    } finally {
      setLoadingGcalAll(false);
    }
  };

  const handleGcalLocationDisconnect = async (locationId: number, locationName: string) => {
    if (!confirm(`Are you sure you want to disconnect Google Calendar for ${locationName}?`)) return;
    try {
      const response = await disconnectGoogleCalendar(locationId);
      if (response.success) {
        setSuccessMessage(`Google Calendar disconnected for ${locationName}`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        fetchAllGcalConnections();
        // If we're also viewing this location inline, refresh
        if (gcalSelectedLocationId === locationId) {
          fetchGcalStatus(locationId);
        }
      } else {
        alert(response.message || 'Failed to disconnect');
      }
    } catch (error: any) {
      console.error('Error disconnecting Google Calendar:', error);
      alert(error.response?.data?.message || 'Failed to disconnect. Please try again.');
    }
  };

  const fetchAllAuthorizeAccounts = async () => {
    setLoadingAllAccounts(true);
    try {
      const response = await getAllAuthorizeNetAccounts();
      if (response.success) {
        const accounts = response.data || [];
        setAllAuthorizeAccounts(accounts);
        
        // For company_admin, fetch all company locations and filter out connected ones
        if (userRole === 'company_admin') {
          const connectedLocationIds = accounts.map(acc => acc.location_id);
          
          try {
            const locationsResponse = await locationService.getLocations();
            const allLocations: Location[] = locationsResponse.data || [];
            
            // Filter to only show locations that don't already have an Authorize.Net account
            setAvailableLocations(
              allLocations
                .filter((loc: Location) => !connectedLocationIds.includes(loc.id))
                .map((loc: Location) => ({ id: loc.id, name: loc.name, city: loc.city || '', state: loc.state || '' }))
            );
          } catch (locError) {
            console.error('Error fetching locations:', locError);
            setAvailableLocations([]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching all Authorize.Net accounts:', error);
    } finally {
      setLoadingAllAccounts(false);
    }
  };
  
  const fetchAuthorizeAccount = async (showLoading = true) => {
    if (showLoading) setLoadingAuthorizeAccount(true);
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
        
        // Update UI state immediately using server response
        setCurrentEmail(response.data?.email || newEmail);
        
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
        
        // Update UI state immediately based on user role
        if (userRole === 'company_admin') {
          // For company_admin, refetch all accounts to get updated list
          fetchAllAuthorizeAccounts();
        } else {
          // For location_admin, immediately show connected state
          if (response.data) {
            setAuthorizeConnected(true);
            setAuthorizeAccount(response.data);
          }
          // Also silently refetch in background to ensure data consistency
          fetchAuthorizeAccount(false);
        }
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
        // Show success message
        setSuccessMessage('Authorize.Net account disconnected successfully');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Update UI state immediately
        setAuthorizeConnected(false);
        setAuthorizeAccount(null);
        
        // For company_admin, also refresh the all-accounts list if it was loaded
        if (userRole === 'company_admin' && allAuthorizeAccounts.length > 0) {
          fetchAllAuthorizeAccounts();
        }
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
        // Show success message
        setSuccessMessage(`Authorize.Net disconnected for ${locationName}`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Refetch all accounts to update the UI
        fetchAllAuthorizeAccounts();
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
          <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
            <Toast message={successMessage} type="success" onClose={() => setShowSuccess(false)} />
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
              <StandardButton
                onClick={openEmailModal}
                variant="ghost"
                size="sm"
              >
                Change Email
              </StandardButton>
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
              <StandardButton
                onClick={openPasswordModal}
                variant="ghost"
                size="sm"
              >
                Change Password
              </StandardButton>
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
                    <StandardButton
                      onClick={() => {
                        setShowAllAccountsModal(true);
                        fetchAllAuthorizeAccounts();
                      }}
                      variant="ghost"
                      size="sm"
                      icon={Building2}
                    >
                      View All
                    </StandardButton>
                  )}
                  {authorizeConnected ? (
                    <StandardButton
                      onClick={handleAuthorizeDisconnect}
                      variant="danger"
                      size="sm"
                    >
                      Disconnect
                    </StandardButton>
                  ) : (
                    <StandardButton
                      onClick={() => setShowAuthorizeModal(true)}
                      variant="ghost"
                      size="sm"
                    >
                      Connect Account
                    </StandardButton>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Google Calendar Integration Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Google Calendar</h2>
            {userRole === 'company_admin' && (
              <StandardButton
                onClick={() => {
                  setShowGcalAllModal(true);
                  fetchAllGcalConnections();
                }}
                variant="ghost"
                size="sm"
                icon={Building2}
              >
                View All
              </StandardButton>
            )}
          </div>

          {/* Location Selector */}
          {userRole === 'company_admin' ? (
            <div className="mb-4">
              <select
                value={gcalSelectedLocationId || ''}
                onChange={(e) => handleGcalLocationChange(Number(e.target.value))}
                className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
              >
                <option value="">Select a location...</option>
                {gcalLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}{loc.city ? ` — ${loc.city}` : ''}{loc.state ? `, ${loc.state}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : userLocationId ? (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} className={`text-${themeColor}-500`} />
              <span className="font-medium">
                {gcalLocations.find(l => l.id === userLocationId)?.name || `Location #${userLocationId}`}
              </span>
              {(() => {
                const loc = gcalLocations.find(l => l.id === userLocationId);
                return loc?.city ? (
                  <span className="text-gray-400">· {loc.city}{loc.state ? `, ${loc.state}` : ''}</span>
                ) : null;
              })()}
            </div>
          ) : null}

          <div className="p-4 bg-gray-50 rounded-lg">
            {!gcalSelectedLocationId ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Calendar className="text-gray-400" size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Google Calendar</p>
                  <p className="text-sm text-gray-500">{userRole === 'company_admin' ? 'Select a location to manage calendar sync' : 'No location assigned'}</p>
                </div>
              </div>
            ) : gcalLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                  <span className="text-sm text-gray-500">Checking status...</span>
                </div>
              </div>
            ) : gcalStatus && !gcalStatus.credentials_configured ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Calendar className="text-yellow-600" size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-800">Not Available</p>
                  <p className="text-xs text-yellow-700">Google API credentials not configured. Contact your administrator.</p>
                </div>
              </div>
            ) : gcalStatus && !gcalStatus.is_connected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Calendar className="text-gray-400" size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Google Calendar</p>
                    <p className="text-sm text-gray-500">Not connected</p>
                  </div>
                </div>
                <StandardButton
                  onClick={handleGcalConnect}
                  variant="primary"
                  size="sm"
                  loading={gcalConnecting}
                  disabled={gcalConnecting}
                  icon={ExternalLink}
                >
                  Connect
                </StandardButton>
              </div>
            ) : gcalStatus && gcalStatus.is_connected ? (
              <div className="space-y-3">
                {/* Connected status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="text-green-600" size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-green-800">Connected</p>
                        {gcalStatus.last_synced_at && (
                          <span className="text-xs text-gray-400 hidden sm:inline">· Synced {new Date(gcalStatus.last_synced_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{gcalStatus.google_account_email}</p>
                    </div>
                  </div>
                  <StandardButton
                    onClick={handleGcalDisconnect}
                    variant="danger"
                    size="sm"
                    loading={gcalDisconnecting}
                    disabled={gcalDisconnecting}
                  >
                    Disconnect
                  </StandardButton>
                </div>

                {/* Calendar & Sync — compact layout */}
                <div className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Calendar</label>
                    {gcalLoadingCalendars ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                        Loading...
                      </div>
                    ) : (
                      <select
                        value={gcalStatus.calendar_id || 'primary'}
                        onChange={(e) => handleGcalCalendarChange(e.target.value)}
                        disabled={gcalChangingCalendar}
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:opacity-50`}
                      >
                        {gcalCalendars.length === 0 && <option value="primary">Primary Calendar</option>}
                        {gcalCalendars.map((cal) => (
                          <option key={cal.id} value={cal.id}>
                            {cal.summary}{cal.primary ? ' (primary)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sync bookings from</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={gcalSyncFromDate}
                        onChange={(e) => setGcalSyncFromDate(e.target.value)}
                        className={`flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      />
                      <StandardButton
                        onClick={handleGcalSync}
                        variant="primary"
                        size="sm"
                        loading={gcalSyncing}
                        disabled={gcalSyncing}
                        icon={RefreshCw}
                      >
                        Sync
                      </StandardButton>
                    </div>
                  </div>
                </div>

                {/* Sync result */}
                {gcalSyncResult && (
                  <div className="text-xs text-gray-600 px-3 py-2 bg-white rounded border border-gray-200">
                    <span className="text-green-600 font-semibold">{gcalSyncResult.created}</span> created · {' '}
                    <span className="text-yellow-600 font-semibold">{gcalSyncResult.skipped}</span> skipped · {' '}
                    <span className="text-red-600 font-semibold">{gcalSyncResult.failed}</span> failed
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Theme Color Selection Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
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
                  <StandardButton
                    key={color.name}
                    onClick={() => handleColorSelect(color.name)}
                    variant="ghost"
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
                  </StandardButton>
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
                  <StandardButton
                    key={shade}
                    onClick={() => handleShadeSelect(shade)}
                    variant="ghost"
                    className={`group relative cursor-pointer transition-all p-0 ${
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
                  </StandardButton>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Layout Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sidebar Layout</h2>
          <p className="text-sm text-gray-600 mb-6">Choose how navigation items are displayed in the sidebar</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dropdown Layout */}
            <StandardButton
              onClick={() => {
                setSidebarLayout('dropdown');
                localStorage.setItem('zapzone_sidebar_layout', 'dropdown');
                window.dispatchEvent(new Event('zapzone_sidebar_layout_changed'));
                setSuccessMessage('Sidebar layout updated to Dropdown');
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
              }}
              variant="ghost"
              className={`relative p-5 rounded-xl border-2 transition-all text-left hover:scale-[1.02] h-auto ${
                sidebarLayout === 'dropdown'
                  ? `border-${themeColor}-600 bg-${themeColor}-50 shadow-md`
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Dropdown</h4>
                  <p className="text-xs text-gray-600 mt-1">Collapsible sections with nested items</p>
                </div>
                {sidebarLayout === 'dropdown' && (
                  <div className={`w-6 h-6 bg-${themeColor}-600 rounded-full flex items-center justify-center`}>
                    <CheckCircle size={16} className="text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-1.5 text-xs bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span>▼ Bookings</span>
                </div>
                <div className="ml-5 space-y-1">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <span>Calendar View</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <span>Manage Bookings</span>
                  </div>
                </div>
              </div>
            </StandardButton>

            {/* Grouped Layout */}
            <StandardButton
              onClick={() => {
                setSidebarLayout('grouped');
                localStorage.setItem('zapzone_sidebar_layout', 'grouped');
                window.dispatchEvent(new Event('zapzone_sidebar_layout_changed'));
                setSuccessMessage('Sidebar layout updated to Grouped');
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
              }}
              variant="ghost"
              className={`relative p-5 rounded-xl border-2 transition-all text-left hover:scale-[1.02] h-auto ${
                sidebarLayout === 'grouped'
                  ? `border-${themeColor}-600 bg-${themeColor}-50 shadow-md`
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Grouped</h4>
                  <p className="text-xs text-gray-600 mt-1">Section headers with flat navigation</p>
                </div>
                {sidebarLayout === 'grouped' && (
                  <div className={`w-6 h-6 bg-${themeColor}-600 rounded-full flex items-center justify-center`}>
                    <CheckCircle size={16} className="text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-1.5 text-xs bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-gray-400 font-bold uppercase tracking-wider text-[10px] mb-1">Management</div>
                <div className="flex items-center gap-2 text-gray-700">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span>Calendar View</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span>Manage Bookings</span>
                </div>
              </div>
            </StandardButton>
          </div>
        </div>

        {/* Email Change Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => setShowEmailModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 relative animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <StandardButton
                onClick={() => setShowEmailModal(false)}
                variant="ghost"
                size="sm"
                icon={X}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              />
              
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
                    <StandardButton
                      type="button"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                      variant="ghost"
                      size="sm"
                      icon={showEmailPassword ? EyeOff : Eye}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <StandardButton
                    variant="secondary"
                    onClick={() => setShowEmailModal(false)}
                    fullWidth
                  >
                    Cancel
                  </StandardButton>
                  <StandardButton
                    type="submit"
                    variant="primary"
                    fullWidth
                  >
                    Update Email
                  </StandardButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => setShowPasswordModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 relative animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <StandardButton
                onClick={() => setShowPasswordModal(false)}
                variant="ghost"
                size="sm"
                icon={X}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              />
              
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
                    <StandardButton
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      variant="ghost"
                      size="sm"
                      icon={showCurrentPassword ? EyeOff : Eye}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0"
                    />
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
                    <StandardButton
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      variant="ghost"
                      size="sm"
                      icon={showNewPassword ? EyeOff : Eye}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0"
                    />
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
                    <StandardButton
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      variant="ghost"
                      size="sm"
                      icon={showConfirmPassword ? EyeOff : Eye}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <StandardButton
                    variant="secondary"
                    onClick={() => setShowPasswordModal(false)}
                    fullWidth
                  >
                    Cancel
                  </StandardButton>
                  <StandardButton
                    type="submit"
                    variant="primary"
                    fullWidth
                  >
                    Update Password
                  </StandardButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Company Admin - All Authorize.Net Accounts Modal */}
        {showAllAccountsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => setShowAllAccountsModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">All Authorize.Net Connections</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Payment accounts across all locations</p>
                  </div>
                  <StandardButton
                    onClick={() => setShowAllAccountsModal(false)}
                    variant="ghost"
                    size="sm"
                    icon={X}
                    className="text-gray-400 hover:text-gray-600"
                  />
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
                            <StandardButton
                              onClick={() => handleLocationDisconnect(account.location_id, account.location.name)}
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              title="Disconnect this location"
                            >
                              Disconnect
                            </StandardButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <StandardButton
                    onClick={() => setShowAllAccountsModal(false)}
                    variant="secondary"
                    fullWidth
                  >
                    Close
                  </StandardButton>
                  <StandardButton
                    onClick={() => {
                      setShowAllAccountsModal(false);
                      setShowAuthorizeModal(true);
                    }}
                    variant="primary"
                    fullWidth
                  >
                    Connect New Location
                  </StandardButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Company Admin - All Google Calendar Connections Modal */}
        {showGcalAllModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => setShowGcalAllModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">All Google Calendar Connections</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Connections across all locations</p>
                  </div>
                  <StandardButton
                    onClick={() => setShowGcalAllModal(false)}
                    variant="ghost"
                    size="sm"
                    icon={X}
                    className="text-gray-400 hover:text-gray-600"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {loadingGcalAll ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                  </div>
                ) : allGcalConnections.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto text-gray-300 mb-3" size={36} />
                    <p className="text-sm font-medium text-gray-700">No connections yet</p>
                    <p className="text-xs text-gray-500 mt-1">No locations have connected Google Calendar.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {allGcalConnections.map((conn) => (
                      <div
                        key={conn.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin size={16} className={`text-${themeColor}-600`} />
                              <span className="font-semibold text-gray-900">
                                {conn.location.name}
                              </span>
                              <span className="text-sm text-gray-500">
                                {conn.location.city}{conn.location.state ? `, ${conn.location.state}` : ''}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                conn.is_connected
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {conn.is_connected ? 'Connected' : 'Disconnected'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                              {conn.google_account_email && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Google Account</p>
                                  <p className="text-sm text-gray-700">{conn.google_account_email}</p>
                                </div>
                              )}
                              {conn.calendar_id && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Calendar</p>
                                  <p className="text-sm text-gray-700 font-mono text-xs truncate">{conn.calendar_id === 'primary' ? 'Primary Calendar' : conn.calendar_id}</p>
                                </div>
                              )}
                              {conn.last_synced_at && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Last Synced</p>
                                  <p className="text-sm text-gray-700">
                                    {new Date(conn.last_synced_at).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4 flex flex-col items-end gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              conn.is_connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`}></div>
                            {conn.is_connected && (
                              <StandardButton
                                onClick={() => handleGcalLocationDisconnect(conn.location_id, conn.location.name)}
                                variant="danger"
                                size="sm"
                                icon={Trash2}
                                title="Disconnect this location"
                              >
                                Disconnect
                              </StandardButton>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 flex justify-end">
                <StandardButton
                  onClick={() => setShowGcalAllModal(false)}
                  variant="secondary"
                  size="sm"
                >
                  Close
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Authorize.Net Connection Modal */}
        {showAuthorizeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => { setShowAuthorizeModal(false); setAuthorizeApiLoginId(''); setAuthorizeTransactionKey(''); setAuthorizePublicClientKey(''); setSelectedLocationId(null); setShowTransactionKey(false); setShowPublicClientKey(false); }}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 relative animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <StandardButton
                onClick={() => {
                  setShowAuthorizeModal(false);
                  setAuthorizeApiLoginId('');
                  setAuthorizeTransactionKey('');
                  setAuthorizePublicClientKey('');
                  setSelectedLocationId(null);
                  setShowTransactionKey(false);
                  setShowPublicClientKey(false);
                }}
                variant="ghost"
                size="sm"
                icon={X}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              />
              
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
                    <StandardButton
                      type="button"
                      onClick={() => setShowTransactionKey(!showTransactionKey)}
                      variant="ghost"
                      size="sm"
                      icon={showTransactionKey ? EyeOff : Eye}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0"
                    />
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
                    <StandardButton
                      type="button"
                      onClick={() => setShowPublicClientKey(!showPublicClientKey)}
                      variant="ghost"
                      size="sm"
                      icon={showPublicClientKey ? EyeOff : Eye}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0"
                    />
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
                    <StandardButton
                      type="button"
                      onClick={() => setAuthorizeEnvironment('sandbox')}
                      variant="ghost"
                      className={`px-3 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                        authorizeEnvironment === 'sandbox'
                          ? `border-${themeColor}-600 bg-${themeColor}-50 text-${themeColor}-700`
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Sandbox
                    </StandardButton>
                    <StandardButton
                      type="button"
                      onClick={() => setAuthorizeEnvironment('production')}
                      variant="ghost"
                      className={`px-3 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                        authorizeEnvironment === 'production'
                          ? `border-${themeColor}-600 bg-${themeColor}-50 text-${themeColor}-700`
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Production
                    </StandardButton>
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
                  <StandardButton
                    variant="secondary"
                    onClick={() => {
                      setShowAuthorizeModal(false);
                      setAuthorizeApiLoginId('');
                      setAuthorizeTransactionKey('');
                      setAuthorizePublicClientKey('');
                      setSelectedLocationId(null);
                      setShowTransactionKey(false);
                      setShowPublicClientKey(false);
                    }}
                    fullWidth
                    disabled={loadingAuthorize}
                  >
                    Cancel
                  </StandardButton>
                  <StandardButton
                    type="submit"
                    variant="primary"
                    fullWidth
                    disabled={loadingAuthorize}
                    loading={loadingAuthorize}
                  >
                    Connect Account
                  </StandardButton>
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
