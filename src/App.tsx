
import { Route, Routes } from "react-router-dom"
import MainLayout from "./layouts/AdminMainLayout";
import Home from "./pages/Home"
import Login from "./pages/auth/Login"
import CreatePackage from "./pages/admin/packages/CreatePackage"
import Packages from "./pages/admin/packages/Packages"
import BookPackage from "./pages/admin/bookings/BookPackage"
import GiftCard from "./pages/admin/packages/GiftCard"
import Promo from "./pages/admin/packages/Promo"
import BookingWidget from "./components/embed/BookingWidget"
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


function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/book/package/:id" element={<BookPackage />} />
      <Route path="/purchase/attraction/:id" element={<PurchaseAttraction />} />
      
  <Route element={<MainLayout />}>
        <Route path="/attendant/dashboard" element={<AttendantDashboard />} />
        <Route path="/manager/dashboard" element={<LocationManagerDashboard />} />
        <Route path="/company/dashboard" element={<CompanyDashboard />} />
        <Route path="/attractions/create" element={<CreateAttraction />} />
        <Route path="/attractions/" element={<ManageAttractions />} />
        <Route path="/packages/create" element={<CreatePackage />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/packages/promos" element={<Promo />} />
        <Route path="/packages/gift-cards" element={<GiftCard />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/bookings/calendar" element={<CalendarView />} />
        <Route path="/bookings/create" element={<OnsiteBooking />} />
        <Route path="/bookings/check-in" element={<CheckIn />} />
        </Route>

           {/* Add embed route */}
        <Route path="/embed/booking/:packageId" element={
          <div className="container mx-auto p-4">
            <BookingWidget packageId="{packageId}" />
          </div>
        } />
    </Routes>
  );
}

export default App
