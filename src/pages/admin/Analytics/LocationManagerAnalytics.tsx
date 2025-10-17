import { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  DollarSign,
  Package,
  Ticket,
  MapPin,
  Star,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type {
  LocationManagerAnalyticsBooking,
  LocationManagerAnalyticsTicketPurchase,
  LocationManagerAnalyticsData,
  LocationManagerAnalyticsMetrics,
  LocationManagerAnalyticsMetricCardProps,
} from '../../../types/LocationManagerAnalytics.types';

const LocationAnalytics = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [reportType, setReportType] = useState<string>('overview');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [data, setData] = useState<LocationManagerAnalyticsData | null>(null);

  const location = 'Brighton';
  const packages = ['Adventure Package', 'Birthday Package', 'Corporate Package', 'Family Package', 'Group Package'];
  const attractions = ['Laser Tag', 'Bowling', 'VR Experience', 'Arcade', 'Escape Room', 'Mini Golf'];

  // Initialize or load data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem(`zapzone_analytics_${location}`);
    if (savedData) {
      setData(JSON.parse(savedData));
    } else {
      const sampleData = generateBrightonData();
      setData(sampleData);
      localStorage.setItem(`zapzone_analytics_${location}`, JSON.stringify(sampleData));
    }
  }, []);

  // Generate Brighton-specific sample data
  const generateBrightonData = (): LocationManagerAnalyticsData => {
    const today = new Date();
    
    // Bookings data for Brighton
    const bookings: LocationManagerAnalyticsBooking[] = Array.from({ length: 85 }, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - Math.floor(Math.random() * 30));
      return {
        id: `booking_brighton_${i}`,
        date: date.toISOString(),
        package: packages[Math.floor(Math.random() * packages.length)],
        participants: Math.floor(Math.random() * 20) + 2,
        amount: Math.floor(Math.random() * 500) + 50,
        status: ['Confirmed', 'Pending', 'Cancelled'][Math.floor(Math.random() * 3)] as 'Confirmed' | 'Pending' | 'Cancelled',
        location: 'Brighton',
        customer: `Customer ${i + 1}`,
        duration: `${Math.floor(Math.random() * 4) + 1} hours`
      };
    });

    // Ticket purchases data for Brighton
    const ticketPurchases: LocationManagerAnalyticsTicketPurchase[] = Array.from({ length: 120 }, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - Math.floor(Math.random() * 30));
      const attraction = attractions[Math.floor(Math.random() * attractions.length)];
      return {
        id: `ticket_brighton_${i}`,
        date: date.toISOString(),
        attraction: attraction,
        quantity: Math.floor(Math.random() * 6) + 1,
        amount: Math.floor(Math.random() * 100) + 10,
        status: ['Completed', 'Pending', 'Cancelled'][Math.floor(Math.random() * 3)] as 'Completed' | 'Pending' | 'Cancelled',
        location: 'Brighton',
        customer: `Customer ${i + 1}`,
        timeSlot: ['Morning', 'Afternoon', 'Evening'][Math.floor(Math.random() * 3)] as 'Morning' | 'Afternoon' | 'Evening'
      };
    });

    return { bookings, ticketPurchases };
  };

  // Filter data based on selected time range
  const getFilteredData = (): LocationManagerAnalyticsData | null => {
    if (!data) return null;

    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filteredBookings = data.bookings.filter((booking: LocationManagerAnalyticsBooking) => 
      new Date(booking.date) >= cutoffDate
    );

    const filteredTickets = data.ticketPurchases.filter((ticket: LocationManagerAnalyticsTicketPurchase) =>
      new Date(ticket.date) >= cutoffDate
    );

    return { bookings: filteredBookings, ticketPurchases: filteredTickets };
  };

  const filteredData = getFilteredData();

  // Calculate Brighton-specific metrics
  const calculateMetrics = (): LocationManagerAnalyticsMetrics | null => {
    if (!filteredData) return null;

    const totalRevenue = 
      filteredData.bookings.reduce((sum: number, b: LocationManagerAnalyticsBooking) => sum + b.amount, 0) +
      filteredData.ticketPurchases.reduce((sum: number, t: LocationManagerAnalyticsTicketPurchase) => sum + t.amount, 0);

    const totalBookings = filteredData.bookings.length;
    const totalTickets = filteredData.ticketPurchases.length;
    const totalParticipants = filteredData.bookings.reduce((sum: number, b: LocationManagerAnalyticsBooking) => sum + b.participants, 0);

    // Package revenue breakdown
    const packageRevenue: Record<string, number> = {};
    filteredData.bookings.forEach((booking: LocationManagerAnalyticsBooking) => {
      packageRevenue[booking.package] = (packageRevenue[booking.package] || 0) + booking.amount;
    });

    // Attraction revenue breakdown
    const attractionRevenue: Record<string, number> = {};
    filteredData.ticketPurchases.forEach((ticket: LocationManagerAnalyticsTicketPurchase) => {
      attractionRevenue[ticket.attraction] = (attractionRevenue[ticket.attraction] || 0) + ticket.amount;
    });

    // Time slot analysis
    const timeSlotRevenue = { Morning: 0, Afternoon: 0, Evening: 0 };
    filteredData.ticketPurchases.forEach((ticket: LocationManagerAnalyticsTicketPurchase) => {
      timeSlotRevenue[ticket.timeSlot] += ticket.amount;
    });

    // Popular attractions by quantity
    const attractionPopularity: Record<string, number> = {};
    filteredData.ticketPurchases.forEach((ticket: LocationManagerAnalyticsTicketPurchase) => {
      attractionPopularity[ticket.attraction] = (attractionPopularity[ticket.attraction] || 0) + ticket.quantity;
    });

    // Booking status breakdown
    const bookingStatus: Record<string, number> = {};
    filteredData.bookings.forEach((booking: LocationManagerAnalyticsBooking) => {
      bookingStatus[booking.status] = (bookingStatus[booking.status] || 0) + 1;
    });

    return {
      totalRevenue,
      totalBookings,
      totalTickets,
      totalParticipants,
      packageRevenue,
      attractionRevenue,
      timeSlotRevenue,
      attractionPopularity,
      bookingStatus,
      avgBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      occupancyRate: Math.min(100, Math.round((totalParticipants / 2000) * 100)) // Assuming capacity of 2000
    };
  };

  const metrics = calculateMetrics();

  // Generate PDF Report for Brighton
  const generatePDFReport = async (): Promise<void> => {
    setIsGenerating(true);
    
    // Simulate PDF generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const reportData = {
      location: 'Brighton',
      generatedAt: new Date().toLocaleString(),
      timeRange: `${timeRange} days`,
      metrics,
      summary: `Brighton Location Performance Report - Last ${timeRange} days`
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brighton-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsGenerating(false);
  };

  // Quick metrics cards
  const MetricCard = ({ title, value, icon: Icon, subtitle }: LocationManagerAnalyticsMetricCardProps) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
         
        </div>
        <div className={`p-3 bg-${themeColor}-100 rounded-lg`}>
          <Icon size={24} className={`text-${fullColor}`} />
        </div>
      </div>
    </div>
  );

  if (!data || !metrics) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading Brighton Analytics...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
             
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                   Analytics $ Reports
                </h1>
                <p className="text-gray-600 mt-2 flex items-center">
                  <MapPin size={16} className={`mr-2 text-${fullColor}`} />
                  456 Entertainment Avenue, Brighton, MI 48116
                </p>
              </div>
            </div>
            <button
              onClick={generatePDFReport}
              disabled={isGenerating}
              className={`px-6 py-3 bg-${fullColor} text-white rounded-xl hover:bg-${themeColor}-900 transition flex items-center gap-2 disabled:opacity-50`}
            >
              <Download size={20} />
              {isGenerating ? 'Generating Report...' : 'Export Report'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Calendar size={16} className="mr-2" />
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${fullColor} focus:border-${fullColor}`}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 365 days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <BarChart3 size={16} className="mr-2" />
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${fullColor} focus:border-${fullColor}`}
              >
                <option value="overview">Overview</option>
                <option value="bookings">Bookings Analysis</option>
                <option value="tickets">Ticket Sales</option>
                <option value="performance">Performance Deep Dive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Stats</label>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Star size={16} className="text-yellow-500 mr-1" />
                  Rating: 4.8/5
                </div>
                <div className="flex items-center">
                  <Users size={16} className={`text-${themeColor}-600 mr-1`} />
                  Capacity: {metrics.occupancyRate}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            subtitle="From bookings & tickets"
          />
          <MetricCard
            title="Package Bookings"
            value={metrics.totalBookings.toLocaleString()}
            icon={Package}
            subtitle={`${metrics.totalParticipants} participants`}
          />
          <MetricCard
            title="Ticket Sales"
            value={metrics.totalTickets.toLocaleString()}
            icon={Ticket}
            subtitle="Individual attractions"
          />
          <MetricCard
            title="Occupancy Rate"
            value={`${metrics.occupancyRate}%`}
            icon={Users}
            subtitle="Capacity utilization"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Performance Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Package Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Package className={`w-5 h-5 text-${fullColor} mr-2`} />
                Package Performance
              </h3>
              <div className="space-y-4">
                {Object.entries(metrics.packageRevenue)
                  .sort(([,a], [,b]) => b - a)
                  .map(([pkg, revenue]) => (
                    <div key={pkg} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 bg-${themeColor}-600 rounded-full`}></div>
                        <span className="font-medium text-gray-900">{pkg}</span>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-${fullColor}`}>${revenue.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">
                          {Math.round((revenue / metrics.totalRevenue) * 100)}% of revenue
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Attraction Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Ticket className={`w-5 h-5 text-${fullColor} mr-2`} />
                Attraction Performance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">By Revenue</h4>
                  <div className="space-y-3">
                    {Object.entries(metrics.attractionRevenue)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 3)
                      .map(([attraction, revenue]) => (
                        <div key={attraction} className="flex justify-between items-center">
                          <span className="text-gray-700">{attraction}</span>
                          <span className={`font-semibold text-${fullColor}`}>${revenue.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">By Popularity</h4>
                  <div className="space-y-3">
                    {Object.entries(metrics.attractionPopularity)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 3)
                      .map(([attraction, count]) => (
                        <div key={attraction} className="flex justify-between items-center">
                          <span className="text-gray-700">{attraction}</span>
                          <span className="font-semibold text-green-600">{count} tickets</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Insights & Details */}
          <div className="space-y-6">
            {/* Time Slot Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Time Slot Performance
              </h3>
              <div className="space-y-3">
                {Object.entries(metrics.timeSlotRevenue).map(([slot, revenue]) => (
                  <div key={slot} className={`flex justify-between items-center p-2 bg-${themeColor}-50 rounded`}>
                    <span className={`text-${fullColor} font-medium`}>{slot}</span>
                    <span className={`font-bold text-${fullColor}`}>${revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Booking Status
              </h3>
              <div className="space-y-3">
                {Object.entries(metrics.bookingStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className={`px-2 py-1 rounded text-sm ${
                      status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                      status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {status}
                    </span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Highlights */}
            <div className={`bg-${themeColor}-50 rounded-xl border border-${themeColor}-200 p-6`}>
              <h3 className={`text-lg font-semibold text-${themeColor}-900 mb-3 flex items-center`}>
                Highlights
              </h3>
              <div className={`space-y-2 text-sm text-${fullColor}`}>
                <div className="flex justify-between">
                  <span>Avg Booking Value:</span>
                  <span className="font-semibold">${metrics.avgBookingValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Participants:</span>
                  <span className="font-semibold">{metrics.totalParticipants.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Conversion Rate:</span>
                  <span className="font-semibold">68%</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak Hours:</span>
                  <span className="font-semibold">4PM-7PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationAnalytics;