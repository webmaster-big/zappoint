import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('company_admin' | 'location_manager' | 'attendant')[];
  requireAuth?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles, 
  requireAuth = true 
}) => {
  const location = useLocation();
  
  // Get user data from localStorage
  const getUserData = () => {
    try {
      const stored = localStorage.getItem('zapzone_user');
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  };

  const user = getUserData();
  const isAuthenticated = user && user.token;

  // If authentication is required and user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  // If specific roles are required, check if user has the right role
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !allowedRoles.includes(user.role)) {
      // Redirect to appropriate dashboard based on user's role
      const redirectPaths: Record<string, string> = {
        'company_admin': '/company/dashboard',
        'location_manager': '/manager/dashboard',
        'attendant': '/attendant/dashboard',
      };
      
      const redirectPath = user?.role ? redirectPaths[user.role] : '/admin';
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
