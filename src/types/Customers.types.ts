// Types for: src/pages/admin/customer/Customers.tsx

export interface CustomersCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  lastActivity: string;
  totalSpent: number;
  bookings: number;
  ticketsPurchased: number;
  status: 'active' | 'inactive' | 'new';
  satisfaction: number;
  tags: string[];
}
