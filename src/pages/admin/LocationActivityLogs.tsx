import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCcw,
  Download,
  ShoppingCart,
  Eye,
  Edit,
  LogIn,
  LogOut,
  Clock,
  Users,
  Zap,
  Trash2,
  Plus,
  MapPin,
  User,
  Settings,
  X,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import StandardButton from '../../components/ui/StandardButton';
import type { 
  LocationActivityLogsActivityLog, 
  LocationActivityLogsFilterOptions, 
  LocationActivityLogsLocationData 
} from '../../types/LocationActivityLogs.types';
import { useThemeColor } from '../../hooks/useThemeColor';
import CounterAnimation from '../../components/ui/CounterAnimation';
import { API_BASE_URL } from '../../utils/storage';
import { locationService } from '../../services';
import type { Location } from '../../services/LocationService';
import { getAuthToken } from '../../services';

const LocationActivityLogs = () => {
  const { themeColor, fullColor } = useThemeColor();
  
  const [filteredLogs, setFilteredLogs] = useState<LocationActivityLogsActivityLog[]>([]);
  const [allLogs, setAllLogs] = useState<LocationActivityLogsActivityLog[]>([]); // For client-side pagination
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState<LocationActivityLogsFilterOptions>({
    action: 'all',
    resourceType: 'all',
    user: 'all',
    userType: 'all',
    dateRange: 'all',
    search: ''
  });
  const [exportSelectedLocations, setExportSelectedLocations] = useState<string[]>([]);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [exportSelectedUsers, setExportSelectedUsers] = useState<string[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState<LocationActivityLogsFilterOptions>({
    action: 'all',
    resourceType: 'all',
    user: 'all',
    userType: 'all',
    dateRange: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [locations, setLocations] = useState<LocationActivityLogsLocationData[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [totalPages, setTotalPages] = useState(0);

  // Action icons and colors
  const actionIcons = {
    created: Plus,
    updated: Edit,
    deleted: Trash2,
    viewed: Eye,
    checked_in: LogIn,
    checked_out: LogOut,
    purchased: ShoppingCart,
    logged_in: LogIn,
    logged_out: LogOut,
    managed: Settings,
    reported: FileText,
    approved: CheckCircle,
    rejected: XCircle
  };

  const getSeverityColors = (severity: string) => {
    const colors: Record<string, string> = {
      info: `bg-${themeColor}-100 text-${fullColor}`,
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };
    return colors[severity] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  const getResourceTypeColors = (resourceType: string) => {
    const colors: Record<string, string> = {
      package: 'bg-purple-100 text-purple-800',
      customer: `bg-${themeColor}-100 text-${fullColor}`,
      purchase: 'bg-green-100 text-green-800',
      attraction: 'bg-orange-100 text-orange-800',
      booking: 'bg-indigo-100 text-indigo-800',
      attendant: 'bg-pink-100 text-pink-800',
      manager: 'bg-red-100 text-red-800',
      inventory: `bg-${themeColor}-100 text-${fullColor}`,
      settings: 'bg-gray-100 text-gray-800'
    };
    return colors[resourceType] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  const getUserTypeColors = (userType: string) => {
    const colors: Record<string, string> = {
      company_admin: 'bg-purple-100 text-purple-800',
      location_manager: 'bg-blue-100 text-blue-800',
      attendant: `bg-${themeColor}-100 text-${fullColor}`,
      system: 'bg-gray-100 text-gray-800'
    };
    return colors[userType] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  // Format detailed activity description with metadata based on action type
  const formatActivityDescription = (log: LocationActivityLogsActivityLog) => {
    const metadata = log.metadata || {} as Record<string, unknown>;
    const metadataDetails: string[] = [];
    let description = '';

    // Helper to safely get nested properties
    const getMetaValue = (key: string): unknown => (metadata as Record<string, unknown>)[key];

    // Format based on specific action types from the API
    switch (log.action) {
      // Booking actions
      case 'Booking Created': {
        const refNum = getMetaValue('reference_number') as string;
        const customerName = getMetaValue('customer_name') as string;
        const bookingDetails = getMetaValue('booking_details') as { booking_date?: string; booking_time?: string; participants?: number; duration?: number } | undefined;
        const pkg = getMetaValue('package') as { name?: string } | undefined;
        const room = getMetaValue('room') as { name?: string } | undefined;
        const financial = getMetaValue('financial') as { total_amount?: number; amount_paid?: number } | undefined;
        
        description = `Booking ${refNum || ''} created for ${customerName || 'customer'}`;
        if (pkg?.name) metadataDetails.push(`Package: ${pkg.name}`);
        if (room?.name) metadataDetails.push(`Room: ${room.name}`);
        if (bookingDetails?.booking_date) metadataDetails.push(`Date: ${bookingDetails.booking_date}`);
        if (bookingDetails?.booking_time) metadataDetails.push(`Time: ${bookingDetails.booking_time}`);
        if (bookingDetails?.participants) metadataDetails.push(`${bookingDetails.participants} participants`);
        if (financial?.total_amount) metadataDetails.push(`Total: $${financial.total_amount.toFixed(2)}`);
        break;
      }
      
      case 'Booking Edited': {
        const refNum = getMetaValue('reference_number') as string;
        const customerName = getMetaValue('customer_name') as string;
        const updatedFields = getMetaValue('updated_fields') as string[] | undefined;
        const changes = getMetaValue('changes') as Record<string, { from: unknown; to: unknown }> | undefined;
        
        description = `Booking ${refNum || ''} edited for ${customerName || 'customer'}`;
        if (updatedFields?.length) metadataDetails.push(`Changed: ${updatedFields.join(', ')}`);
        if (changes) {
          const changeList = Object.entries(changes).slice(0, 3).map(([key, val]) => 
            `${key.replace(/_/g, ' ')}: "${val.from}" → "${val.to}"`
          );
          if (changeList.length > 0) metadataDetails.push(changeList.join(', '));
        }
        break;
      }
      
      case 'Booking Status Changed': {
        const refNum = getMetaValue('reference_number') as string;
        const statusChange = getMetaValue('status_change') as { from?: string; to?: string } | undefined;
        
        description = `Booking ${refNum || ''} status changed`;
        if (statusChange) metadataDetails.push(`${statusChange.from} → ${statusChange.to}`);
        break;
      }
      
      case 'Payment Status Changed': {
        const refNum = getMetaValue('reference_number') as string;
        const paymentStatusChange = getMetaValue('payment_status_change') as { from?: string; to?: string } | undefined;
        
        description = `Booking ${refNum || ''} payment status changed`;
        if (paymentStatusChange) metadataDetails.push(`${paymentStatusChange.from} → ${paymentStatusChange.to}`);
        break;
      }
      
      case 'Booking Internal Notes Updated': {
        const refNum = getMetaValue('reference_number') as string;
        description = `Internal notes updated for booking ${refNum || ''}`;
        break;
      }
      
      case 'Booking Deleted': {
        const refNum = getMetaValue('reference_number') as string;
        description = `Booking ${refNum || ''} deleted`;
        break;
      }
      
      case 'Bulk Bookings Deleted': {
        const count = getMetaValue('deleted_count') as number;
        description = `${count || 0} bookings deleted in bulk operation`;
        break;
      }
      
      // Payment actions
      case 'Payment Recorded': {
        const txnId = getMetaValue('transaction_id') as string;
        const paymentDetails = getMetaValue('payment_details') as { amount?: number; method?: string } | undefined;
        const customer = getMetaValue('customer') as { name?: string } | undefined;
        
        description = `Payment recorded`;
        if (paymentDetails?.amount) metadataDetails.push(`Amount: $${paymentDetails.amount.toFixed(2)}`);
        if (paymentDetails?.method) metadataDetails.push(`Method: ${paymentDetails.method}`);
        if (customer?.name) metadataDetails.push(`Customer: ${customer.name}`);
        if (txnId) metadataDetails.push(`Transaction: ${txnId}`);
        break;
      }
      
      case 'Payment Refunded': {
        const paymentDetails = getMetaValue('payment_details') as { amount?: number } | undefined;
        const customer = getMetaValue('customer') as { name?: string } | undefined;
        
        description = `Payment refunded`;
        if (paymentDetails?.amount) metadataDetails.push(`Amount: $${paymentDetails.amount.toFixed(2)}`);
        if (customer?.name) metadataDetails.push(`Customer: ${customer.name}`);
        break;
      }
      
      // User actions
      case 'User Login': {
        const userDetails = getMetaValue('user_details') as { name?: string; role?: string } | undefined;
        const loginInfo = getMetaValue('login_info') as { ip_address?: string } | undefined;
        
        description = `User ${userDetails?.name || ''} logged in`;
        if (userDetails?.role) metadataDetails.push(`Role: ${userDetails.role}`);
        if (loginInfo?.ip_address) metadataDetails.push(`IP: ${loginInfo.ip_address}`);
        break;
      }
      
      case 'User Logout': {
        const userDetails = getMetaValue('user_details') as { name?: string } | undefined;
        description = `User ${userDetails?.name || ''} logged out`;
        break;
      }
      
      case 'User Created': {
        const userDetails = getMetaValue('user_details') as { name?: string; role?: string; email?: string } | undefined;
        description = `New user ${userDetails?.name || ''} created`;
        if (userDetails?.role) metadataDetails.push(`Role: ${userDetails.role}`);
        if (userDetails?.email) metadataDetails.push(`Email: ${userDetails.email}`);
        break;
      }
      
      case 'User Updated': {
        const userDetails = getMetaValue('user_details') as { name?: string } | undefined;
        const updatedFields = getMetaValue('updated_fields') as string[] | undefined;
        
        description = `User ${userDetails?.name || ''} information updated`;
        if (updatedFields?.length) metadataDetails.push(`Changed: ${updatedFields.join(', ')}`);
        break;
      }
      
      case 'User Deleted': {
        const userDetails = getMetaValue('user_details') as { name?: string } | undefined;
        description = `User ${userDetails?.name || ''} deleted`;
        break;
      }
      
      case 'Bulk Users Deleted': {
        const count = getMetaValue('deleted_count') as number;
        description = `${count || 0} users deleted in bulk operation`;
        break;
      }
      
      case 'Customer Logout': {
        const customerDetails = getMetaValue('customer_details') as { name?: string } | undefined;
        description = `Customer ${customerDetails?.name || ''} logged out`;
        break;
      }
      
      // Attraction purchase actions
      case 'Attraction Purchase Created': {
        const purchaseDetails = getMetaValue('purchase_details') as { attraction_name?: string; quantity?: number; total_amount?: number } | undefined;
        const customerDetails = getMetaValue('customer_details') as { name?: string } | undefined;
        
        description = `Attraction purchase created`;
        if (purchaseDetails?.attraction_name) metadataDetails.push(`Attraction: ${purchaseDetails.attraction_name}`);
        if (purchaseDetails?.quantity) metadataDetails.push(`Qty: ${purchaseDetails.quantity}`);
        if (purchaseDetails?.total_amount) metadataDetails.push(`Total: $${purchaseDetails.total_amount.toFixed(2)}`);
        if (customerDetails?.name) metadataDetails.push(`Customer: ${customerDetails.name}`);
        break;
      }
      
      case 'Attraction Purchase Updated': {
        const purchaseDetails = getMetaValue('purchase_details') as { attraction_name?: string } | undefined;
        const updatedFields = getMetaValue('updated_fields') as string[] | undefined;
        
        description = `Attraction purchase updated`;
        if (purchaseDetails?.attraction_name) metadataDetails.push(`Attraction: ${purchaseDetails.attraction_name}`);
        if (updatedFields?.length) metadataDetails.push(`Changed: ${updatedFields.join(', ')}`);
        break;
      }
      
      case 'Attraction Purchase Deleted':
      case 'Bulk Attraction Purchases Deleted': {
        const count = getMetaValue('deleted_count') as number;
        if (count) {
          description = `${count} attraction purchases deleted`;
        } else {
          const purchaseDetails = getMetaValue('purchase_details') as { attraction_name?: string } | undefined;
          description = `Attraction purchase deleted`;
          if (purchaseDetails?.attraction_name) metadataDetails.push(`Attraction: ${purchaseDetails.attraction_name}`);
        }
        break;
      }
      
      // Add-on actions
      case 'Add-On Updated': {
        const addonDetails = getMetaValue('addon_details') as { name?: string; price?: number } | undefined;
        const changes = getMetaValue('changes') as { original_name?: string; new_name?: string } | undefined;
        
        description = `Add-on "${addonDetails?.name || ''}" updated`;
        if (changes?.original_name && changes?.new_name) {
          metadataDetails.push(`Name: "${changes.original_name}" → "${changes.new_name}"`);
        }
        if (addonDetails?.price) metadataDetails.push(`Price: $${addonDetails.price.toFixed(2)}`);
        break;
      }
      
      case 'Add-On Deleted':
      case 'Bulk Add-Ons Deleted': {
        const count = getMetaValue('deleted_count') as number;
        if (count) {
          description = `${count} add-ons deleted in bulk operation`;
        } else {
          const addonDetails = getMetaValue('addon_details') as { name?: string } | undefined;
          description = `Add-on "${addonDetails?.name || ''}" deleted`;
        }
        break;
      }
      
      case 'Bulk Add-Ons Imported': {
        const importDetails = getMetaValue('import_details') as { imported_count?: number; failed_count?: number } | undefined;
        description = `${importDetails?.imported_count || 0} add-ons imported`;
        if (importDetails?.failed_count) metadataDetails.push(`Failed: ${importDetails.failed_count}`);
        break;
      }
      
      // Gift card actions
      case 'Gift Card Updated': {
        const gcDetails = getMetaValue('gift_card_details') as { code?: string; balance?: number } | undefined;
        description = `Gift card ${gcDetails?.code || ''} updated`;
        if (gcDetails?.balance) metadataDetails.push(`Balance: $${gcDetails.balance.toFixed(2)}`);
        break;
      }
      
      case 'Gift Card Deleted': {
        const gcDetails = getMetaValue('gift_card_details') as { code?: string } | undefined;
        description = `Gift card ${gcDetails?.code || ''} deleted`;
        break;
      }
      
      case 'Gift Card Redeemed': {
        const gcDetails = getMetaValue('gift_card_details') as { code?: string } | undefined;
        const redemptionDetails = getMetaValue('redemption_details') as { amount_redeemed?: number; remaining_balance?: number } | undefined;
        
        description = `Gift card ${gcDetails?.code || ''} redeemed`;
        if (redemptionDetails?.amount_redeemed) metadataDetails.push(`Amount: $${redemptionDetails.amount_redeemed.toFixed(2)}`);
        if (redemptionDetails?.remaining_balance !== undefined) metadataDetails.push(`Remaining: $${redemptionDetails.remaining_balance.toFixed(2)}`);
        break;
      }
      
      // Day off actions
      case 'Day Off Created': {
        const dayOffDetails = getMetaValue('day_off_details') as { date?: string; reason?: string; scope?: string } | undefined;
        description = `Day off created for ${dayOffDetails?.date || ''}`;
        if (dayOffDetails?.reason) metadataDetails.push(`Reason: ${dayOffDetails.reason}`);
        if (dayOffDetails?.scope) metadataDetails.push(`Scope: ${dayOffDetails.scope}`);
        break;
      }
      
      case 'Day Off Updated': {
        const dayOffDetails = getMetaValue('day_off_details') as { date?: string } | undefined;
        const updatedFields = getMetaValue('updated_fields') as string[] | undefined;
        
        description = `Day off updated for ${dayOffDetails?.date || ''}`;
        if (updatedFields?.length) metadataDetails.push(`Changed: ${updatedFields.join(', ')}`);
        break;
      }
      
      case 'Day Off Deleted':
      case 'Day Off Bulk Deleted':
      case 'Day Offs Bulk Delete': {
        const count = getMetaValue('deleted_count') as number;
        if (count) {
          description = `${count} day offs deleted in bulk operation`;
        } else {
          const dayOffDetails = getMetaValue('day_off_details') as { date?: string } | undefined;
          description = `Day off for ${dayOffDetails?.date || ''} deleted`;
        }
        break;
      }
      
      // Package actions
      case 'Package Deleted': {
        const pkgDetails = getMetaValue('package_details') as { name?: string } | undefined;
        const softDelete = getMetaValue('soft_delete') as boolean | undefined;
        description = `Package "${pkgDetails?.name || ''}" ${softDelete ? 'soft ' : ''}deleted`;
        break;
      }
      
      case 'Package Restored': {
        const pkgDetails = getMetaValue('package_details') as { name?: string } | undefined;
        description = `Package "${pkgDetails?.name || ''}" restored`;
        break;
      }
      
      case 'Package Permanently Deleted': {
        const pkgDetails = getMetaValue('package_details') as { name?: string } | undefined;
        description = `Package "${pkgDetails?.name || ''}" permanently deleted`;
        break;
      }
      
      case 'Availability Schedules Updated': {
        const pkgDetails = getMetaValue('package_details') as { name?: string } | undefined;
        const schedulesCreated = getMetaValue('schedules_created') as number | undefined;
        const schedulesDeleted = getMetaValue('schedules_deleted') as number | undefined;
        
        description = `Availability schedules updated for package "${pkgDetails?.name || ''}"`;
        if (schedulesCreated) metadataDetails.push(`Created: ${schedulesCreated}`);
        if (schedulesDeleted) metadataDetails.push(`Deleted: ${schedulesDeleted}`);
        break;
      }
      
      case 'Availability Schedule Deleted': {
        const pkgDetails = getMetaValue('package_details') as { name?: string } | undefined;
        const scheduleDetails = getMetaValue('schedule_details') as { availability_type?: string } | undefined;
        
        description = `${scheduleDetails?.availability_type || ''} schedule deleted for package "${pkgDetails?.name || ''}"`;
        break;
      }
      
      case 'Bulk Package Min Booking Notice Updated': {
        const updateDetails = getMetaValue('update_details') as { min_booking_notice_hours?: number; updated_count?: number } | undefined;
        description = `Min booking notice updated to ${updateDetails?.min_booking_notice_hours || 0} hours for ${updateDetails?.updated_count || 0} packages`;
        break;
      }
      
      // Contact actions
      case 'Contact Created': {
        const contactDetails = getMetaValue('contact_details') as { email?: string; name?: string } | undefined;
        description = `Contact "${contactDetails?.email || contactDetails?.name || ''}" created`;
        break;
      }
      
      case 'Contact Updated': {
        const contactDetails = getMetaValue('contact_details') as { email?: string } | undefined;
        const updatedFields = getMetaValue('updated_fields') as string[] | undefined;
        
        description = `Contact "${contactDetails?.email || ''}" updated`;
        if (updatedFields?.length) metadataDetails.push(`Changed: ${updatedFields.join(', ')}`);
        break;
      }
      
      case 'Contact Deleted': {
        const contactDetails = getMetaValue('contact_details') as { email?: string } | undefined;
        description = `Contact "${contactDetails?.email || ''}" deleted`;
        break;
      }
      
      case 'Contacts Bulk Import': {
        const importDetails = getMetaValue('import_details') as { imported_count?: number; skipped_count?: number } | undefined;
        description = `Imported ${importDetails?.imported_count || 0} contacts`;
        if (importDetails?.skipped_count) metadataDetails.push(`Skipped: ${importDetails.skipped_count}`);
        break;
      }
      
      case 'Contacts Bulk Delete': {
        const count = getMetaValue('deleted_count') as number;
        description = `Bulk deleted ${count || 0} contacts`;
        break;
      }
      
      case 'Contacts Bulk Update': {
        const updateDetails = getMetaValue('update_details') as { action?: string; updated_count?: number } | undefined;
        description = `Bulk updated ${updateDetails?.updated_count || 0} contacts`;
        if (updateDetails?.action) metadataDetails.push(`Action: ${updateDetails.action}`);
        break;
      }
      
      // Customer actions
      case 'Customer Updated': {
        const customerDetails = getMetaValue('customer_details') as { name?: string } | undefined;
        const updatedFields = getMetaValue('updated_fields') as string[] | undefined;
        
        description = `Customer ${customerDetails?.name || ''} updated`;
        if (updatedFields?.length) metadataDetails.push(`Changed: ${updatedFields.join(', ')}`);
        break;
      }
      
      case 'Customer Deleted': {
        const customerDetails = getMetaValue('customer_details') as { name?: string } | undefined;
        description = `Customer ${customerDetails?.name || ''} deleted`;
        break;
      }
      
      // Room actions
      case 'Room Deleted':
      case 'Room Bulk Deleted':
      case 'Rooms Bulk Delete': {
        const count = getMetaValue('deleted_count') as number;
        if (count) {
          description = `${count} rooms deleted in bulk operation`;
        } else {
          const roomDetails = getMetaValue('room_details') as { name?: string } | undefined;
          description = `Room "${roomDetails?.name || ''}" deleted`;
        }
        break;
      }
      
      // Promo actions
      case 'Promo Deleted': {
        const promoDetails = getMetaValue('promo_details') as { code?: string } | undefined;
        description = `Promo code "${promoDetails?.code || ''}" deleted`;
        break;
      }
      
      // Location/Company actions
      case 'Location Deleted': {
        const locationDetails = getMetaValue('location_details') as { name?: string } | undefined;
        description = `Location "${locationDetails?.name || ''}" deleted`;
        break;
      }
      
      case 'Company Deleted': {
        const companyDetails = getMetaValue('company_details') as { name?: string } | undefined;
        description = `Company "${companyDetails?.name || ''}" deleted`;
        break;
      }
      
      // Notification actions
      case 'Notification Deleted': {
        const notificationDetails = getMetaValue('notification_details') as { title?: string } | undefined;
        description = `Notification "${notificationDetails?.title || ''}" deleted`;
        break;
      }
      
      case 'Customer Notification Deleted': {
        const notificationDetails = getMetaValue('notification_details') as { title?: string } | undefined;
        description = `Customer notification "${notificationDetails?.title || ''}" deleted`;
        break;
      }
      
      // Attraction actions
      case 'Attraction Deleted':
      case 'Bulk Attractions Deleted': {
        const count = getMetaValue('deleted_count') as number;
        if (count) {
          description = `${count} attractions deleted in bulk operation`;
        } else {
          const attractionDetails = getMetaValue('attraction_details') as { name?: string } | undefined;
          description = `Attraction "${attractionDetails?.name || ''}" deleted`;
        }
        break;
      }
      
      // Package time slot actions
      case 'Package Time Slot Deleted': {
        const timeSlotDetails = getMetaValue('time_slot_details') as { start_time?: string; end_time?: string } | undefined;
        description = `Package time slot deleted`;
        if (timeSlotDetails?.start_time && timeSlotDetails?.end_time) {
          metadataDetails.push(`Time: ${timeSlotDetails.start_time} - ${timeSlotDetails.end_time}`);
        }
        break;
      }
      
      // Authorize.Net actions
      case 'Authorize.Net Account Deleted': {
        description = `Authorize.Net account disconnected`;
        break;
      }
      
      // Legacy/fallback action handling
      default: {
        // Handle legacy simple actions
        const action = log.action.replace(/_/g, ' ');
        const resourceType = log.resourceType;
        const resourceName = log.resourceName || '';
        const resourceId = log.resourceId ? `#${log.resourceId}` : '';
        
        // Build description for legacy format
        switch (log.action) {
          case 'created':
            description = `Created ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'updated':
            description = `Updated ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'deleted':
            description = `Deleted ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'viewed':
            description = `Viewed ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'checked_in':
            description = `Checked in customer for ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'checked_out':
            description = `Checked out customer from ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'purchased':
            description = `Processed purchase of ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'logged_in':
            description = `Logged into the system`;
            if (getMetaValue('ip_address')) metadataDetails.push(`IP: ${getMetaValue('ip_address')}`);
            break;
          case 'logged_out':
            description = `Logged out of the system`;
            break;
          case 'approved':
            description = `Approved ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'rejected':
            description = `Rejected ${resourceType} "${resourceName}" ${resourceId}`;
            if (getMetaValue('reason')) metadataDetails.push(`Reason: ${getMetaValue('reason')}`);
            break;
          case 'managed':
            description = `Managed ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          case 'reported':
            description = `Generated report for ${resourceType} "${resourceName}" ${resourceId}`;
            break;
          default:
            description = `${action.charAt(0).toUpperCase() + action.slice(1)} ${resourceType} "${resourceName}" ${resourceId}`.trim();
        }
        
        // Parse legacy metadata fields
        if (getMetaValue('reference_number')) metadataDetails.push(`Ref: ${getMetaValue('reference_number')}`);
        if (getMetaValue('customer_name')) metadataDetails.push(`Customer: ${getMetaValue('customer_name')}`);
        if (getMetaValue('amount')) metadataDetails.push(`Amount: $${parseFloat(String(getMetaValue('amount'))).toFixed(2)}`);
        if (getMetaValue('quantity')) metadataDetails.push(`Qty: ${getMetaValue('quantity')}`);
        if (getMetaValue('status')) metadataDetails.push(`Status: ${getMetaValue('status')}`);
      }
    }
    
    // Append metadata details
    if (metadataDetails.length > 0) {
      description += ` • ${metadataDetails.join(' • ')}`;
    }
    
    // Add original details if not redundant
    if (log.details && log.details.length > 0 && !description.includes(log.details)) {
      description += ` • ${log.details}`;
    }
    
    return description.trim();
  };

  // Toggle expanded state for a log
  const toggleLogExpanded = (logId: string) => {
    setExpandedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Format metadata for display in expanded view
  const formatMetadataForDisplay = (metadata: Record<string, unknown> | undefined): { key: string; value: string; category: string }[] => {
    if (!metadata || Object.keys(metadata).length === 0) return [];
    
    const result: { key: string; value: string; category: string }[] = [];
    
    const formatValue = (val: unknown): string => {
      if (val === null || val === undefined) return '-';
      if (typeof val === 'object') {
        if (Array.isArray(val)) {
          return val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
        }
        return JSON.stringify(val, null, 2);
      }
      return String(val);
    };

    const formatKey = (key: string): string => {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const categorizeKey = (key: string): string => {
      const categories: Record<string, string[]> = {
        'Customer Info': ['customer_name', 'guest_name', 'customer_id', 'customer_email', 'email', 'phone', 'customer_details'],
        'Booking Details': ['reference_number', 'booking_reference', 'booking_date', 'booking_time', 'participants', 'duration', 'duration_unit', 'booking_details', 'status', 'booking_status', 'payment_status'],
        'Financial': ['total_amount', 'amount_paid', 'amount', 'price', 'discount_amount', 'financial', 'payment_details', 'refund_amount'],
        'Package/Room': ['package', 'package_name', 'room', 'room_name', 'room_details', 'package_details'],
        'Location': ['location', 'location_id', 'location_name', 'location_details'],
        'User Info': ['user_id', 'user_details', 'created_by', 'updated_by', 'deleted_by', 'recorded_by', 'changed_by', 'refunded_by'],
        'Changes': ['changes', 'updated_fields', 'status_change', 'payment_status_change'],
        'Timestamps': ['created_at', 'updated_at', 'deleted_at', 'login_at', 'logout_at', 'recorded_at', 'changed_at'],
        'System': ['ip_address', 'user_agent', 'login_info', 'logout_info']
      };
      
      for (const [category, keys] of Object.entries(categories)) {
        if (keys.includes(key)) return category;
      }
      return 'Other';
    };

    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        result.push({
          key: formatKey(key),
          value: formatValue(value),
          category: categorizeKey(key)
        });
      }
    });

    // Sort by category
    const categoryOrder = ['Customer Info', 'Booking Details', 'Financial', 'Package/Room', 'Location', 'User Info', 'Changes', 'Timestamps', 'System', 'Other'];
    result.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));

    return result;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Calculate metrics for selected location
  const getLocationMetrics = () => {
    // Use filteredLogs which contains the current page's data
    const locationLogs = filteredLogs;

    const todayLogs = locationLogs.filter(log => isToday(new Date(log.timestamp)));
    const managerLogs = locationLogs.filter(log => log.userType === 'location_manager');
    const attendantLogs = locationLogs.filter(log => log.userType === 'attendant');

    return [
      {
        title: 'Total Activities',
        value: totalLogs.toString(),
        change: selectedLocation === 'all' ? 'All locations' : `${selectedLocation} only`,
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: Clock,
      },
      {
        title: "Today's Activities",
        value: todayLogs.length.toString(),
        change: 'Last 24 hours',
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: Zap,
      },
      {
        title: 'Manager Actions',
        value: managerLogs.length.toString(),
        change: `${selectedLocation === 'all' ? 'All locations' : selectedLocation}`,
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: User,
      },
      {
        title: 'Attendant Actions',
        value: attendantLogs.length.toString(),
        change: `${selectedLocation === 'all' ? 'All locations' : selectedLocation}`,
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: Users,
      }
    ];
  };

  const metrics = getLocationMetrics();

  const loadLocations = async () => {
    try {
      const response = await locationService.getLocations();
      const locationsData = Array.isArray(response.data) ? response.data : [];
      
      // Transform locations data
      const transformedLocations = locationsData.map((loc: Location) => ({
        name: loc.name,
        id: loc.id,
        managers: [], // Will be populated from users if needed
        attendants: [], // Will be populated from users if needed
        recentActivity: 0 // Will be calculated from activity logs
      }));
      
      setLocations(transformedLocations);
    } catch (error) {
      console.error('Error loading locations:', error);
      setLocations([]);
    }
  };

  const loadLogs = useCallback(async () => {
    // Only show full loading spinner on initial load
    const hasLogs = filteredLogs.length > 0;
    if (!hasLogs) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const token = getAuthToken();
      const params = new URLSearchParams();
      
      // Check if we need client-side filtering (userType filter requires it)
      const needsClientSideFiltering = filters.userType !== 'all';
      
      // Pagination - if client-side filtering, get all data; otherwise paginate on backend
      if (needsClientSideFiltering) {
        params.append('per_page', '1000'); // Get all records for client-side filtering
        params.append('page', '1');
      } else {
        params.append('per_page', itemsPerPage.toString());
        params.append('page', currentPage.toString());
      }
      
      // Location filter
      if (selectedLocation !== 'all') {
        const location = locations.find(l => l.name === selectedLocation);
        if (location?.id) {
          params.append('location_id', location.id.toString());
        }
      }
      
      // Search filter
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      // Action filter
      if (filters.action !== 'all') {
        params.append('action', filters.action);
      }
      
      // Category filter (mapped from resourceType)
      if (filters.resourceType !== 'all') {
        params.append('category', filters.resourceType);
      }
      
      // User filter
      if (filters.user !== 'all') {
        params.append('user_id', filters.user);
      }
      
      // User type filter - handled by filtering on frontend after load
      // Backend doesn't have a direct user_type filter, so we'll filter after fetching
      
      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (filters.dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            params.append('start_date', startDate.toISOString().split('T')[0]);
            break;
          case 'yesterday': {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            params.append('start_date', startDate.toISOString().split('T')[0]);
            params.append('end_date', endDate.toISOString().split('T')[0]);
            break;
          }
          case 'week':
            params.append('recent_days', '7');
            break;
          case 'month':
            params.append('recent_days', '30');
            break;
        }
      }
      
      // Sort
      params.append('sort_by', 'created_at');
      params.append('sort_order', 'desc');

      const response = await fetch(`${API_BASE_URL}/activity-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Backend returns: { success: true, data: { activity_logs: [...], pagination: {...} } }
        const activityLogs = data.data?.activity_logs || [];
        const pagination = data.data?.pagination || {};
        
        // Define type for raw API logs
        interface ActivityLogRaw {
          id?: number;
          user_id?: number;
          user?: {
            first_name?: string;
            last_name?: string;
            email?: string;
            role?: string;
            position?: string;
          };
          location?: {
            name?: string;
          };
          action?: string;
          category?: string;
          entity_type?: string;
          entity_id?: number;
          metadata?: Record<string, unknown>;
          description?: string;
          created_at?: string;
        }
        
        // Transform API data to match component structure
        let transformedLogs = activityLogs.map((log: ActivityLogRaw) => ({
          id: log.id?.toString() || '',
          userId: log.user_id?.toString() || 'system',
          userName: log.user?.first_name && log.user?.last_name 
            ? `${log.user.first_name} ${log.user.last_name}` 
            : log.user?.email || 'System',
          userType: log.user?.role || 'system',
          userRole: log.user?.position || 'System',
          location: log.location?.name || (log.user?.role === 'company_admin' ? '' : 'Unknown'),
          action: log.action || 'unknown',
          resourceType: log.category || log.entity_type || 'general',
          resourceId: log.entity_id?.toString() || '',
          resourceName: log.metadata?.resource_name as string || log.entity_type || '',
          details: log.description || '',
          metadata: log.metadata || {},
          timestamp: log.created_at || new Date().toISOString(),
          severity: determineSeverity(log.action || '')
        }));
        
        const needsClientSideFiltering = filters.userType !== 'all';
        
        // Apply client-side user type filter (since backend doesn't support this)
        if (filters.userType !== 'all') {
          transformedLogs = transformedLogs.filter((log: LocationActivityLogsActivityLog) => log.userType === filters.userType);
        }
        
        if (needsClientSideFiltering) {
          // Store all logs for client-side pagination
          setAllLogs(transformedLogs);
          
          // Calculate pagination on frontend
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const paginatedLogs = transformedLogs.slice(startIndex, endIndex);
          
          setFilteredLogs(paginatedLogs);
          setTotalLogs(transformedLogs.length);
          setTotalPages(Math.ceil(transformedLogs.length / itemsPerPage));
        } else {
          // Use backend pagination
          setAllLogs([]);
          setFilteredLogs(transformedLogs);
          setTotalLogs(pagination.total || 0);
          setTotalPages(pagination.last_page || 1);
        }
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [itemsPerPage, currentPage, selectedLocation, locations, filters, filteredLogs.length]);

  // Load initial data
  useEffect(() => {
    const initializeData = async () => {
      await loadLocations();
      // loadLogs will be called by the second useEffect when locations are loaded
    };
    initializeData();
  }, []); // Only run once on mount

  // Reload logs when filters or location change (but not on page change for client-side filtering)
  useEffect(() => {
    if (locations.length > 0 || selectedLocation === 'all') {
      const needsClientSideFiltering = filters.userType !== 'all';
      
      // Only reload if not using client-side filtering, or if it's a filter/location change
      if (!needsClientSideFiltering) {
        loadLogs();
      } else if (allLogs.length === 0) {
        // First load with client-side filter
        loadLogs();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedLocation, currentPage, loadLogs]);

  const determineSeverity = (action: string): 'info' | 'success' | 'warning' | 'error' => {
    if (action.includes('delete') || action.includes('reject')) return 'error';
    if (action.includes('create') || action.includes('approve') || action.includes('purchase')) return 'success';
    if (action.includes('update') || action.includes('edit')) return 'warning';
    return 'info';
  };

  const handleFilterChange = (key: keyof LocationActivityLogsFilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1);
  };

  const handleLocationChange = (location: string) => {
    setSelectedLocation(location);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      action: 'all',
      resourceType: 'all',
      user: 'all',
      userType: 'all',
      dateRange: 'all',
      search: ''
    });
    setCurrentPage(1);
  };

  // const exportLogs = () => {
  //   const csvContent = [
  //     ['Timestamp', 'Location', 'User', 'User Type', 'Action', 'Resource Type', 'Resource Name', 'Details', 'Severity'],
  //     ...filteredLogs.map(log => [
  //       new Date(log.timestamp).toLocaleString(),
  //       log.location,
  //       log.userName,
  //       log.userType,
  //       log.action,
  //       log.resourceType,
  //       log.resourceName || '',
  //       log.details,
  //       log.severity
  //     ])
  //   ].map(row => row.join(',')).join('\n');

  //   const blob = new Blob([csvContent], { type: 'text/csv' });
  //   const url = window.URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = `location-activity-logs-${selectedLocation}-${new Date().toISOString().split('T')[0]}.csv`;
  //   a.click();
  //   window.URL.revokeObjectURL(url);
  // };

  const handleExportWithFilters = async () => {
    setIsExporting(true);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams();
      
      // No pagination limit for export - get all matching records
      params.append('per_page', '100'); // Backend max, we'll handle pagination
      
      // Location filter - multiple locations support
      if (exportSelectedLocations.length > 0) {
        const locationIds = exportSelectedLocations
          .map(locName => locations.find(l => l.name === locName)?.id)
          .filter(id => id !== undefined);
        
        locationIds.forEach(id => {
          params.append('location_id[]', id!.toString());
        });
      }
      
      // Search filter
      if (exportFilters.search) {
        params.append('search', exportFilters.search);
      }
      
      // Action filter
      if (exportFilters.action !== 'all') {
        params.append('action', exportFilters.action);
      }
      
      // Entity type filter (mapped from resourceType)
      if (exportFilters.resourceType !== 'all') {
        params.append('entity_type', exportFilters.resourceType);
      }
      
      // User filter - multiple users selected
      if (exportSelectedUsers.length > 0) {
        // Note: If backend supports multiple user_id params, send them all
        // Otherwise, we'll filter on frontend after fetching
        exportSelectedUsers.forEach(userId => {
          params.append('user_id[]', userId);
        });
      }
      
      // Date range filter
      if (exportFilters.dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (exportFilters.dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            params.append('start_date', startDate.toISOString().split('T')[0]);
            break;
          case 'yesterday': {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            params.append('start_date', startDate.toISOString().split('T')[0]);
            params.append('end_date', endDate.toISOString().split('T')[0]);
            break;
          }
          case 'week':
            params.append('recent_days', '7');
            break;
          case 'month':
            params.append('recent_days', '30');
            break;
        }
      }
      
      // Sort
      params.append('sort_by', 'created_at');
      params.append('sort_order', 'desc');

      // Fetch all pages
      interface ActivityLogRawExport {
        id?: number;
        user_id?: number;
        user?: {
          first_name?: string;
          last_name?: string;
          email?: string;
          role?: string;
        };
        location?: {
          name?: string;
        };
        action?: string;
        category?: string;
        entity_type?: string;
        entity_id?: number;
        metadata?: Record<string, unknown>;
        description?: string;
        created_at?: string;
      }
      
      let allLogs: ActivityLogRawExport[] = [];
      let currentExportPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        params.set('page', currentExportPage.toString());
        
        const response = await fetch(`${API_BASE_URL}/activity-logs?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const activityLogs = data.data?.activity_logs || [];
          const pagination = data.data?.pagination || {};
          
          allLogs = [...allLogs, ...activityLogs];
          
          hasMorePages = currentExportPage < pagination.last_page;
          currentExportPage++;
        } else {
          hasMorePages = false;
        }
      }

      // Transform and filter logs
      interface TransformedLog {
        timestamp: string;
        location: string;
        userName: string;
        userType: string;
        userId: string;
        action: string;
        resourceType: string;
        resourceName: string;
        details: string;
        severity: string;
      }
      
      let transformedLogs: TransformedLog[] = allLogs.map((log: ActivityLogRawExport) => ({
        timestamp: log.created_at || new Date().toISOString(),
        location: log.location?.name || (log.user?.role === 'company_admin' ? 'All Locations' : 'Unknown'),
        userName: log.user?.first_name && log.user?.last_name 
          ? `${log.user.first_name} ${log.user.last_name}` 
          : log.user?.email || 'System',
        userType: log.user?.role || 'system',
        userId: log.user_id?.toString() || 'system',
        action: log.action || 'unknown',
        resourceType: log.category || log.entity_type || 'general',
        resourceName: log.metadata?.resource_name as string || log.entity_type || '',
        details: log.description || '',
        severity: determineSeverity(log.action || '')
      }));

      // Apply client-side user type filter
      if (exportFilters.userType !== 'all') {
        transformedLogs = transformedLogs.filter((log: TransformedLog) => log.userType === exportFilters.userType);
      }

      // Apply client-side user filter if backend doesn't support multiple user_id
      if (exportSelectedUsers.length > 0) {
        transformedLogs = transformedLogs.filter((log: TransformedLog) => 
          exportSelectedUsers.includes(log.userId)
        );
      }

      // Generate CSV
      const csvContent = [
        ['Timestamp', 'Location', 'User', 'User Type', 'Action', 'Resource Type', 'Resource Name', 'Details', 'Severity'],
        ...transformedLogs.map(log => [
          new Date(log.timestamp).toLocaleString(),
          log.location,
          log.userName,
          log.userType,
          log.action,
          log.resourceType,
          log.resourceName || '',
          log.details,
          log.severity
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const locationLabel = exportSelectedLocations.length > 0 
        ? exportSelectedLocations.length === 1 
          ? exportSelectedLocations[0] 
          : `${exportSelectedLocations.length}-locations`
        : 'all-locations';
      a.download = `activity-logs-${locationLabel}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting logs:', error);
      alert('Failed to export logs. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFilterChange = (key: keyof LocationActivityLogsFilterOptions, value: string) => {
    setExportFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleUserToggle = (userId: string) => {
    setExportSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAllUsers = (users: { id: string; name: string; type: string }[]) => {
    if (exportSelectedUsers.length === users.length) {
      setExportSelectedUsers([]);
    } else {
      setExportSelectedUsers(users.map(u => u.id));
    }
  };

  const handleLocationToggle = (locationName: string) => {
    setExportSelectedLocations(prev => {
      if (prev.includes(locationName)) {
        return prev.filter(name => name !== locationName);
      } else {
        return [...prev, locationName];
      }
    });
  };

  const handleSelectAllLocations = () => {
    if (exportSelectedLocations.length === locations.length) {
      setExportSelectedLocations([]);
    } else {
      setExportSelectedLocations(locations.map(l => l.name));
    }
  };

  // Get unique values for filters
  const getUniqueUsers = () => {
    const users = filteredLogs
      .map(log => ({ id: log.userId, name: log.userName, type: log.userType }));
    return [...new Map(users.map(item => [item.id, item])).values()];
  };

  const getUniqueActions = () => {
    return [...new Set(filteredLogs.map(log => log.action))];
  };

  const getUniqueResourceTypes = () => {
    return [...new Set(filteredLogs.map(log => log.resourceType))];
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Pagination - backend handles slicing, we just display what we get
  const currentLogs = filteredLogs;
  const indexOfFirstItem = filteredLogs.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
  const indexOfLastItem = ((currentPage - 1) * itemsPerPage) + filteredLogs.length;

  const paginate = (pageNumber: number) => {
    const needsClientSideFiltering = filters.userType !== 'all';
    
    if (needsClientSideFiltering && allLogs.length > 0) {
      // Handle pagination on frontend without reloading
      const startIndex = (pageNumber - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedLogs = allLogs.slice(startIndex, endIndex);
      setFilteredLogs(paginatedLogs);
      setCurrentPage(pageNumber);
    } else {
      // Backend pagination - will trigger reload
      setCurrentPage(pageNumber);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Location Activity Logs</h1>
          <p className="text-gray-600 mt-2">
            Track activities across all locations, managers, and attendants
          </p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => setShowExportModal(true)}
            icon={Download}
          >
            Export CSV
          </StandardButton>
          <StandardButton
            variant="secondary"
            size="md"
            onClick={loadLogs}
            disabled={isRefreshing}
            icon={RefreshCcw}
            className={isRefreshing ? '[&_svg]:animate-spin' : ''}
          />
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Export Activity Logs</h2>
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={() => setShowExportModal(false)}
                icon={X}
              />
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-6">
                Configure filters to export specific activity logs. All matching records will be included in the CSV file.
              </p>

              {/* Location Checklist - Multiple Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">Locations</label>
                <div className="border border-gray-200 rounded-lg p-3">
                  {(() => {
                    const displayedLocations = showAllLocations || exportSelectedLocations.length <= 3 
                      ? locations 
                      : locations.filter(l => exportSelectedLocations.includes(l.name)).slice(0, 3);
                    const hasMore = locations.length > 3 && !showAllLocations;
                    const selectedCount = exportSelectedLocations.length;

                    return (
                      <>
                        <div className="flex items-center mb-2 pb-2 border-b border-gray-200">
                          <label className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded flex-1">
                            <input
                              type="checkbox"
                              checked={exportSelectedLocations.length === locations.length}
                              onChange={handleSelectAllLocations}
                              className={`mr-2 h-4 w-4 rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Select All ({locations.length})
                            </span>
                          </label>
                          {selectedCount > 0 && (
                            <span className={`text-xs px-2 py-1 rounded-full bg-${themeColor}-100 text-${fullColor} font-medium`}>
                              {selectedCount} selected
                            </span>
                          )}
                        </div>

                        <div className={`space-y-1 ${showAllLocations ? 'max-h-60 overflow-y-auto' : ''}`}>
                          {displayedLocations.map(location => (
                            <label
                              key={location.name}
                              className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={exportSelectedLocations.includes(location.name)}
                                onChange={() => handleLocationToggle(location.name)}
                                className={`mr-2 h-4 w-4 rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                              />
                              <MapPin size={14} className="mr-2 text-gray-400" />
                              <span className="text-sm text-gray-700 flex-1">{location.name}</span>
                            </label>
                          ))}
                        </div>

                        {hasMore && selectedCount > 3 && (
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllLocations(!showAllLocations)}
                            className="mt-2 w-full"
                          >
                            View More ({locations.length - 3} hidden)
                          </StandardButton>
                        )}

                        {showAllLocations && locations.length > 3 && (
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllLocations(false)}
                            className="mt-2 w-full"
                          >
                            Show Less
                          </StandardButton>
                        )}

                        {locations.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-2">
                            No locations available
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Users Checklist */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">Users</label>
                <div className="border border-gray-200 rounded-lg p-3">
                  {(() => {
                    const allUsers = getUniqueUsers();
                    // Filter users based on search query
                    const filteredUsers = userSearchQuery
                      ? allUsers.filter(user => 
                          user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          user.type.toLowerCase().includes(userSearchQuery.toLowerCase())
                        )
                      : allUsers;
                    
                    // Show first 5 by default, or all selected users, or all if showAllUsers is true
                    const displayedUsers = showAllUsers
                      ? filteredUsers
                      : [
                          ...filteredUsers.filter(u => exportSelectedUsers.includes(u.id)),
                          ...filteredUsers.filter(u => !exportSelectedUsers.includes(u.id)).slice(0, Math.max(0, 5 - exportSelectedUsers.filter(id => filteredUsers.some(u => u.id === id)).length))
                        ].filter((user, index, self) => 
                          index === self.findIndex(u => u.id === user.id)
                        ).slice(0, showAllUsers ? undefined : Math.max(5, exportSelectedUsers.length));
                    
                    const selectedCount = exportSelectedUsers.length;
                    const hasMore = filteredUsers.length > displayedUsers.length;

                    return (
                      <>
                        {/* Search Input */}
                        <div className="mb-3">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              placeholder="Search users..."
                              value={userSearchQuery}
                              onChange={(e) => setUserSearchQuery(e.target.value)}
                              className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center mb-2 pb-2 border-b border-gray-200">
                          <label className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded flex-1">
                            <input
                              type="checkbox"
                              checked={filteredUsers.length > 0 && exportSelectedUsers.length === filteredUsers.length}
                              onChange={() => handleSelectAllUsers(filteredUsers)}
                              className={`mr-2 h-4 w-4 rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Select All ({filteredUsers.length})
                            </span>
                          </label>
                          {selectedCount > 0 && (
                            <span className={`text-xs px-2 py-1 rounded-full bg-${themeColor}-100 text-${fullColor} font-medium`}>
                              {selectedCount} selected
                            </span>
                          )}
                        </div>

                        <div className={`space-y-1 ${showAllUsers ? 'max-h-60 overflow-y-auto' : ''}`}>
                          {displayedUsers.length > 0 ? (
                            displayedUsers.map(user => (
                              <label
                                key={user.id}
                                className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={exportSelectedUsers.includes(user.id)}
                                  onChange={() => handleUserToggle(user.id)}
                                  className={`mr-2 h-4 w-4 rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                                />
                                <span className="text-sm text-gray-700 flex-1">{user.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getUserTypeColors(user.type)}`}>
                                  {user.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </span>
                              </label>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-2">
                              {userSearchQuery ? 'No users found matching your search' : 'No users available'}
                            </p>
                          )}
                        </div>

                        {hasMore && (
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllUsers(!showAllUsers)}
                            className="mt-2 w-full"
                          >
                            {showAllUsers ? 'Show Less' : `Show ${filteredUsers.length - displayedUsers.length} More`}
                          </StandardButton>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Search Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search activities, users, or locations..."
                    value={exportFilters.search}
                    onChange={(e) => handleExportFilterChange('search', e.target.value)}
                    className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  />
                </div>
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">Action</label>
                  <select
                    value={exportFilters.action}
                    onChange={(e) => handleExportFilterChange('action', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  >
                    <option value="all">All Actions</option>
                    <option value="created">Created</option>
                    <option value="updated">Updated</option>
                    <option value="deleted">Deleted</option>
                    <option value="viewed">Viewed</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="purchased">Purchased</option>
                    <option value="logged_in">Logged In</option>
                    <option value="logged_out">Logged Out</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">Resource Type</label>
                  <select
                    value={exportFilters.resourceType}
                    onChange={(e) => handleExportFilterChange('resourceType', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  >
                    <option value="all">All Types</option>
                    <option value="package">Package</option>
                    <option value="customer">Customer</option>
                    <option value="purchase">Purchase</option>
                    <option value="attraction">Attraction</option>
                    <option value="booking">Booking</option>
                    <option value="attendant">Attendant</option>
                    <option value="manager">Manager</option>
                    <option value="inventory">Inventory</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">User Type</label>
                  <select
                    value={exportFilters.userType}
                    onChange={(e) => handleExportFilterChange('userType', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  >
                    <option value="all">All Users</option>
                    <option value="company_admin">Company Admin</option>
                    <option value="location_manager">Location Managers</option>
                    <option value="attendant">Attendants</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">Date Range</label>
                  <select
                    value={exportFilters.dateRange}
                    onChange={(e) => handleExportFilterChange('dateRange', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={() => setShowExportModal(false)}
                  disabled={isExporting}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleExportWithFilters}
                  disabled={isExporting}
                  icon={isExporting ? RefreshCcw : Download}
                  className={isExporting ? '[&_svg]:animate-spin' : ''}
                >
                  {isExporting ? 'Exporting...' : 'Export CSV'}
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Filter - Clean pill design */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleLocationChange('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              selectedLocation === 'all'
                ? `bg-${fullColor} text-white shadow-sm`
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MapPin size={16} />
            All Locations
          
          </button>
          {locations.map(location => (
            <button
              key={location.name}
              onClick={() => handleLocationChange(location.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedLocation === location.name
                  ? `bg-${fullColor} text-white shadow-sm`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {location.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}>
                  <Icon size={20} />
                </div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search activities, users, or locations..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              icon={Filter}
            >
              Filters
            </StandardButton>
            <StandardButton
              variant="secondary"
              size="sm"
              onClick={loadLogs}
              icon={RefreshCcw}
            >
              {''}
            </StandardButton>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Action</label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Actions</option>
                  {getUniqueActions().map(action => (
                    <option key={action} value={action}>
                      {action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Resource Type</label>
                <select
                  value={filters.resourceType}
                  onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Types</option>
                  {getUniqueResourceTypes().map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">User Type</label>
                <select
                  value={filters.userType}
                  onChange={(e) => handleFilterChange('userType', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Users</option>
                  <option value="company_admin">Company Admin</option>
                  <option value="location_manager">Location Managers</option>
                  <option value="attendant">Attendants</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">User</label>
                <select
                  value={filters.user}
                  onChange={(e) => handleFilterChange('user', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Users</option>
                  {getUniqueUsers().map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear Filters
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Activity Logs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedLocation === 'all' ? 'All Location Activities' : `${selectedLocation} Activities`}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Showing {currentLogs.length} of {totalLogs} activities
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {currentLogs.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-800">
              No activity logs found matching your filters
            </div>
          ) : (
            currentLogs.map((log) => {
              const ActionIcon = actionIcons[log.action as keyof typeof actionIcons] || Clock;
              const isExpanded = expandedLogIds.has(log.id);
              const metadataItems = formatMetadataForDisplay(log.metadata as Record<string, unknown>);
              const hasMetadata = metadataItems.length > 0;
              
              return (
                <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={getSeverityColors(log.severity) + ' p-2 rounded-lg'}>
                      <ActionIcon size={16} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className="font-medium text-gray-900">{log.userName}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUserTypeColors(log.userType)}`}>
                          {log.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </span>
                        {log.userType !== 'company_admin' && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <MapPin size={12} />
                              {log.location}
                            </span>
                          </>
                        )}
                      </div>
                      
                      {/* Detailed Description */}
                      <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                        {formatActivityDescription(log)}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getResourceTypeColors(log.resourceType)}`}>
                          {log.resourceType.charAt(0).toUpperCase() + log.resourceType.slice(1)}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColors(log.severity)}`}>
                          {log.severity.charAt(0).toUpperCase() + log.severity.slice(1)}
                        </span>
                        {log.resourceId && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs text-gray-600 font-mono">ID: {log.resourceId}</span>
                          </>
                        )}
                        <span className="text-gray-400">•</span>
                        <span className="text-xs text-gray-500" title={new Date(log.timestamp).toLocaleString()}>
                          {formatTimestamp(log.timestamp)}
                        </span>
                        
                        {/* View Metadata Button */}
                        {hasMetadata && (
                          <>
                            <span className="text-gray-400">•</span>
                            <button
                              onClick={() => toggleLogExpanded(log.id)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                isExpanded 
                                  ? `bg-${themeColor}-100 text-${fullColor}` 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              <Info size={12} />
                              {isExpanded ? 'Hide Details' : 'View Details'}
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Expanded Metadata Section */}
                      {isExpanded && hasMetadata && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Info size={14} />
                            Activity Metadata
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {metadataItems.map((item, idx) => (
                              <div key={idx} className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">{item.key}</span>
                                <span className={`text-sm text-gray-800 ${item.value.includes('\n') ? 'whitespace-pre-wrap font-mono text-xs bg-white p-2 rounded border mt-1' : ''}`}>
                                  {item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Raw JSON View */}
                          <details className="mt-4">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View Raw JSON
                            </summary>
                            <pre className="mt-2 p-3 bg-white rounded border border-gray-200 text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-800">
                Showing <span className="font-medium">{indexOfFirstItem}</span> to{' '}
                <span className="font-medium">
                  {Math.min(indexOfLastItem, totalLogs)}
                </span>{' '}
                of <span className="font-medium">{totalLogs}</span> activities
              </div>
              <div className="flex items-center gap-2">
                <StandardButton
                  variant="secondary"
                  size="sm"
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </StandardButton>
                
                {/* Pagination buttons limited to 3 */}
                {(() => {
                  let start = 1;
                  let end = totalPages;
                  if (totalPages > 3) {
                    if (currentPage <= 2) {
                      start = 1;
                      end = 3;
                    } else if (currentPage >= totalPages - 1) {
                      start = totalPages - 2;
                      end = totalPages;
                    } else {
                      start = currentPage - 1;
                      end = currentPage + 1;
                    }
                  }
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((page) => (
                    <StandardButton
                      key={page}
                      variant={currentPage === page ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => paginate(page)}
                    >
                      {page}
                    </StandardButton>
                  ));
                })()}
                
                <StandardButton
                  variant="secondary"
                  size="sm"
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </StandardButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add missing icons
const FileText = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CheckCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export default LocationActivityLogs;
