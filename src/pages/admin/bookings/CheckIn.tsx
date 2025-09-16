// src/pages/checkin/CheckIn.tsx
import React, { useState, useEffect, useRef } from 'react';
import MainLayout from '../../../layouts/AdminMainLayout';
import { QrCode, Search, Calendar, CheckCircle, XCircle, Eye } from 'lucide-react';

// Types
interface Booking {
  id: string;
  packageName: string;
  customerName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  participants: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'checked-in';
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  paymentMethod: string;
  attractions: { name: string; quantity: number }[];
  addOns: { name: string; quantity: number; price: number }[];
  duration?: string;
  activity?: string;
  notes?: string;
  checkInTime?: string;
}

const CheckIn: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load bookings from localStorage
  useEffect(() => {
    loadBookings();
  }, []);

  // Filter bookings based on search term and selected date
  useEffect(() => {
    let result = bookings.filter(booking => 
      booking.date === selectedDate && 
      (booking.status === 'confirmed' || booking.status === 'checked-in')
    );

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(booking =>
        booking.customerName.toLowerCase().includes(term) ||
        booking.email.toLowerCase().includes(term) ||
        booking.phone.includes(term) ||
        booking.packageName.toLowerCase().includes(term)
      );
    }

    setFilteredBookings(result);
  }, [bookings, searchTerm, selectedDate]);

  const loadBookings = () => {
    try {
      const storedBookings = localStorage.getItem('zapzone_bookings');
      if (storedBookings) {
        const parsedBookings = JSON.parse(storedBookings);
        setBookings(parsedBookings);
        if (parsedBookings.length === 0) {
          // Add dummy data if empty
          const dummyBookings: Booking[] = [
            {
              id: 'booking_001',
              packageName: 'Birthday Bash',
              customerName: 'Alice Smith',
              email: 'alice@example.com',
              phone: '555-1234',
              date: selectedDate,
              time: '2:00 PM',
              participants: 5,
              status: 'confirmed',
              totalAmount: 150,
              amountPaid: 100,
              createdAt: new Date().toISOString(),
              paymentMethod: 'credit_card',
              attractions: [{ name: 'Bowling', quantity: 1 }],
              addOns: [{ name: 'Extra Cake', quantity: 1, price: 20 }],
              duration: '2 hours',
              activity: 'Bowling',
              notes: 'Allergic to peanuts'
            },
            {
              id: 'booking_002',
              packageName: 'Family Fun',
              customerName: 'Bob Johnson',
              email: 'bob@example.com',
              phone: '555-5678',
              date: selectedDate,
              time: '4:00 PM',
              participants: 3,
              status: 'checked-in',
              totalAmount: 90,
              amountPaid: 90,
              createdAt: new Date().toISOString(),
              paymentMethod: 'cash',
              attractions: [{ name: 'Laser Tag', quantity: 2 }],
              addOns: [],
              duration: '1 hour',
              activity: 'Laser Tag',
              notes: 'Birthday celebration',
              checkInTime: new Date().toISOString()
            }
          ];
          setBookings(dummyBookings);
          localStorage.setItem('zapzone_bookings', JSON.stringify(dummyBookings));
        }
      } else {
        // If no bookings at all, add dummy data
        const dummyBookings: Booking[] = [
          {
            id: 'booking_001',
            packageName: 'Birthday Bash',
            customerName: 'Alice Smith',
            email: 'alice@example.com',
            phone: '555-1234',
            date: selectedDate,
            time: '2:00 PM',
            participants: 5,
            status: 'confirmed',
            totalAmount: 150,
            amountPaid: 100,
            createdAt: new Date().toISOString(),
            paymentMethod: 'credit_card',
            attractions: [{ name: 'Bowling', quantity: 1 }],
            addOns: [{ name: 'Extra Cake', quantity: 1, price: 20 }],
            duration: '2 hours',
            activity: 'Bowling',
            notes: 'Allergic to peanuts'
          },
          {
            id: 'booking_002',
            packageName: 'Family Fun',
            customerName: 'Bob Johnson',
            email: 'bob@example.com',
            phone: '555-5678',
            date: selectedDate,
            time: '4:00 PM',
            participants: 3,
            status: 'checked-in',
            totalAmount: 90,
            amountPaid: 90,
            createdAt: new Date().toISOString(),
            paymentMethod: 'cash',
            attractions: [{ name: 'Laser Tag', quantity: 2 }],
            addOns: [],
            duration: '1 hour',
            activity: 'Laser Tag',
            notes: 'Birthday celebration',
            checkInTime: new Date().toISOString()
          }
        ];
        setBookings(dummyBookings);
        localStorage.setItem('zapzone_bookings', JSON.stringify(dummyBookings));
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  const startScanning = async () => {
    setScanning(true);
    setScannedData(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setScanning(false);
    }
  };

  const stopScanning = () => {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleScan = () => {
    // Simulate QR code scanning for demo purposes
    // In a real app, you would use a library like jsQR to decode the QR code
    const simulatedData = `booking_${Date.now()}`;
    setScannedData(simulatedData);
    
    // Find the booking with this ID
    const booking = bookings.find(b => b.id === simulatedData);
    if (booking) {
      handleCheckIn(booking);
    } else {
      // For demo, just use the first booking
      if (bookings.length > 0) {
        handleCheckIn(bookings[0]);
      }
    }
    
    stopScanning();
  };

  const handleCheckIn = (booking: Booking) => {
    const updatedBookings = bookings.map(b => 
      b.id === booking.id 
        ? { 
            ...b, 
            status: 'checked-in' as const,
            checkInTime: new Date().toISOString()
          }
        : b
    );
    
    setBookings(updatedBookings);
    localStorage.setItem('zapzone_bookings', JSON.stringify(updatedBookings));
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const manualCheckIn = (booking: Booking) => {
    handleCheckIn(booking);
  };

  const viewDetails = (booking: Booking) => {
    // If scannedData is present, use it to find the booking
    if (scannedData) {
      const scannedBooking = bookings.find(b => b.id === scannedData);
      setSelectedBooking(scannedBooking || booking);
    } else {
      const latestBooking = bookings.find(b => b.id === booking.id) || booking;
      setSelectedBooking(latestBooking);
    }
    setShowDetailsModal(true);
  };

  const closeModal = () => {
    setShowDetailsModal(false);
    setSelectedBooking(null);
  };

  const formatTime = (timeString: string) => {
    return timeString; // Assuming time is already in a readable format
  };

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">On-site Check-in</h1>
            <p className="text-gray-600 mt-2">Check in customers using QR codes or manual search</p>
          </div>
          <button
            onClick={scanning ? stopScanning : startScanning}
            className={`mt-4 sm:mt-0 flex items-center px-4 py-2 rounded-lg ${
              scanning 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <QrCode className="h-5 w-5 mr-2" />
            {scanning ? 'Stop Scanning' : 'Start QR Scan'}
          </button>
        </div>

        {/* QR Scanner */}
        {scanning && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">QR Code Scanner</h2>
            <p className="text-sm text-purple-700 bg-purple-50 rounded px-3 py-2 mb-4">
              For best results, use a mobile device or tablet with a camera for scanning QR codes. Desktop webcams may not focus well on QR codes.
            </p>
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 bg-gray-200 rounded-lg object-cover"
                autoPlay
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-purple-500 rounded-lg w-64 h-64"></div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-gray-600 mb-4">Position the QR code within the frame</p>
              <button
                onClick={handleScan}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
              >
                Simulate Scan (Demo)
              </button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline mr-2 h-4 w-4" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="inline mr-2 h-4 w-4" />
                Search Bookings
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or package..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-purple-400"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Package
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No bookings found for selected date
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{booking.customerName}</div>
                        <div className="text-xs text-gray-500">Email: {booking.email}</div>
                        <div className="text-xs text-gray-500">Phone: {booking.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{booking.packageName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatTime(booking.time)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.participants}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'confirmed' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : booking.status === 'checked-in'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status === 'checked-in' ? 'Checked In' : booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {booking.status === 'confirmed' && (
                            <button
                              onClick={() => manualCheckIn(booking)}
                              className="text-green-600 hover:text-green-800 flex items-center"
                              title="Check In"
                            >
                              <CheckCircle className="h-5 w-5 mr-1" />
                              Check In
                            </button>
                          )}
                          <button
                            onClick={() => viewDetails(booking)}
                            className="text-purple-600 hover:text-purple-800 flex items-center"
                            title="View Details"
                          >
                            <Eye className="h-5 w-5 mr-1" />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Booking Details Modal */}
        {showDetailsModal && selectedBooking && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Booking Details</h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                {scannedData && (
                  <div className="mb-4">
                    <span className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1">Scanned Booking ID: {scannedData}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Customer Details</h4>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Name:</span> {selectedBooking.customerName || <span className="text-gray-400">N/A</span>}</p>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Email:</span> {selectedBooking.email || <span className="text-gray-400">N/A</span>}</p>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Phone:</span> {selectedBooking.phone || <span className="text-gray-400">N/A</span>}</p>
                    {selectedBooking.activity && (
                      <p className="text-sm text-gray-600"><span className="font-semibold">Activity:</span> {selectedBooking.activity}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Booking Details</h4>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Package:</span> {selectedBooking.packageName}</p>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Date:</span> {new Date(selectedBooking.date).toLocaleDateString()} at {formatTime(selectedBooking.time)}</p>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Participants:</span> {selectedBooking.participants}</p>
                    {selectedBooking.duration && (
                      <p className="text-sm text-gray-600"><span className="font-semibold">Duration:</span> {selectedBooking.duration}</p>
                    )}
                  </div>
                </div>
                
                {selectedBooking.attractions.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900">Attractions</h4>
                    <ul className="text-sm text-gray-600">
                      {selectedBooking.attractions.map((attraction, index) => (
                        <li key={index}>• {attraction.name} (x{attraction.quantity})</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedBooking.addOns.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900">Add-ons</h4>
                    <ul className="text-sm text-gray-600">
                      {selectedBooking.addOns.map((addOn, index) => (
                        <li key={index}>• {addOn.name} (x{addOn.quantity}) - ${addOn.price}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Payment</h4>
                    <p className="text-sm text-gray-600">
                      {selectedBooking.paymentMethod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-sm text-gray-600">Total: ${selectedBooking.totalAmount.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Paid: ${selectedBooking.amountPaid.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Status</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      selectedBooking.status === 'confirmed' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : selectedBooking.status === 'checked-in'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedBooking.status === 'checked-in' ? 'Checked In' : selectedBooking.status}
                    </span>
                    {selectedBooking.checkInTime && (
                      <p className="text-sm text-gray-600 mt-2">
                        Check-in time: {new Date(selectedBooking.checkInTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                
                {selectedBooking.notes && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900">Notes</h4>
                    <p className="text-sm text-gray-600">{selectedBooking.notes}</p>
                  </div>
                )}
                
                <div className="flex justify-end mt-6">
                  {selectedBooking.status === 'confirmed' && (
                    <button
                      onClick={() => {
                        handleCheckIn(selectedBooking);
                        closeModal();
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 mr-2"
                    >
                      Check In
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CheckIn;