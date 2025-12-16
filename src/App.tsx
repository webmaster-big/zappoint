import { Route, Routes } from "react-router-dom"
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import PageTitleSetter from "./components/PageTitleSetter";
import MainLayout from "./layouts/AdminMainLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import CustomerProtectedRoute from "./components/auth/CustomerProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import Home from "./pages/Home"
import Login from "./pages/auth/Login"
import CreatePackage from "./pages/admin/packages/CreatePackage"
import EditPackage from "./pages/admin/packages/EditPackage"
import Packages from "./pages/admin/packages/Packages"
import BookPackage from "./pages/admin/bookings/BookPackage"
import GiftCard from "./pages/admin/packages/GiftCard"
import Promo from "./pages/admin/packages/Promo"
import EmbedBookingRoute from "./components/embed/EmbedBookingRoute";
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
import CustomerAnalytics from "./pages/admin/customer/CustomerAnalytics";
import CustomerListing from "./pages/admin/customer/Customers";
import CompanyAdminRegistration from "./pages/auth/Register";
import CompanyAdminProfile from "./pages/admin/profile/CompanyAdminProfile";
import LocationManagerProfile from "./pages/admin/profile/LocationManagerProfile";
import AttendantProfile from "./pages/admin/profile/AttendantProfile";
import CreateAttendant from "./pages/admin/users/CreateAttendant";
import Notifications from "./pages/admin/Notifications";
import LocationActivityLogs from "./pages/admin/LocationActivityLogs";
import ManageAccounts from "./pages/admin/users/ManageAccounts";
import CreateAccount from "./pages/admin/users/CreateAccounts";
import EntertainmentLandingPage from "./pages/customer/Home";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerRegister from "./pages/customer/CustomerRegister";
import LocationAnalytics from "./pages/admin/Analytics/LocationManagerAnalytics";
import CompanyAnalytics from "./pages/admin/Analytics/CompanyAnalytics";
import AttendantActivityLogs from "./pages/admin/Attendants/AttendantActivityLogs";
import ManageAttendants from "./pages/admin/Attendants/ManageAttendants";
import ManageAddOns from "./pages/admin/packages/AddOns";
import CustomerReservations from "./pages/customer/CustomerReservation";
import CustomerGiftCards from './pages/customer/CustomerGiftCards';
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import CustomerLayout from "./layouts/CustomerLayout";
import Settings from "./pages/admin/Settings";
import Rooms from "./pages/admin/packages/Rooms";
import ViewBooking from "./pages/admin/bookings/ViewBooking";
import AttractionDetails from "./pages/admin/attractions/AttractionDetails";
import PurchaseDetails from "./pages/admin/attractions/PurchaseDetails";
import PackageDetails from "./pages/admin/packages/PackageDetails";
import RoomSchedule from "./pages/admin/bookings/RoomSchedule";


function App() {
  return (
    <ThemeProvider>
      <PageTitleSetter />
      <Routes>
        {/* Public Routes - Restricted (redirect if authenticated) */}
        <Route path="/admin" element={<PublicRoute restricted><Login /></PublicRoute>} />
        <Route path="/admin/register" element={<PublicRoute restricted><CompanyAdminRegistration /></PublicRoute>} />
        <Route path="/customer/login" element={<PublicRoute restricted><CustomerLogin /></PublicRoute>} />
        <Route path="/customer/register" element={<PublicRoute restricted><CustomerRegister /></PublicRoute>} />
        
        {/* Public Routes - Unrestricted */}
        <Route path="/home" element={<Home />} />
        <Route path="/book/package/:location/:slug" element={<BookPackage />} />
        <Route path="/purchase/attraction/:location/:slug" element={<PurchaseAttraction />} />
        <Route path="/embed/booking/:packageId" element={<EmbedBookingRoute />} />
        
        {/* Customer Routes */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<EntertainmentLandingPage />} />
          <Route path="/customer/reservations" element={<CustomerProtectedRoute><CustomerReservations /></CustomerProtectedRoute>} />
          <Route path="/customer/gift-cards" element={<CustomerProtectedRoute><CustomerGiftCards /></CustomerProtectedRoute>} />
          <Route path="/customer/notifications" element={<CustomerProtectedRoute><CustomerNotifications /></CustomerProtectedRoute>} />
        </Route>
        
        {/* Protected Admin Routes */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}> 
          {/* Dashboard Routes - Role-specific */}
          <Route path="/attendant/dashboard" element={<ProtectedRoute allowedRoles={['attendant']}><AttendantDashboard /></ProtectedRoute>} />
          <Route path="/manager/dashboard" element={<ProtectedRoute allowedRoles={['location_manager']}><LocationManagerDashboard /></ProtectedRoute>} />
          <Route path="/company/dashboard" element={<ProtectedRoute allowedRoles={['company_admin']}><CompanyDashboard /></ProtectedRoute>} />
          
          {/* Attractions Routes - All authenticated users */}
          <Route path="/attractions/create" element={<CreateAttraction />} />
          <Route path="/edit-attraction/:id" element={<EditAttraction />} />
          <Route path="/attractions/edit/:id" element={<EditAttraction />} />
          <Route path="/attractions/" element={<ManageAttractions />} />
          <Route path="/attractions/details/:slug" element={<AttractionDetails />} />
          <Route path="/attractions/purchases" element={<ManagePurchases />} />
          <Route path="/attractions/purchases/:id" element={<PurchaseDetails />} />
          <Route path="/attractions/purchases/create" element={<CreatePurchase />} />
          <Route path="/attractions/check-in" element={<AttractionCheckIn />} />
          
          {/* Packages Routes - All authenticated users */}
          <Route path="/packages/create" element={<CreatePackage />} />
          <Route path="/packages/edit/:id" element={<EditPackage />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/packages/details/:slug" element={<PackageDetails />} />
          <Route path="/packages/promos" element={<Promo />} />
          <Route path="/packages/rooms" element={<Rooms />} />
          <Route path="/packages/add-ons" element={<ManageAddOns />} />
          <Route path="/packages/gift-cards" element={<GiftCard />} />
          
          {/* Bookings Routes - All authenticated users */}
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/edit/:id" element={<EditBooking />} />
          <Route path="/bookings/:id" element={<ViewBooking />} />
          <Route path="/bookings/calendar" element={<CalendarView />} />
          <Route path="/bookings/room-schedule" element={<RoomSchedule />} />
          <Route path="/bookings/create" element={<OnsiteBooking />} />
          <Route path="/bookings/manual" element={<ManualBooking />} />
          <Route path="/bookings/check-in" element={<CheckIn />} />
          
          {/* Customers Routes - All authenticated users */}
          <Route path="/customers/analytics" element={<CustomerAnalytics />} />
          <Route path="/customers" element={<CustomerListing />} />
          
          {/* Profile Routes - Role-specific */}
          <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['company_admin']}><CompanyAdminProfile /></ProtectedRoute>} />
          <Route path="/manager/profile" element={<ProtectedRoute allowedRoles={['location_manager']}><LocationManagerProfile /></ProtectedRoute>} />
          <Route path="/attendant/profile" element={<ProtectedRoute allowedRoles={['attendant']}><AttendantProfile /></ProtectedRoute>} />
          
          {/* Manager-only Routes */}
          <Route path="/manager/attendant/create" element={<ProtectedRoute allowedRoles={['location_manager']}><CreateAttendant /></ProtectedRoute>} />
          <Route path="/manager/attendants" element={<ProtectedRoute allowedRoles={['location_manager']}><ManageAttendants /></ProtectedRoute>} />
          <Route path="/manager/attendants/activity" element={<ProtectedRoute allowedRoles={['location_manager']}><AttendantActivityLogs /></ProtectedRoute>} />
          <Route path="/manager/analytics" element={<ProtectedRoute allowedRoles={['location_manager']}><LocationAnalytics /></ProtectedRoute>} />
          
          {/* Company Admin-only Routes */}
          <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['company_admin']}><CompanyAnalytics /></ProtectedRoute>} />
          <Route path="/admin/activity" element={<ProtectedRoute allowedRoles={['company_admin']}><LocationActivityLogs /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['company_admin']}><ManageAccounts /></ProtectedRoute>} />
          <Route path="/admin/users/create" element={<ProtectedRoute allowedRoles={['company_admin']}><CreateAccount /></ProtectedRoute>} />
          
          {/* Shared Routes - All authenticated users */}
          <Route path="/notifications" element={<Notifications />} />
          
          {/* Settings Routes - Role-specific */}
          <Route path="/attendant/settings" element={<ProtectedRoute allowedRoles={['attendant']}><Settings /></ProtectedRoute>} />
          <Route path="/manager/settings" element={<ProtectedRoute allowedRoles={['location_manager']}><Settings /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['company_admin']}><Settings /></ProtectedRoute>} />
        </Route>
        
        {/* 404 Not Found Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App
