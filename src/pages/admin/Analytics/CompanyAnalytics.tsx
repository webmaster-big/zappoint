import { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Users,
  DollarSign,
  Package,
  Ticket,
  MapPin,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { Booking } from '../../../types/booking';

// // Interface Definitions
// interface Booking {
//   id: string;
//   date: string;
//   package: string;
//   participants: number;
//   amount: number;
//   status: 'Confirmed' | 'Pending' | 'Cancelled';
//   location: string;
// }

interface TicketPurchase {
  id: string;
  date: string;
  attraction: string;
  quantity: number;
  amount: number;
  status: 'Completed' | 'Pending' | 'Cancelled';
  location: string;
}

interface LocationData {
  bookings: Booking[];
  ticketPurchases: TicketPurchase[];
}

interface LocationMetrics {
  revenue: number;
  bookings: number;
  tickets: number;
  participants: number;
}

interface Metrics {
  totalRevenue: number;
  totalBookings: number;
  totalTickets: number;
  totalParticipants: number;
  locationMetrics: Record<string, LocationMetrics>;
  packageRevenue: Record<string, number>;
  attractionRevenue: Record<string, number>;
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: 'up' | 'down';
}

const CompanyAnalytics: React.FC<null> = () => {
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [reportType, setReportType] = useState<string>('overview');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [data, setData] = useState<Record<string, LocationData> | null>(null);

  const locations: string[] = [
    'Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 
    'Waterford', 'Sterling Heights', 'Battle Creek', 'Ypsilanti', 'Escape Room Zone'
  ];

  // Initialize or load data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('zapzone_analytics_data');
    if (savedData) {
      setData(JSON.parse(savedData));
    } else {
      // Generate sample data if none exists
      const sampleData = generateSampleData();
      setData(sampleData);
      localStorage.setItem('zapzone_analytics_data', JSON.stringify(sampleData));
    }
  }, []);

  // Generate comprehensive sample data
  const generateSampleData = (): Record<string, LocationData> => {
    const packages: string[] = ['Adventure Package', 'Birthday Package', 'Corporate Package', 'Family Package', 'Group Package'];
    const attractions: string[] = ['Laser Tag', 'Bowling', 'VR Experience', 'Arcade', 'Escape Room', 'Mini Golf'];
    
    const locationData: Record<string, LocationData> = {};
    const today = new Date();
    
    locations.forEach(location => {
      // Bookings data
      const bookings: Booking[] = Array.from({ length: 50 }, (_, i) => {
        const date = new Date();
        date.setDate(today.getDate() - Math.floor(Math.random() * 30));
        return {
          id: `booking_${location}_${i}`,
          date: date.toISOString(),
          package: packages[Math.floor(Math.random() * packages.length)],
          participants: Math.floor(Math.random() * 20) + 2,
          amount: Math.floor(Math.random() * 500) + 50,
          status: ['Confirmed', 'Pending', 'Cancelled'][Math.floor(Math.random() * 3)] as 'Confirmed' | 'Pending' | 'Cancelled',
          location
        };
      });

      // Ticket purchases data
      const ticketPurchases: TicketPurchase[] = Array.from({ length: 100 }, (_, i) => {
        const date = new Date();
        date.setDate(today.getDate() - Math.floor(Math.random() * 30));
        return {
          id: `ticket_${location}_${i}`,
          date: date.toISOString(),
          attraction: attractions[Math.floor(Math.random() * attractions.length)],
          quantity: Math.floor(Math.random() * 6) + 1,
          amount: Math.floor(Math.random() * 100) + 10,
          status: ['Completed', 'Pending', 'Cancelled'][Math.floor(Math.random() * 3)] as 'Completed' | 'Pending' | 'Cancelled',
          location
        };
      });

      locationData[location] = { bookings, ticketPurchases };
    });

    return locationData;
  };

  // Filter data based on selected time range and locations
  const getFilteredData = (): Record<string, LocationData> | null => {
    if (!data) return null;

    const filteredData: Record<string, LocationData> = {};
    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const selectedLocs = selectedLocations.length > 0 ? selectedLocations : locations;

    selectedLocs.forEach(location => {
      const locationData = data[location];
      if (locationData) {
        filteredData[location] = {
          bookings: locationData.bookings.filter((booking: Booking) => 
            new Date(booking.date) >= cutoffDate
          ),
          ticketPurchases: locationData.ticketPurchases.filter((ticket: TicketPurchase) =>
            new Date(ticket.date) >= cutoffDate
          )
        };
      }
    });

    return filteredData;
  };

  const filteredData = getFilteredData();

  // Calculate metrics
  const calculateMetrics = (): Metrics | null => {
    if (!filteredData) return null;

    let totalRevenue = 0;
    let totalBookings = 0;
    let totalTickets = 0;
    let totalParticipants = 0;
    const locationMetrics: Record<string, LocationMetrics> = {};
    const packageRevenue: Record<string, number> = {};
    const attractionRevenue: Record<string, number> = {};

    Object.entries(filteredData).forEach(([location, locationData]: [string, LocationData]) => {
      const locationBookings = locationData.bookings.length;
      const locationTickets = locationData.ticketPurchases.length;
      const locationRevenue = 
        locationData.bookings.reduce((sum: number, b: Booking) => sum + b.totalAmount, 0) +
        locationData.ticketPurchases.reduce((sum: number, t: TicketPurchase) => sum + t.amount, 0);
      const locationParticipants = locationData.bookings.reduce((sum: number, b: Booking) => sum + b.participants, 0);

      totalRevenue += locationRevenue;
      totalBookings += locationBookings;
      totalTickets += locationTickets;
      totalParticipants += locationParticipants;

      locationMetrics[location] = {
        revenue: locationRevenue,
        bookings: locationBookings,
        tickets: locationTickets,
        participants: locationParticipants
      };

      // Package revenue breakdown
      locationData.bookings.forEach((booking: Booking) => {
        packageRevenue[booking.packageName] = (packageRevenue[booking.packageName] || 0) + booking.totalAmount;
      });

      // Attraction revenue breakdown
      locationData.ticketPurchases.forEach((ticket: TicketPurchase) => {
        attractionRevenue[ticket.attraction] = (attractionRevenue[ticket.attraction] || 0) + ticket.amount;
      });
    });

    return {
      totalRevenue,
      totalBookings,
      totalTickets,
      totalParticipants,
      locationMetrics,
      packageRevenue,
      attractionRevenue
    };
  };

  const metrics = calculateMetrics();

  // Generate PDF Report
  const generatePDFReport = async (): Promise<void> => {
    setIsGenerating(true);
    
    // Simulate PDF generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a simple PDF-like download
    const reportData = {
      generatedAt: new Date().toLocaleString(),
      timeRange,
      locations: selectedLocations.length > 0 ? selectedLocations : locations,
      metrics,
      filteredData
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zapzone-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsGenerating(false);
  };

  // Toggle location selection
  const toggleLocation = (location: string): void => {
    setSelectedLocations(prev =>
      prev.includes(location)
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  // Quick metrics cards
  const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon: Icon, trend }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm flex items-center mt-1 ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span className="ml-1">{change}</span>
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-100 rounded-lg">
          <Icon size={24} className="text-blue-800" />
        </div>
      </div>
    </div>
  );

  if (!data || !metrics) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-800" />
                Analytics & Reports
              </h1>
              <p className="text-gray-600 mt-2">Comprehensive insights across all locations</p>
            </div>
            <button
              onClick={generatePDFReport}
              disabled={isGenerating}
              className="mt-4 md:mt-0 px-6 py-3 bg-blue-800 text-white rounded-xl hover:bg-blue-900 transition flex items-center gap-2 disabled:opacity-50"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 365 days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
              >
                <option value="overview">Overview</option>
                <option value="bookings">Bookings Analysis</option>
                <option value="tickets">Ticket Sales</option>
                <option value="locations">Location Performance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Actions</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedLocations([])}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  All Locations
                </button>
                <button
                  onClick={() => setSelectedLocations(['Escape Room Zone'])}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Escape Rooms Only
                </button>
              </div>
            </div>
          </div>

          {/* Location Filter */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
              <MapPin size={16} className="mr-2" />
              Filter Locations
            </label>
            <div className="flex flex-wrap gap-2">
              {locations.map(location => (
                <button
                  key={location}
                  onClick={() => toggleLocation(location)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedLocations.includes(location)
                      ? 'bg-blue-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            change="+12.5%"
            trend="up"
            icon={DollarSign}
          />
          <MetricCard
            title="Package Bookings"
            value={metrics.totalBookings.toLocaleString()}
            change="+8.2%"
            trend="up"
            icon={Package}
          />
          <MetricCard
            title="Ticket Sales"
            value={metrics.totalTickets.toLocaleString()}
            change="+15.3%"
            trend="up"
            icon={Ticket}
          />
          <MetricCard
            title="Total Participants"
            value={metrics.totalParticipants.toLocaleString()}
            change="+10.7%"
            trend="up"
            icon={Users}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Location Performance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Location Revenue Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 text-blue-800 mr-2" />
                Location Revenue Performance
              </h3>
              <div className="space-y-4">
                {Object.entries(metrics.locationMetrics)
                  .sort(([,a], [,b]) => (b as LocationMetrics).revenue - (a as LocationMetrics).revenue)
                  .map(([location, locationMetrics]: [string, LocationMetrics]) => (
                    <div key={location} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <MapPin size={16} className="text-blue-800" />
                        <span className="font-medium text-gray-900">{location}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">${locationMetrics.revenue.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">
                          {locationMetrics.bookings} bookings • {locationMetrics.tickets} tickets
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Package Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Package className="w-5 h-5 text-blue-800 mr-2" />
                Package Performance
              </h3>
              <div className="space-y-3">
                {Object.entries(metrics.packageRevenue)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .map(([pkg, revenue]) => (
                    <div key={pkg} className="flex justify-between items-center">
                      <span className="text-gray-700">{pkg}</span>
                      <span className="font-semibold text-blue-800">${(revenue as number).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Attraction Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Ticket className="w-5 h-5 text-blue-800 mr-2" />
                Top Attractions
              </h3>
              <div className="space-y-3">
                {Object.entries(metrics.attractionRevenue)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .slice(0, 5)
                  .map(([attraction, revenue]) => (
                    <div key={attraction} className="flex justify-between items-center">
                      <span className="text-gray-700">{attraction}</span>
                      <span className="font-semibold text-blue-800">${(revenue as number).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 text-blue-800 mr-2" />
                Performance Highlights
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-green-800">Best Performing Location</span>
                  <span className="font-semibold">Brighton</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-blue-800">Most Popular Package</span>
                  <span className="font-semibold">Corporate Package</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                  <span className="text-purple-800">Top Attraction</span>
                  <span className="font-semibold">Laser Tag</span>
                </div>
              </div>
            </div>

            {/* Report Summary */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Report Summary</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <div>Time Period: {timeRange} days</div>
                <div>Locations: {selectedLocations.length || 'All'} locations</div>
                <div>Total Data Points: {(metrics.totalBookings + metrics.totalTickets).toLocaleString()}</div>
                <div>Generated: {new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyAnalytics;