// MainLayout component that would use the Sidebar
import Sidebar from './../components/admin/AdminSidebar';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendee' | 'location_manager' | 'company_admin';
}

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Load user data from localStorage if available
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      setUserData(JSON.parse(stored));
    } else {
      // Default mock data if not logged in
      setUserData({
        name: "John Doe",
        company: "Zap Zone",
        position: "Staff",
        role: "attendee"
      });
    }
  }, []);

  const navigate = useNavigate();
  // Handler for sign out: erase user from localStorage
  const handleSignOut = useCallback(() => {
    localStorage.removeItem('zapzone_user');
    setUserData(null);
    navigate('/');
  }, [navigate]);

  return (
    <div className="flex h-screen bg-gray-50">
  <Sidebar user={userData!} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} handleSignOut={handleSignOut} />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-white shadow-xl">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur px-8 flex items-center gap-4 ">
          {/* <button
            className="lg:hidden p-2 rounded-lg border border-gray-200 bg-white shadow hover:bg-gray-100 transition"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button> */}
         
        </header>
        <main className="bg-gray-50 flex-1 overflow-y-auto sm:p-6 p-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;