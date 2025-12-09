import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface PublicRouteProps {
  children: ReactNode;
  restricted?: boolean; // If true, authenticated users will be redirected
}

const PublicRoute: React.FC<PublicRouteProps> = ({ 
  children, 
  restricted = false 
}) => {
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

  // If this is a restricted public route (like login/register) and user is authenticated
  if (restricted && isAuthenticated) {
    // Redirect to appropriate dashboard based on role
    const redirectPaths: Record<string, string> = {
      'company_admin': '/company/dashboard',
      'location_manager': '/manager/dashboard',
      'attendant': '/attendant/dashboard',
    };
    
    const redirectPath = user.role ? redirectPaths[user.role] : '/attendant/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
