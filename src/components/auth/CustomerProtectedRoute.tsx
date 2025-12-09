import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface CustomerProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

const CustomerProtectedRoute: React.FC<CustomerProtectedRouteProps> = ({ 
  children, 
  requireAuth = true 
}) => {
  const location = useLocation();
  
  // Get customer data from localStorage
  const getCustomerData = () => {
    try {
      const stored = localStorage.getItem('zapzone_customer');
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Error parsing customer data:', error);
      return null;
    }
  };

  const customer = getCustomerData();
  const isAuthenticated = customer && customer.token;

  // If authentication is required and customer is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/customer/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default CustomerProtectedRoute;
