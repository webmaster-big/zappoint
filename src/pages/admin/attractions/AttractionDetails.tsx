import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Trash2,
  MapPin,
  Users,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Tag,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { attractionService } from '../../../services/AttractionService';
import { ASSET_URL } from '../../../utils/storage';
import Toast from '../../../components/ui/Toast';

const AttractionDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [attraction, setAttraction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadAttractionDetails();
  }, [id]);

  const loadAttractionDetails = async () => {
    try {
      setLoading(true);
      const response = await attractionService.getAttraction(Number(id));
      setAttraction(response.data);
    } catch (error) {
      console.error('Error loading attraction details:', error);
      setToast({ message: 'Failed to load attraction details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this attraction? This action cannot be undone.')) {
      try {
        await attractionService.deleteAttraction(Number(id));
        setToast({ message: 'Attraction deleted successfully', type: 'success' });
        setTimeout(() => navigate('/attractions'), 1500);
      } catch (error) {
        console.error('Error deleting attraction:', error);
        setToast({ message: 'Failed to delete attraction', type: 'error' });
      }
    }
  };

  const handleStatusToggle = async () => {
    try {
      if (attraction.is_active) {
        await attractionService.deactivateAttraction(Number(id));
      } else {
        await attractionService.activateAttraction(Number(id));
      }
      setToast({ message: 'Status updated successfully', type: 'success' });
      loadAttractionDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (!attraction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Attraction not found</h2>
          <button
            onClick={() => navigate('/attractions')}
            className={`text-${fullColor} hover:underline`}
          >
            Back to Attractions
          </button>
        </div>
      </div>
    );
  }

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="min-h-screen px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/attractions')}
          className={`flex items-center text-gray-600 hover:text-${fullColor} mb-4 transition-colors`}
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Attractions
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{attraction.name}</h1>
            <p className="text-gray-600 mt-2">{attraction.category}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              attraction.is_active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {attraction.is_active ? 'Active' : 'Inactive'}
            </span>
            <button
              onClick={() => navigate(`/attractions/edit/${id}`)}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          {attraction.image && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
                <ImageIcon className="h-5 w-5 mr-2" />
                Images
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.isArray(attraction.image) ? (
                  attraction.image.map((img: string, index: number) => (
                    <img
                      key={index}
                      src={ASSET_URL + img}
                      alt={`${attraction.name} ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                    />
                  ))
                ) : (
                  <img
                    src={ASSET_URL + attraction.image}
                    alt={attraction.name}
                    className="w-full h-48 object-cover rounded-lg border border-gray-200"
                  />
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
              <FileText className="h-5 w-5 mr-2" />
              Description
            </h2>
            <p className="text-gray-700 leading-relaxed">{attraction.description}</p>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
              <Tag className="h-5 w-5 mr-2" />
              Attraction Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  Category
                </label>
                <p className="text-gray-900 font-medium">{attraction.category}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Price
                </label>
                <p className="text-gray-900 font-medium">
                  ${Number(attraction.price).toFixed(2)}
                  <span className="text-sm text-gray-600 ml-2">
                    ({attraction.pricing_type?.replace('_', ' ')})
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  Max Capacity
                </label>
                <p className="text-gray-900 font-medium">{attraction.max_capacity} people</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  Duration
                </label>
                <p className="text-gray-900 font-medium">
                  {attraction.duration} {attraction.duration_unit || 'minutes'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  Location
                </label>
                <p className="text-gray-900 font-medium">{attraction.location?.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Created
                </label>
                <p className="text-gray-900 font-medium">
                  {new Date(attraction.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
              <Calendar className="h-5 w-5 mr-2" />
              Weekly Availability
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {daysOfWeek.map((day) => {
                const isAvailable = attraction.availability?.[day] !== false;
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isAvailable
                        ? `border-${themeColor}-200 bg-${themeColor}-50`
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium capitalize">{day}</span>
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-lg font-bold text-${fullColor} mb-4`}>Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={handleStatusToggle}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  attraction.is_active
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                }`}
              >
                {attraction.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => navigate(`/attractions/edit/${id}`)}
                className={`w-full py-2 px-4 rounded-lg font-medium bg-${themeColor}-600 text-white hover:bg-${themeColor}-700 transition-colors`}
              >
                Edit Attraction
              </button>
              <button
                onClick={handleDelete}
                className="w-full py-2 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete Attraction
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-lg font-bold text-${fullColor} mb-4`}>Statistics</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price</span>
                <span className="font-medium text-gray-900">${Number(attraction.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Capacity</span>
                <span className="font-medium text-gray-900">{attraction.max_capacity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Duration</span>
                <span className="font-medium text-gray-900">
                  {attraction.duration} {attraction.duration_unit}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-900">Status</span>
                <span className={`font-medium ${
                  attraction.is_active ? `text-${fullColor}` : 'text-gray-500'
                }`}>
                  {attraction.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default AttractionDetails;
