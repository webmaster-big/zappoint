
import { Route, Routes } from "react-router-dom"
import Home from "./pages/Home"
import Login from "./pages/auth/Login"
import AttendeesDashboard from "./pages/admin/AttendeesDashboard"
import CreatePackage from "./pages/admin/packages/CreatePackage"
import Packages from "./pages/admin/packages/Packages"
import BookPackage from "./pages/admin/bookings/BookPackage"
import GiftCard from "./pages/admin/packages/GiftCard"
import Promo from "./pages/admin/packages/Promo"
import BookingWidget from "./components/embed/BookingWidget"


function App() {

  return (
    <>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/attendee/dashboard" element={<AttendeesDashboard />} />
      <Route path="/packages/create" element={<CreatePackage />} />
      <Route path="/packages" element={<Packages />} />
      <Route path="/packages/promos" element={<Promo/>} />
      <Route path="/packages/gift-cards" element={<GiftCard />} />
      <Route path="/book/packages/:id" element={<BookPackage />} />
       {/* Add embed route */}
      <Route path="/embed/booking/:packageId" element={
        <div className="container mx-auto p-4">
          <BookingWidget packageId="{packageId}" />
        </div>
      } />
    </Routes>
    </>
  )
}

export default App
