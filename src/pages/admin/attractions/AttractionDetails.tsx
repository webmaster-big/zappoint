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
  Tag
} from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { attractionService } from '../../../services/AttractionService';
import { ASSET_URL } from '../../../utils/storage';
import Toast from '../../../components/ui/Toast';
import { extractIdFromSlug } from '../../../utils/slug';
import { formatTimeRange } from '../../../utils/timeFormat';

interface AttractionAvailabilitySchedule {
  days: string[];
  start_time: string;
  end_time: string;
}

interface Attraction {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  pricing_type?: string;
  max_capacity: number;
  duration?: number;
  duration_unit?: string;
  image?: string | string[];
  location?: { name: string };
  created_at: string;
  is_active: boolean;
  availability?: AttractionAvailabilitySchedule[];
}

const AttractionDetails = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const attractionId = slug ? extractIdFromSlug(slug) : null;

  useEffect(() => {
    loadAttractionDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadAttractionDetails = async () => {
    if (!attractionId) return;
    try {
      setLoading(true);
      const response = await attractionService.getAttraction(attractionId);
      setAttraction(response.data as Attraction);
    } catch (error) {
      console.error('Error loading attraction details:', error);
      setToast({ message: 'Failed to load attraction details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this attraction? This action cannot be undone.')) {
      if (!attractionId) return;
      try {
        await attractionService.deleteAttraction(attractionId);
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
          <StandardButton
            variant="ghost"
            size="md"
            onClick={() => navigate('/attractions')}
          >
            Back to Attractions
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <StandardButton
              variant="ghost"
              size="sm"
              onClick={() => navigate('/attractions')}
              icon={ArrowLeft}
            >
              {''}
            </StandardButton>
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
              <StandardButton
                variant="primary"
                size="md"
                onClick={() => navigate(`/attractions/edit/${attractionId}`)}
                icon={Edit}
              >
                Edit
              </StandardButton>
              <StandardButton
                variant="danger"
                size="md"
                onClick={handleDelete}
                icon={Trash2}
              >
                Delete
              </StandardButton>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Availability Schedule</h2>
            {attraction.availability && Array.isArray(attraction.availability) && attraction.availability.length > 0 ? (
              <div className="space-y-3">
                {attraction.availability.map((schedule, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {schedule.days && schedule.days.map((day) => (
                        <span 
                          key={day} 
                          className={`px-3 py-1.5 bg-${themeColor}-600 text-white text-sm font-medium rounded capitalize`}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className={`h-4 w-4 text-${fullColor}`} />
                      <span className="font-medium">
                        {formatTimeRange(schedule.start_time, schedule.end_time)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-600">No availability schedule configured for this attraction.</p>
              </div>
            )}
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
