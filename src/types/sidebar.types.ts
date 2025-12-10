// Types for AdminSidebar component

export interface NavItem {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  items?: NavItem[];
  section?: string;
  description?: string;
  isGroupHeader?: boolean;
  isGrouped?: boolean;
}

export interface UserData {
  id?: number;
  name: string;
  company: string;
  location_name?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
  token?: string;
  profile_path?: string;
  location_id?: number;
}

export interface SidebarProps {
  user: UserData;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  handleSignOut: () => void;
  isMinimized?: boolean;
  setIsMinimized?: (isMinimized: boolean) => void;
}
