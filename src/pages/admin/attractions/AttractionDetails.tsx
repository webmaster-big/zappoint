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
  Tag
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/attractions')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          </div>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Images */}
          {attraction.image && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Images</h2>
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
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-700 leading-relaxed">{attraction.description}</p>
          </div>

          {/* Details */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Attraction Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <Tag className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{attraction.category}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Price</p>
                  <p className="font-medium text-gray-900">
                    ${Number(attraction.price).toFixed(2)}
                    <span className="text-sm text-gray-600 ml-2">
                      ({attraction.pricing_type?.replace('_', ' ')})
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <Users className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Max Capacity</p>
                  <p className="font-medium text-gray-900">{attraction.max_capacity} people</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <Clock className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium text-gray-900">
                    {attraction.duration} {attraction.duration_unit || 'minutes'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <MapPin className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-900">{attraction.location?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <Calendar className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">
                    {new Date(attraction.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Weekly Availability</h2>
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
