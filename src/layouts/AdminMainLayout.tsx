import Sidebar from './../components/admin/AdminSidebar';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { API_BASE_URL } from '../utils/storage';
import { bookingCacheService } from '../services/BookingCacheService';
import { roomCacheService } from '../services/RoomCacheService';
import { packageCacheService } from '../services/PackageCacheService';
import { addOnCacheService } from '../services/AddOnCacheService';
import { attractionCacheService } from '../services/AttractionCacheService';
import { eventCacheService } from '../services/EventCacheService';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface UserData {
  name: string;
  company: string;
  location_name?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
  token?: string;
  profile_path?: string;
}

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(false);
  const [showLoader, setShowLoader] = useState<boolean>(false);

  const [userData, setUserData] = useState<UserData | null>(null);

  const loadUserData = useCallback(() => {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      const user = JSON.parse(stored);
      const companyName = typeof user.company === 'object' && user.company !== null
        ? user.company.company_name || user.company.name || 'Unknown Company'
        : (user.company || 'Zap Zone');
      
      setUserData({
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || 'User',
        company: companyName,
        location_name: user.location_name || '',
        position: user.position || 'Staff',
        role: user.role || 'attendant',
        token: user.token,
        profile_path: user.profile_path || ''
      });
    } else {
      setUserData({
        name: "John Doe",
        company: "Zap Zone",
        position: "Staff",
        role: "attendant"
      });
    }
  }, []);

  useEffect(() => {
    loadUserData();
    
    const warmupCaches = async () => {
      console.log('[AdminMainLayout] Warming up caches...');
      await Promise.all([
        bookingCacheService.warmupCache(),
        roomCacheService.warmupCache(),
        packageCacheService.warmupCache(),
        addOnCacheService.warmupCache(),
        attractionCacheService.warmupCache(),
        eventCacheService.warmupCache()
      ]);
      console.log('[AdminMainLayout] Caches warmed up');
    };
    warmupCaches();
    
    const handleProfileUpdate = () => {
      loadUserData();
    };
    
    window.addEventListener('zapzone_profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('zapzone_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [loadUserData]);

  const navigate = useNavigate();
  const handleSignOut = useCallback(async () => {
    setShowLoader(true);
    try {
      const stored = localStorage.getItem('zapzone_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.token) {
          await fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`,
            },
          });
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await bookingCacheService.clearCache();
      await roomCacheService.clearCache();
      await packageCacheService.clearCache();
      await addOnCacheService.clearCache();
      await attractionCacheService.clearCache();
      await eventCacheService.clearCache();
      
      localStorage.removeItem('zapzone_user');
      setUserData(null);
      
      setTimeout(() => {
        setShowLoader(false);
        navigate('/admin');
      }, 500);
    }
  }, [navigate]);

  return (
    <>
      {showLoader && <LoadingSpinner fullScreen message="Signing out..." />}

      <div className="flex h-screen bg-gray-50">
  <Sidebar 
    user={userData!} 
    isOpen={isSidebarOpen} 
    setIsOpen={setIsSidebarOpen} 
    handleSignOut={handleSignOut}
    isMinimized={isSidebarMinimized}
    setIsMinimized={setIsSidebarMinimized}
  />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-white shadow-xl">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur px-8 flex items-center gap-4 ">
         
        </header>
        <main className="bg-gray-50 flex-1 overflow-y-auto sm:p-6 p-2">
          <div className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </>
  );
};

export default MainLayout;
