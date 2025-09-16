// MainLayout component that would use the Sidebar
import Sidebar from './../components/admin/AdminSidebar';
import { useState } from 'react';

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendee' | 'location_manager' | 'company_admin';
}

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Mock user data - in a real app this would come from authentication context
  const userData: UserData = {
    name: "John Doe",
    company: "Adventure Park",
    position: "Location Manager",
    role: "attendee"
  }; 

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={userData} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-tl-2xl shadow-xl">
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
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;