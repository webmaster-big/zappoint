import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Trash2,
  Calendar, 
  Users, 
  Tag, 
  MapPin, 
  Clock,
  DollarSign,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { packageService, type Package } from '../../../services';
import Toast from '../../../components/ui/Toast';

const PackageDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [packageData, setPackageData] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadPackageDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPackageDetails = async () => {
    try {
      setLoading(true);
      const response = await packageService.getPackage(parseInt(id!));
      console.log(response);
      setPackageData(response.data);
    } catch (error) {
      console.error('Error loading package details:', error);
      setToast({ message: 'Failed to load package details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
      try {
        await packageService.deletePackage(packageData!.id);
        setToast({ message: 'Package deleted successfully', type: 'success' });
        setTimeout(() => navigate('/packages'), 1500);
      } catch (error) {
        console.error('Error deleting package:', error);
        setToast({ message: 'Failed to delete package', type: 'error' });
      }
    }
  };

  const formatAvailability = (pkg: Package) => {
    if (!pkg.availability_type) return "Not specified";
    
    if (pkg.availability_type === "daily") {
      if (!pkg.available_days || pkg.available_days.length === 0) return "No days selected";
      if (pkg.available_days.length === 7) return "Every day";
      return pkg.available_days.map((day) => String(day).substring(0, 3)).join(", ");
    } else if (pkg.availability_type === "weekly") {
      if (!pkg.available_week_days || pkg.available_week_days.length === 0) return "No days selected";
      return pkg.available_week_days.map((day) => `Every ${day}`).join(", ");
    } else if (pkg.availability_type === "monthly") {
      if (!pkg.available_month_days || pkg.available_month_days.length === 0) return "No days selected";
      return pkg.available_month_days.map((day) => {
        const dayStr = String(day);
        if (dayStr === "last") return "Last day of month";
        const suffix = dayStr === "1" ? "st" : dayStr === "2" ? "nd" : dayStr === "3" ? "rd" : "th";
        return `${dayStr}${suffix}`;
      }).join(", ");
    }
    return "Not specified";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Package not found</h2>
          <button
            onClick={() => navigate('/packages')}
            className={`text-${fullColor} hover:underline`}
          >
            Back to Packages
          </button>
        </div>
      </div>
    );
  }

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/packages')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{packageData.name}</h1>
            <p className="text-gray-600 mt-2">{packageData.category || "No category"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              packageData.is_active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {packageData.is_active ? 'Active' : 'Inactive'}
            </span>
            <button
              onClick={() => navigate(`/packages/edit/${id}`)}
              className={`flex items-center px-4 py-2 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700 transition-colors`}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Description */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-700 leading-relaxed">
              {packageData.description || "No description provided"}
            </p>
          </div>

          {/* Features */}
          {packageData.features && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Features</h2>
              <p className="text-gray-700 leading-relaxed">{packageData.features}</p>
            </div>
          )}

          {/* Package Details */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Package Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <Tag className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{packageData.category || "No category"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Base Price</p>
                  <p className="font-medium text-gray-900">${Number(packageData.price).toFixed(2)}</p>
                </div>
              </div>
              {packageData.price_per_additional && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Price Per Additional</p>
                    <p className="font-medium text-gray-900">${Number(packageData.price_per_additional).toFixed(2)}</p>
                  </div>
                </div>
              )}
              {packageData.max_participants && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <Users className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Max Participants</p>
                    <p className="font-medium text-gray-900">{packageData.max_participants} people</p>
                  </div>
                </div>
              )}
              {packageData.duration && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <Clock className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-medium text-gray-900">
                      {packageData.duration} {packageData.duration_unit || 'hours'}
                    </p>
                  </div>
                </div>
              )}
              {packageData.location && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <MapPin className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-900">{packageData.location.name}</p>
                  </div>
                </div>
              )}
              {packageData.created_at && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <Calendar className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium text-gray-900">
                      {new Date(packageData.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Availability */}
          {packageData.availability_type === 'daily' && packageData.available_days && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Weekly Availability</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {daysOfWeek.map((day) => {
                  const isAvailable = packageData.available_days?.includes(day as never);
                  return (
                    <div
                      key={day}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isAvailable
                          ? `border-${themeColor}-200 bg-${themeColor}-50`
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <span className="text-sm font-medium capitalize">{day.substring(0, 3)}</span>
                      {isAvailable ? (
                        <CheckCircle className={`h-4 w-4 text-${fullColor}`} />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other Availability Types */}
          {packageData.availability_type !== 'daily' && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Availability</h2>
              <p className="text-gray-700">{formatAvailability(packageData)}</p>
            </div>
          )}

          {/* Rooms */}
          {packageData.rooms && packageData.rooms.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Rooms</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packageData.rooms.map((room: string | { name?: string; capacity?: number }, idx: number) => {
                  const roomObj = typeof room === 'string' ? { name: room } : room;
                  return (
                    <div key={idx} className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                      <div className="flex justify-between items-start">
                        <p className="text-gray-900 font-medium">{roomObj.name || String(room)}</p>
                        {roomObj.capacity && (
                          <span className="text-indigo-700 text-sm font-semibold">
                            <Users className="w-4 h-4 inline mr-1" />
                            {roomObj.capacity}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attractions */}
          {packageData.attractions && packageData.attractions.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Included Attractions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packageData.attractions.map((attraction: string | { name?: string; price?: number }, idx: number) => {
                  const attractionObj = typeof attraction === 'string' ? { name: attraction } : attraction;
                  return (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <p className="text-gray-900 font-medium">
                          {attractionObj.name || String(attraction)}
                        </p>
                        {attractionObj.price && (
                          <span className="text-gray-700 text-sm font-semibold">${attractionObj.price}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {packageData.add_ons && packageData.add_ons.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Add-ons</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packageData.add_ons.map((addon: string | { name?: string; price?: number }, idx: number) => {
                  const addonObj = typeof addon === 'string' ? { name: addon } : addon;
                  return (
                    <div key={idx} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex justify-between items-start">
                        <p className="text-gray-900 font-medium">{addonObj.name || String(addon)}</p>
                        {addonObj.price && (
                          <span className="text-blue-700 font-semibold">${addonObj.price}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Promos */}
          {packageData.promos && packageData.promos.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Promotions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packageData.promos.map((promo: string | { name?: string; code?: string }, idx: number) => {
                  const promoObj = typeof promo === 'string' ? { name: promo } : promo;
                  return (
                    <div key={idx} className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-gray-900 font-medium">{promoObj.name || promoObj.code || String(promo)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gift Cards */}
          {packageData.gift_cards && packageData.gift_cards.length > 0 && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Applicable Gift Cards</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packageData.gift_cards.map((giftCard: string | { code?: string }, idx: number) => {
                  const cardObj = typeof giftCard === 'string' ? { code: giftCard } : giftCard;
                  return (
                    <div key={idx} className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <p className="text-gray-900 font-medium">{cardObj.code || String(giftCard)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PackageDetails;
