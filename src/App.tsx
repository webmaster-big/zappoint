import { Route, Routes, Navigate, useLocation } from "react-router-dom"
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import PageTitleSetter from "./components/PageTitleSetter";
import { getStoredUser } from "./utils/storage";
import MainLayout from "./layouts/AdminMainLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import CustomerProtectedRoute from "./components/auth/CustomerProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import Home from "./pages/Home"
import Login from "./pages/auth/Login"
import CreatePackage from "./pages/admin/packages/CreatePackage"
import EditPackage from "./pages/admin/packages/EditPackage"
import Packages from "./pages/admin/packages/Packages"
import CustomPackages from "./pages/admin/packages/CustomPackages"
import BookPackage from "./pages/admin/bookings/BookPackage"
import GiftCard from "./pages/admin/packages/GiftCard"
import Promo from "./pages/admin/packages/Promo"
import Bookings from "./pages/admin/bookings/Bookings"
import EditBooking from "./pages/admin/bookings/EditBooking"
import CalendarView from "./pages/admin/bookings/CalendarView"
import OnsiteBooking from "./pages/admin/bookings/OnsiteBooking"
import ManualBooking from "./pages/admin/bookings/ManualBooking"
import CheckIn from "./pages/admin/bookings/CheckIn"
import CreateAttraction from "./pages/admin/attractions/CreateAttractions";
import EditAttraction from "./pages/admin/attractions/EditAttraction";
import ManageAttractions from "./pages/admin/attractions/ManageAttractions";
import LocationManagerDashboard from "./pages/admin/ManagerDashboard";
import CompanyDashboard from "./pages/admin/CompanyDashboard";
import AttendantDashboard from "./pages/admin/AttendantDashboard";
import PurchaseAttraction from "./pages/admin/attractions/PurchaseAttraction";
import ManagePurchases from "./pages/admin/attractions/AttractionPurchases";
import CreatePurchase from "./pages/admin/attractions/CreatePurchase";
import AttractionCheckIn from "./pages/admin/attractions/AttractionCheckIn";
import Payments from "./pages/admin/payments/Payments";
import ViewPayment from "./pages/admin/payments/ViewPayment";
import CustomerAnalytics from "./pages/admin/customer/CustomerAnalytics";
import CustomerListing from "./pages/admin/customer/Customers";
import CompanyAdminRegistration from "./pages/auth/Register";
import CompanyAdminProfile from "./pages/admin/profile/CompanyAdminProfile";
import LocationManagerProfile from "./pages/admin/profile/LocationManagerProfile";
import AttendantProfile from "./pages/admin/profile/AttendantProfile";
import Notifications from "./pages/admin/Notifications";
import LocationActivityLogs from "./pages/admin/LocationActivityLogs";
import ManageAccounts from "./pages/admin/users/ManageAccounts";
import EntertainmentLandingPage from "./pages/customer/Home";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerRegister from "./pages/customer/CustomerRegister";
import LocationAnalytics from "./pages/admin/Analytics/LocationManagerAnalytics";
import CompanyAnalytics from "./pages/admin/Analytics/CompanyAnalytics";
import AccountingAnalytics from "./pages/admin/Analytics/AccountingAnalytics";
import PageAnalytics from "./pages/admin/Analytics/PageAnalytics";
import AttendantActivityLogs from "./pages/admin/Attendants/AttendantActivityLogs";
import ManageAttendants from "./pages/admin/Attendants/ManageAttendants";
import ManageAddOns from "./pages/admin/packages/AddOns";
import CustomerReservations from "./pages/customer/CustomerReservation";
import CustomerGiftCards from './pages/customer/CustomerGiftCards';
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import CustomerLayout from "./layouts/CustomerLayout";
import Settings from "./pages/admin/Settings";
import Rooms from "./pages/admin/packages/Rooms";
import DayOffs from "./pages/admin/dayoffs/DayOffs";
import ViewBooking from "./pages/admin/bookings/ViewBooking";
import AttractionDetails from "./pages/admin/attractions/AttractionDetails";
import PurchaseDetails from "./pages/admin/attractions/PurchaseDetails";
import PackageDetails from "./pages/admin/packages/PackageDetails";
import TrashedPackages from "./pages/admin/packages/TrashedPackages";
import GlobalNotes from "./pages/admin/packages/GlobalNotes";
import SpaceSchedule from "./pages/admin/bookings/SpaceSchedule";
import EmailTemplates from "./pages/admin/email/EmailTemplates";
import CreateEmailTemplate from "./pages/admin/email/CreateEmailTemplate";
import EditEmailTemplate from "./pages/admin/email/EditEmailTemplate";
import EmailCampaigns from "./pages/admin/email/EmailCampaigns";
import CreateEmailCampaign from "./pages/admin/email/CreateEmailCampaign";
import EmailCampaignDetails from "./pages/admin/email/EmailCampaignDetails";
import EmailNotifications from "./pages/admin/email/EmailNotifications";
import CreateEmailNotification from "./pages/admin/email/CreateEmailNotification";
import EditEmailNotification from "./pages/admin/email/EditEmailNotification";
import EmailNotificationDetails from "./pages/admin/email/EmailNotificationDetails";
import FeeSupports from "./pages/admin/fee-supports/FeeSupports";
import SpecialPricings from "./pages/admin/special-pricing/SpecialPricings";
import RsvpPage from "./pages/public/RsvpPage";
import Events from "./pages/admin/events/Events";
import CreateEvent from "./pages/admin/events/CreateEvent";
import EditEvent from "./pages/admin/events/EditEvent";
import OnsitePurchaseEvent from "./pages/admin/events/OnsitePurchaseEvent";
import EventPurchases from "./pages/admin/events/EventPurchases";
import ViewEventPurchase from "./pages/admin/events/ViewEventPurchase";
import PurchaseEvent from "./pages/customer/PurchaseEvent";
import MyEvents from "./pages/customer/MyEvents";
import MyAttractions from "./pages/customer/MyAttractions";
import PageViewBeacon from "./components/PageViewBeacon";

import MyMembership from "./pages/customer/MyMembership";
import PurchaseMembership from "./pages/customer/PurchaseMembership";
import UpdatePaymentMethod from "./pages/customer/UpdatePaymentMethod";
import MembershipPlans from "./pages/admin/memberships/MembershipPlans";
import Memberships from "./pages/admin/memberships/Memberships";
import MembershipDetails from "./pages/admin/memberships/MembershipDetails";
import MembershipCheckIn from "./pages/admin/memberships/MembershipCheckIn";
import MembershipReports from "./pages/admin/memberships/MembershipReports";

const GoogleCalendarRedirect = () => {
  const location = useLocation();
  const user = getStoredUser();
  const role = user?.role || '';
  const rolePrefix = role === 'company_admin' ? 'admin' : role === 'location_manager' ? 'manager' : role === 'attendant' ? 'attendant' : 'admin';

  if (window.opener) {
    const params = new URLSearchParams(location.search);
    if (params.get('connected') === 'true') {
      window.opener.postMessage(
        { type: 'GOOGLE_CALENDAR_CONNECTED', location_id: params.get('location_id') },
        window.location.origin
      );
    } else if (params.get('error')) {
      window.opener.postMessage(
        { type: 'GOOGLE_CALENDAR_ERROR', error: params.get('error') },
        window.location.origin
      );
    }
    window.close();
    return null;
  }

  return <Navigate to={`/${rolePrefix}/settings${location.search}`} replace />;
};

function App() {
  return (
    <ThemeProvider>
      <PageTitleSetter />
      <Routes>
        <Route path="/admin" element={<PublicRoute restricted><Login /></PublicRoute>} />
        <Route path="/admin/register" element={<PublicRoute restricted><CompanyAdminRegistration /></PublicRoute>} />
        <Route path="/customer/login" element={<PublicRoute restricted><><PageViewBeacon pageType="customer_login" /><CustomerLogin /></></PublicRoute>} />
        <Route path="/customer/register" element={<PublicRoute restricted><><PageViewBeacon pageType="customer_register" /><CustomerRegister /></></PublicRoute>} />
        
        <Route path="/home" element={<><PageViewBeacon pageType="home" /><Home /></>} />
        <Route path="/book/package/:location/:slug" element={<><PageViewBeacon pageType="package_book" entityType="package" entityIdFromSlugParam="slug" /><BookPackage /></>} />
        <Route path="/purchase/attraction/:location/:slug" element={<><PageViewBeacon pageType="attraction_buy" entityType="attraction" entityIdFromSlugParam="slug" /><PurchaseAttraction /></>} />
        <Route path="/purchase/event/:location/:slug" element={<><PageViewBeacon pageType="event_buy" entityType="event" entityIdFromSlugParam="slug" /><PurchaseEvent /></>} />
        <Route path="/events/:eventId/purchase" element={<><PageViewBeacon pageType="event_buy" entityType="event" entityIdParam="eventId" /><PurchaseEvent /></>} />
        <Route path="/rsvp/:token" element={<><PageViewBeacon pageType="rsvp" /><RsvpPage /></>} />
        
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<><PageViewBeacon pageType="home" /><EntertainmentLandingPage /></>} />
          <Route path="/customer/reservations" element={<CustomerProtectedRoute><><PageViewBeacon pageType="my_reservations" /><CustomerReservations /></></CustomerProtectedRoute>} />
          <Route path="/customer/attractions" element={<CustomerProtectedRoute><><PageViewBeacon pageType="my_attractions" /><MyAttractions /></></CustomerProtectedRoute>} />
          <Route path="/customer/events" element={<CustomerProtectedRoute><><PageViewBeacon pageType="my_events" /><MyEvents /></></CustomerProtectedRoute>} />
          <Route path="/customer/gift-cards" element={<CustomerProtectedRoute><><PageViewBeacon pageType="my_gift_cards" /><CustomerGiftCards /></></CustomerProtectedRoute>} />
          <Route path="/customer/notifications" element={<CustomerProtectedRoute><><PageViewBeacon pageType="my_notifications" /><CustomerNotifications /></></CustomerProtectedRoute>} />
          <Route path="/customer/membership" element={<CustomerProtectedRoute><><PageViewBeacon pageType="my_membership" /><MyMembership /></></CustomerProtectedRoute>} />
          <Route path="/customer/membership/purchase" element={<CustomerProtectedRoute><><PageViewBeacon pageType="membership_purchase" /><PurchaseMembership /></></CustomerProtectedRoute>} />
          <Route path="/customer/membership/update-payment" element={<CustomerProtectedRoute><><PageViewBeacon pageType="membership_update_payment" /><UpdatePaymentMethod /></></CustomerProtectedRoute>} />
        </Route>
        
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}> 
          <Route path="/attendant/dashboard" element={<ProtectedRoute allowedRoles={['attendant']}><AttendantDashboard /></ProtectedRoute>} />
          <Route path="/manager/dashboard" element={<ProtectedRoute allowedRoles={['location_manager']}><LocationManagerDashboard /></ProtectedRoute>} />
          <Route path="/company/dashboard" element={<ProtectedRoute allowedRoles={['company_admin']}><CompanyDashboard /></ProtectedRoute>} />
          
          <Route path="/attractions/create" element={<CreateAttraction />} />
          <Route path="/edit-attraction/:id" element={<EditAttraction />} />
          <Route path="/attractions/edit/:id" element={<EditAttraction />} />
          <Route path="/attractions/" element={<ManageAttractions />} />
          <Route path="/attractions/details/:slug" element={<AttractionDetails />} />
          <Route path="/attractions/purchases" element={<ManagePurchases />} />
          <Route path="/attractions/purchases/:id" element={<PurchaseDetails />} />
          <Route path="/attractions/purchases/create" element={<CreatePurchase />} />
          <Route path="/attractions/check-in" element={<AttractionCheckIn />} />
          
          <Route path="/events" element={<Events />} />
          <Route path="/events/create" element={<CreateEvent />} />
          <Route path="/events/:id/edit" element={<EditEvent />} />
          <Route path="/events/onsite-purchase" element={<OnsitePurchaseEvent />} />
          <Route path="/events/purchases" element={<EventPurchases />} />
          <Route path="/events/purchases/:id" element={<ViewEventPurchase />} />
          
          <Route path="/packages/create" element={<CreatePackage />} />
          <Route path="/packages/edit/:id" element={<EditPackage />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/packages/custom" element={<CustomPackages />} />
          <Route path="/packages/details/:slug" element={<PackageDetails />} />
          <Route path="/packages/trashed" element={<TrashedPackages />} />
          <Route path="/packages/global-notes" element={<GlobalNotes />} />
          <Route path="/packages/promos" element={<Promo />} />
          <Route path="/packages/rooms" element={<Rooms />} />
          <Route path="/packages/add-ons" element={<ManageAddOns />} />
          <Route path="/packages/gift-cards" element={<GiftCard />} />
          
          <Route path="/fee-supports" element={<FeeSupports />} />
          <Route path="/special-pricings" element={<SpecialPricings />} />

          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/edit/:id" element={<EditBooking />} />
          <Route path="/bookings/:id" element={<ViewBooking />} />
          <Route path="/bookings/calendar" element={<CalendarView />} />
          <Route path="/bookings/space-schedule" element={<SpaceSchedule />} />
          <Route path="/bookings/create" element={<OnsiteBooking />} />
          <Route path="/bookings/manual" element={<ManualBooking />} />
          <Route path="/bookings/check-in" element={<CheckIn />} />
          
          <Route path="/payments/:id" element={<ViewPayment />} />
          
          <Route path="/customers/analytics" element={<CustomerAnalytics />} />
          <Route path="/customers" element={<CustomerListing />} />

          <Route path="/memberships" element={<Memberships />} />
          <Route path="/memberships/plans" element={<MembershipPlans />} />
          <Route path="/memberships/check-in" element={<MembershipCheckIn />} />
          <Route path="/memberships/reports" element={<MembershipReports />} />
          <Route path="/memberships/:id" element={<MembershipDetails />} />
          
          <Route path="/admin/email/templates" element={<EmailTemplates />} />
          <Route path="/admin/email/templates/create" element={<CreateEmailTemplate />} />
          <Route path="/admin/email/templates/edit/:id" element={<EditEmailTemplate />} />
          <Route path="/admin/email/campaigns" element={<EmailCampaigns />} />
          <Route path="/admin/email/campaigns/create" element={<CreateEmailCampaign />} />
          <Route path="/admin/email/campaigns/:id" element={<EmailCampaignDetails />} />
          
          <Route path="/admin/email/notifications" element={<EmailNotifications />} />
          <Route path="/admin/email/notifications/create" element={<CreateEmailNotification />} />
          <Route path="/admin/email/notifications/edit/:id" element={<EditEmailNotification />} />
          <Route path="/admin/email/notifications/:id" element={<EmailNotificationDetails />} />
          
          <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['company_admin']}><CompanyAdminProfile /></ProtectedRoute>} />
          <Route path="/manager/profile" element={<ProtectedRoute allowedRoles={['location_manager']}><LocationManagerProfile /></ProtectedRoute>} />
          <Route path="/attendant/profile" element={<ProtectedRoute allowedRoles={['attendant']}><AttendantProfile /></ProtectedRoute>} />
          
          <Route path="/manager/attendants" element={<ProtectedRoute allowedRoles={['location_manager']}><ManageAttendants /></ProtectedRoute>} />
          <Route path="/manager/attendants/activity" element={<ProtectedRoute allowedRoles={['location_manager']}><AttendantActivityLogs /></ProtectedRoute>} />
          <Route path="/manager/day-offs" element={<ProtectedRoute allowedRoles={['location_manager']}><DayOffs /></ProtectedRoute>} />
          <Route path="/manager/analytics" element={<ProtectedRoute allowedRoles={['location_manager']}><LocationAnalytics /></ProtectedRoute>} />
          <Route path="/manager/analytics/pages" element={<ProtectedRoute allowedRoles={['location_manager']}><PageAnalytics /></ProtectedRoute>} />
          <Route path="/manager/accounting" element={<ProtectedRoute allowedRoles={['location_manager']}><AccountingAnalytics /></ProtectedRoute>} />
          <Route path="/manager/payments" element={<ProtectedRoute allowedRoles={['location_manager']}><Payments /></ProtectedRoute>} />
          <Route path="/manager/payments/:id" element={<ProtectedRoute allowedRoles={['location_manager']}><ViewPayment /></ProtectedRoute>} />
          
          <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['company_admin']}><CompanyAnalytics /></ProtectedRoute>} />
          <Route path="/admin/analytics/pages" element={<ProtectedRoute allowedRoles={['company_admin']}><PageAnalytics /></ProtectedRoute>} />
          <Route path="/admin/accounting" element={<ProtectedRoute allowedRoles={['company_admin']}><AccountingAnalytics /></ProtectedRoute>} />
          <Route path="/admin/activity" element={<ProtectedRoute allowedRoles={['company_admin']}><LocationActivityLogs /></ProtectedRoute>} />
          <Route path="/admin/day-offs" element={<ProtectedRoute allowedRoles={['company_admin']}><DayOffs /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['company_admin']}><ManageAccounts /></ProtectedRoute>} />
          <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['company_admin']}><Payments /></ProtectedRoute>} />
          <Route path="/admin/payments/:id" element={<ProtectedRoute allowedRoles={['company_admin']}><ViewPayment /></ProtectedRoute>} />
          
          <Route path="/notifications" element={<Notifications />} />
          
          <Route path="/attendant/settings" element={<ProtectedRoute allowedRoles={['attendant']}><Settings /></ProtectedRoute>} />
          <Route path="/manager/settings" element={<ProtectedRoute allowedRoles={['location_manager']}><Settings /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['company_admin']}><Settings /></ProtectedRoute>} />
        </Route>
        
        <Route path="/settings/google-calendar" element={<GoogleCalendarRedirect />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App

  
