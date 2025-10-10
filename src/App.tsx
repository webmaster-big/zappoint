
import { Route, Routes } from "react-router-dom"
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import PageTitleSetter from "./components/PageTitleSetter";
import MainLayout from "./layouts/AdminMainLayout";
import Home from "./pages/Home"
import Login from "./pages/auth/Login"
import CreatePackage from "./pages/admin/packages/CreatePackage"
import Packages from "./pages/admin/packages/Packages"
import BookPackage from "./pages/admin/bookings/BookPackage"
import GiftCard from "./pages/admin/packages/GiftCard"
import Promo from "./pages/admin/packages/Promo"
import EmbedBookingRoute from "./components/embed/EmbedBookingRoute";
import Bookings from "./pages/admin/bookings/Bookings"
import CalendarView from "./pages/admin/bookings/CalendarView"
import OnsiteBooking from "./pages/admin/bookings/OnsiteBooking"
import CheckIn from "./pages/admin/bookings/CheckIn"
import CreateAttraction from "./pages/admin/attractions/CreateAttractions";
import ManageAttractions from "./pages/admin/attractions/ManageAttractions";
import LocationManagerDashboard from "./pages/admin/ManagerDashboard";
import CompanyDashboard from "./pages/admin/CompanyDashboard";
import AttendantDashboard from "./pages/admin/AttendantDashboard";
import PurchaseAttraction from "./pages/admin/attractions/PurchaseAttraction";
import ManagePurchases from "./pages/admin/attractions/AttractionPurchases";
import CreatePurchase from "./pages/admin/attractions/CreatePurchase";
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
import AttendantsPerformance from "./pages/admin/Attendants/AttendantsPerformance";
import LocationAnalytics from "./pages/admin/Analytics/LocationManagerAnalytics";
import CompanyAnalytics from "./pages/admin/Analytics/CompanyAnalytics";
import AttendantActivityLogs from "./pages/admin/Attendants/AttendantActivityLogs";
import ManageAttendants from "./pages/admin/Attendants/ManageAttendants";
import ManageAddOns from "./pages/admin/packages/AddOns";


function App() {
  return (
    <ThemeProvider>
      <PageTitleSetter />
      <Routes>
        <Route path="/admin" element={<Login />} />
        <Route path="/register" element={<CompanyAdminRegistration />} />
        <Route path="/home" element={<Home />} />
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route path="/customer/register" element={<CustomerRegister />} />
        <Route path="/" element={<EntertainmentLandingPage />} />
        <Route path="/book/package/:id" element={<BookPackage />} />
        <Route path="/purchase/attraction/:id" element={<PurchaseAttraction />} />
        <Route element={<MainLayout />}> 
          <Route path="/attendant/dashboard" element={<AttendantDashboard />} />
          <Route path="/manager/dashboard" element={<LocationManagerDashboard />} />
          <Route path="/company/dashboard" element={<CompanyDashboard />} />
          <Route path="/attractions/create" element={<CreateAttraction />} />
          <Route path="/attractions/" element={<ManageAttractions />} />
          <Route path="/attractions/purchases" element={<ManagePurchases />} />
          <Route path="/attractions/purchases/create" element={<CreatePurchase />} />
          <Route path="/packages/create" element={<CreatePackage />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/packages/promos" element={<Promo />} />
          <Route path="/packages/add-ons" element={<ManageAddOns />} />
          <Route path="/packages/gift-cards" element={<GiftCard />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/calendar" element={<CalendarView />} />
          <Route path="/bookings/create" element={<OnsiteBooking />} />
          <Route path="/bookings/check-in" element={<CheckIn />} />
          <Route path="/customers/analytics" element={<CustomerAnalytics />} />
          <Route path="/customers" element={<CustomerListing />} />
          <Route path="/admin/profile" element={<CompanyAdminProfile />} />
          <Route path="/manager/profile" element={<LocationManagerProfile />} />
          <Route path="/attendant/profile" element={<AttendantProfile />} />
          <Route path="/manager/attendant/create" element={<CreateAttendant />} />
          <Route path="/manager/attendants" element={<ManageAttendants />} />
          <Route path="/manager/attendants/activity" element={<AttendantActivityLogs />} />
          <Route path="/manager/attendants/performance" element={<AttendantsPerformance />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin/analytics" element={<CompanyAnalytics />} />
          <Route path="/manager/analytics" element={<LocationAnalytics />} />
          <Route path="/admin/activity" element={<LocationActivityLogs />} />
          <Route path="/admin/attendants/performance" element={<AttendantsPerformance />} />
          <Route path="/admin/users" element={<ManageAccounts />} />
          <Route path="/admin/users/create" element={<CreateAccount />} />
        </Route>
        {/* Add embed route */}
        <Route path="/embed/booking/:packageId" element={<EmbedBookingRoute />} />
        {/* 404 Not Found Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App
