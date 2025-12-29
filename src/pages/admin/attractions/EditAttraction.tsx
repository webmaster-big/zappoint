import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { CreateAttractionsFormData } from '../../../types/createAttractions.types';
import { attractionService } from '../../../services/AttractionService';
import type { UpdateAttractionData } from '../../../services/AttractionService';
import Toast from '../../../components/ui/Toast';
import { ASSET_URL, getStoredUser } from '../../../utils/storage';
import { categoryService } from '../../../services';
import type { Category } from '../../../services/CategoryService';
import { Plus, Trash2, Info, Tag, Calendar, Clock } from 'lucide-react';
import { formatTimeRange, formatDurationDisplay } from '../../../utils/timeFormat';
import StandardButton from '../../../components/ui/StandardButton';

const EditAttraction = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { themeColor, fullColor } = useThemeColor();

  // Get auth token from localStorage
  const getAuthToken = () => {
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.token;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  };

  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState<CreateAttractionsFormData>({
    name: '',
    description: '',
    category: '',
    price: '',
    pricingType: 'per_person',
    maxCapacity: '',
    duration: '',
    durationUnit: 'minutes',
    images: [],
    bookingLink: '',
    embedCode: '',
    availability: [
      {
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        start_time: '09:00',
        end_time: '17:00'
      }
    ],
  });

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Load attraction data
  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadAttraction = async () => {
      try {
        const authToken = getAuthToken();
        console.log('🔐 Loading attraction for edit - Auth Token:', authToken ? 'Present' : 'Missing');
        const response = await attractionService.getAttraction(Number(id));
        const attraction = response.data;
        
        setFormData({
          name: attraction.name || '',
          description: attraction.description || '',
          category: attraction.category || '',
          price: attraction.price?.toString() || '',
          pricingType: attraction.pricing_type || 'per_person',
          maxCapacity: attraction.max_capacity?.toString() || '',
          duration: attraction.duration?.toString() || '',
          durationUnit: attraction.duration_unit || 'minutes',
          images: attraction.image ? (Array.isArray(attraction.image) ? attraction.image : [attraction.image]) : [],
          bookingLink: '',
          embedCode: '',
          availability: Array.isArray((attraction as any).availability) 
            ? (attraction as any).availability 
            : [{
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                start_time: '09:00',
                end_time: '17:00'
              }],
        });

        // Set image previews if images exist (handle both string and array)
        if (attraction.image) {
          const images = Array.isArray(attraction.image) ? attraction.image : [attraction.image];
          console.log("ASSET_URL + attraction.image", images.map(img => ASSET_URL + img));
          setImagePreviews(images.map(img => ASSET_URL + img));
        }
      } catch (error) {
        console.error('Error loading attraction:', error);
        setNotFound(true);
        setToast({ message: 'Failed to load attraction', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadAttraction();
    
    // Fetch categories
    const fetchCategories = async () => {
      try {
        const response = await categoryService.getCategories();
        console.log('Categories API response:', response);
        const categoriesData = response.data || [];
        console.log('Categories data:', categoriesData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    fetchCategories();
  }, [id]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addSchedule = () => {
    setFormData(prev => ({
      ...prev,
      availability: [
        ...prev.availability,
        {
          days: [],
          start_time: '09:00',
          end_time: '17:00'
        }
      ]
    }));
  };

  const removeSchedule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      availability: prev.availability.filter((_, i) => i !== index)
    }));
  };

  const toggleScheduleDay = (scheduleIndex: number, day: string) => {
    setFormData(prev => {
      const newSchedules = [...prev.availability];
      const schedule = newSchedules[scheduleIndex];
      if (schedule.days.includes(day)) {
        schedule.days = schedule.days.filter(d => d !== day);
      } else {
        schedule.days = [...schedule.days, day];
      }
      return { ...prev, availability: newSchedules };
    });
  };

  const selectAllScheduleDays = (scheduleIndex: number) => {
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    setFormData(prev => {
      const newSchedules = [...prev.availability];
      const schedule = newSchedules[scheduleIndex];
      const allSelected = allDays.every(day => schedule.days.includes(day));
      schedule.days = allSelected ? [] : [...allDays];
      return { ...prev, availability: newSchedules };
    });
  };

  const updateScheduleTime = (scheduleIndex: number, field: 'start_time' | 'end_time', value: string) => {
    setFormData(prev => {
      const newSchedules = [...prev.availability];
      newSchedules[scheduleIndex][field] = value;
      return { ...prev, availability: newSchedules };
    });
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    if (fileArray.length + formData.images.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    // Create previews using object URLs
    const newImagePreviews = fileArray.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newImagePreviews]);

    // Convert files to base64 for backend
    const base64Promises = fileArray.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const base64Images = await Promise.all(base64Promises);
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...base64Images]
      }));
    } catch (error) {
      console.error('Error converting images to base64:', error);
      alert('Failed to process images. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...formData.images];
    const newPreviews = [...imagePreviews];
    
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    
    setFormData(prev => ({ ...prev, images: newImages }));
    setImagePreviews(newPreviews);
  };

  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      category: value
    }));
  };

  const handleAddCategory = async (name: string) => {
    if (!name.trim()) return;
    
    try {
      const response = await categoryService.createCategory({ name: name.trim() });
      if (response.success && response.data) {
        setCategories(prev => [...prev, response.data]);
        setFormData(prev => ({ ...prev, category: response.data.name }));
        setToast({ message: 'Category added successfully!', type: 'success' });
      }
    } catch (error) {
      console.error('Error adding category:', error);
      setToast({ message: 'Failed to add category', type: 'error' });
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
      return;
    }
    
    try {
      await categoryService.deleteCategory(category.id);
      setCategories(prev => prev.filter(c => c.id !== category.id));
      if (formData.category === category.name) {
        setFormData(prev => ({ ...prev, category: '' }));
      }
      setToast({ message: 'Category deleted successfully!', type: 'success' });
    } catch (error) {
      console.error('Error deleting category:', error);
      setToast({ message: 'Failed to delete category', type: 'error' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    try {
      setIsSubmitting(true);

      // Convert form data to API format
      // Include location_id from the currently stored user (if available)
      const attractionData: UpdateAttractionData = {
        location_id: getStoredUser()?.location_id || undefined,
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        pricing_type: formData.pricingType,
        max_capacity: Number(formData.maxCapacity),
        category: formData.category,
        duration: formData.duration ? Number(formData.duration) : undefined,
        duration_unit: formData.durationUnit as 'hours' | 'minutes' | 'hours and minutes',
        availability: formData.availability,
        image: formData.images.length > 0 ? formData.images : undefined, // Send all images as array
        is_active: true,
      };

      console.log('Updating attraction data:', attractionData);

      const response = await attractionService.updateAttraction(Number(id), attractionData);
      
      console.log('Attraction updated:', response);
      
      setToast({ message: 'Attraction updated successfully!', type: 'success' });
      
      // Navigate after a short delay to show success message
      setTimeout(() => {
        navigate('/attractions');
      }, 1500);
    } catch (error: unknown) {
      console.error('Error updating attraction:', error);
      
      let errorMessage = 'Failed to update attraction. Please try again.';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        errorMessage = axiosError.response?.data?.message || errorMessage;
      }
      
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysOfWeek = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' }
  ] as const;

  // LivePreview component
  const LivePreview: React.FC<{ formData: CreateAttractionsFormData; imagePreviews: string[] }> = ({ formData, imagePreviews }) => {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none">
        <h2 className={`text-xl font-bold mb-4 text-${fullColor} pb-2`}>Live Preview</h2>
        
        {imagePreviews.length > 0 && (
          <div className="mb-4">
            <img
              src={imagePreviews[0]}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg mb-2"
            />
          </div>
        )}
        
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg text-gray-800">{formData.name || "Attraction Name"}</h3>
            <p className="text-sm text-gray-600 mt-1">{formData.category || "Category"}</p>
          </div>
          
          <div>
            <p className="text-gray-800 text-sm">{formData.description || "No description provided"}</p>
          </div>
          
          <div className="flex justify-between items-center">
            <span className={`font-bold text-lg text-${fullColor}`}>
              {formData.price ? `$${formData.price}` : "$0.00"}
              <span className="text-xs font-normal text-gray-500 ml-1">
                {formData.pricingType === 'per_person' ? '/person' : 
                 formData.pricingType === 'per_hour' ? '/hour' : 
                 formData.pricingType === 'per_game' ? '/game' : ''}
              </span>
            </span>
            {formData.duration ? (
              <span className="text-sm text-gray-600">
                {formData.duration === '0' ? 'Unlimited' : formatDurationDisplay(parseFloat(formData.duration), formData.durationUnit)}
              </span>
            ) : (
              <span className="text-sm text-gray-600">Unlimited</span>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            <span className="font-medium">Capacity:</span> {formData.maxCapacity ? `Up to ${formData.maxCapacity} people` : "Not specified"}
          </div>
          
          <div className="pt-2 border-t border-gray-100">
            <h4 className="font-medium text-gray-800 mb-2">Availability Schedules:</h4>
            <div className="space-y-2">
              {formData.availability.map((schedule, index) => (
                <div key={index} className="text-sm">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {schedule.days.map(day => (
                      <span key={day} className={`bg-${themeColor}-100 text-${fullColor} px-2 py-1 rounded text-xs`}>
                        {day.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatTimeRange(schedule.start_time, schedule.end_time)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Attraction Not Found</h1>
          <p className="text-gray-600 mb-6">The attraction you're looking for doesn't exist.</p>
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => navigate('/manage-attractions')}
          >
            Back to Manage Attractions
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
      {/* Form Section */}
      <div className="flex-1 mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Edit Attraction</h2>
            <p className="text-sm text-gray-500 mt-2">Update attraction details and settings</p>
          </div>
          
          <form className="space-y-8" onSubmit={handleSubmit} autoComplete="off">
            {/* Basic Information Section */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" /> Basic Information
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Attraction Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                    placeholder="e.g., Laser Tag, Bowling, Escape Room"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                    placeholder="Describe the attraction in detail..."
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Category</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex gap-1 items-center flex-1">
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleCategoryChange}
                        className={`rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base min-w-0 flex-1 transition-all`}
                        required
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                      {formData.category && (
                        <StandardButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const category = categories.find(c => c.name === formData.category);
                            if (category) handleDeleteCategory(category);
                          }}
                          icon={Trash2}
                          className="text-red-600 hover:bg-red-50"
                        >
                          {''}
                        </StandardButton>
                      )}
                    </div>
                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        placeholder="Add category"
                        className="rounded-md border border-gray-200 px-3 py-2 bg-white text-base min-w-0 w-32 transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCategory((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <StandardButton 
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const input = document.querySelector('input[placeholder="Add category"]') as HTMLInputElement;
                          if (input?.value) {
                            handleAddCategory(input.value);
                            input.value = '';
                          }
                        }}
                        icon={Plus}
                      >
                        {''}
                      </StandardButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing & Capacity Section */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" /> Pricing & Capacity
              </h3>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Price</label>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Pricing Type</label>
                    <select
                      name="pricingType"
                      value={formData.pricingType}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                      required
                    >
                      <option value="per_person">Per Person</option>
                      <option value="per_group">Per Group</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_game">Per Game</option>
                      <option value="fixed">Fixed Price</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Maximum Capacity</label>
                    <input
                      type="number"
                      name="maxCapacity"
                      min="1"
                      value={formData.maxCapacity}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="e.g., 10"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Duration (0 for unlimited)</label>
                    <div className="flex rounded-md overflow-hidden border border-gray-200">
                      <input
                        type="number"
                        name="duration"
                        min="0"
                        value={formData.duration}
                        onChange={handleInputChange}
                        className="flex-1 px-4 py-2 focus:outline-none text-neutral-900"
                        placeholder="0 = unlimited"
                      />
                      <select
                        name="durationUnit"
                        value={formData.durationUnit}
                        onChange={handleInputChange}
                        className="px-3 py-2 bg-gray-50 text-gray-800 border-l border-gray-200 focus:outline-none"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Availability Section */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Availability Schedules
              </h3>
              <div className="space-y-4">
                {formData.availability.map((schedule, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-neutral-800">Schedule {index + 1}</h4>
                      {formData.availability.length > 1 && (
                        <StandardButton
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSchedule(index)}
                          icon={Trash2}
                          className="text-red-600 hover:bg-red-50"
                        >
                          {''}
                        </StandardButton>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block font-medium text-sm text-neutral-700">Days</label>
                        <button
                          type="button"
                          onClick={() => selectAllScheduleDays(index)}
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                            daysOfWeek.every(d => schedule.days.includes(d.key))
                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                          }`}
                        >
                          {daysOfWeek.every(d => schedule.days.includes(d.key)) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map(day => (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => toggleScheduleDay(index, day.key)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                              schedule.days.includes(day.key)
                                ? `bg-${fullColor} text-white shadow-sm` 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-medium mb-2 text-sm text-neutral-700 flex items-center gap-1">
                          <Clock className="w-4 h-4" /> Start Time
                        </label>
                        <input
                          type="time"
                          value={schedule.start_time}
                          onChange={(e) => updateScheduleTime(index, 'start_time', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-2 text-sm text-neutral-700 flex items-center gap-1">
                          <Clock className="w-4 h-4" /> End Time
                        </label>
                        <input
                          type="time"
                          value={schedule.end_time}
                          onChange={(e) => updateScheduleTime(index, 'end_time', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary bg-white text-neutral-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={addSchedule}
                  icon={Plus}
                  fullWidth
                >
                  Add Another Schedule
                </StandardButton>
              </div>
            </div>

            {/* Images Section */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-neutral-900">Images</h3>
              <div className="space-y-5">
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Upload Images (Max 5)</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-${themeColor}-50 file:text-${fullColor} hover:file:bg-${themeColor}-100`}
                  />
                </div>

                {imagePreviews.length > 0 && (
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Image Previews</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group rounded-lg overflow-hidden">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="h-32 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <StandardButton
                variant="secondary"
                size="lg"
                onClick={() => navigate('/attractions')}
                disabled={isSubmitting}
                fullWidth
              >
                Cancel
              </StandardButton>
              <StandardButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                loading={isSubmitting}
                fullWidth
              >
                {isSubmitting ? 'Updating...' : 'Update Attraction'}
              </StandardButton>
            </div>
          </form>
        </div>
      </div>

      {/* Live Preview Section */}
      <div className="w-full md:w-[420px] md:max-w-sm md:sticky md:top-1 h-fit">
        <LivePreview formData={formData} imagePreviews={imagePreviews} />
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

export default EditAttraction;
