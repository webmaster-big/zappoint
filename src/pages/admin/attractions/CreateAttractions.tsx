import React, { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreateAttractionsFormData } from '../../../types/createAttractions.types';

const CreateAttraction = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateAttractionsFormData>({
    name: '',
    description: '',
    category: '',
    price: '',
    pricingType: 'per_person',
    maxCapacity: '',
    duration: '',
    durationUnit: 'minutes',
  // location: '',
    images: [],
    bookingLink: '',
    embedCode: '',
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true
    },
  });

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  // const [customLocation, setCustomLocation] = useState('');

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvailabilityChange = (day: keyof CreateAttractionsFormData['availability']) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: !prev.availability[day]
      }
    }));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    if (fileArray.length + formData.images.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    const newImagePreviews = fileArray.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newImagePreviews]);

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...fileArray.map(file => file.name)]
    }));
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
      category: value === 'other' ? customCategory : value
    }));
  };

  const handleCustomCategoryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomCategory(value);
    setFormData(prev => ({
      ...prev,
      category: value
    }));
  };

  // Location handlers removed

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newId = `attr_${Date.now()}`;
    const existingAttractions = JSON.parse(localStorage.getItem('zapzone_attractions') || '[]');
    const newAttraction = {
      id: newId,
      ...formData,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // TODO: Send newAttraction to backend API instead of localStorage
    localStorage.setItem('zapzone_attractions', JSON.stringify([...existingAttractions, newAttraction]));

    alert('Attraction created successfully!');
    navigate('/manage-attractions');
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
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4 text-blue-800 border-b pb-2">Live Preview</h2>
        
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
            <span className="font-bold text-lg text-blue-800">
              {formData.price ? `$${formData.price}` : "$0.00"}
              <span className="text-xs font-normal text-gray-500 ml-1">
                {formData.pricingType === 'per_person' ? '/person' : 
                 formData.pricingType === 'per_hour' ? '/hour' : 
                 formData.pricingType === 'per_game' ? '/game' : ''}
              </span>
            </span>
            {formData.duration && (
              <span className="text-sm text-gray-600">
                {formData.duration} {formData.durationUnit}
              </span>
            )}
          </div>
          
          {/* Location preview removed */}
          
          <div className="text-sm text-gray-600">
            <span className="font-medium">Capacity:</span> {formData.maxCapacity ? `Up to ${formData.maxCapacity} people` : "Not specified"}
          </div>
          
          <div className="pt-2 border-t border-gray-100">
            <h4 className="font-medium text-gray-800 mb-2">Available Days:</h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(formData.availability)
                .filter(([, v]) => v)
                .map(([day]) => (
                  <span key={day} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                    {day.slice(0, 3)}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Container - 2/3 width */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Basic Information Section */}
              <div className="p-6 border-b border-gray-100">
                <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Create New Attraction</h1>
          <p className="mt-2 text-gray-600">
            Set up a new attraction that customers can purchase tickets for
          </p>
        </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100">
                  Basic Information
                </h2>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-800 mb-2">
                      Attraction Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="e.g., Laser Tag, Bowling, Escape Room"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-800 mb-2">
                      Description *
                    </label>
                    <textarea
                      name="description"
                      id="description"
                      rows={3}
                      required
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Describe the attraction in detail..."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="category" className="block text-sm font-medium text-gray-800 mb-2">
                      Category *
                    </label>
                    <select
                      name="category"
                      id="category"
                      required
                      value={formData.category === customCategory ? 'other' : formData.category}
                      onChange={handleCategoryChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="">Select a category</option>
                      <option value="adventure">Adventure</option>
                      <option value="sports">Sports</option>
                      <option value="arcade">Arcade</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="educational">Educational</option>
                      <option value="food">Food & Dining</option>
                      <option value="kids">Kids</option>
                      <option value="other">Other</option>
                    </select>
                    {formData.category === customCategory || formData.category === 'other' ? (
                      <input
                        type="text"
                        placeholder="Enter custom category"
                        className="mt-2 w-full px-4 py-2 border border-gray-200 rounded-lg"
                        value={customCategory}
                        onChange={handleCustomCategoryChange}
                      />
                    ) : null}
                  </div>

                  {/* Location input removed */}
                </div>
              </div>

              {/* Pricing & Capacity Section */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100">
                  Pricing & Capacity
                </h2>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-800 mb-2">
                      Price *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500">$</span>
                      </div>
                      <input
                        type="number"
                        name="price"
                        id="price"
                        min="0"
                        step="0.01"
                        required
                        value={formData.price}
                        onChange={handleInputChange}
                        className="w-full pl-8 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pricingType" className="block text-sm font-medium text-gray-800 mb-2">
                      Pricing Type *
                    </label>
                    <select
                      name="pricingType"
                      id="pricingType"
                      required
                      value={formData.pricingType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="per_person">Per Person</option>
                      <option value="per_group">Per Group</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_game">Per Game</option>
                      <option value="fixed">Fixed Price</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="maxCapacity" className="block text-sm font-medium text-gray-800 mb-2">
                      Maximum Capacity *
                    </label>
                    <input
                      type="number"
                      name="maxCapacity"
                      id="maxCapacity"
                      min="1"
                      required
                      value={formData.maxCapacity}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="e.g., 10"
                    />
                  </div>

                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-800 mb-2">
                      Duration
                    </label>
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                      <input
                        type="number"
                        name="duration"
                        id="duration"
                        min="1"
                        value={formData.duration}
                        onChange={handleInputChange}
                        className="flex-1 px-4 py-3 focus:outline-none"
                        placeholder="e.g., 60"
                      />
                      <select
                        name="durationUnit"
                        value={formData.durationUnit}
                        onChange={handleInputChange}
                        className="px-3 py-3 bg-gray-50 text-gray-800 border-l border-gray-200 focus:outline-none"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Availability Section */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100">
                  Availability
                </h2>
                
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-800 mb-3">
                    Available Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => handleAvailabilityChange(day.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.availability[day.key] 
                            ? 'bg-blue-800 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Images Section */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100">
                  Images
                </h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-3">
                    Upload Images (Max 5)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 transition-colors">
                    <div className="space-y-2 text-center">
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label
                          htmlFor="image-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                        >
                          <span>Select images</span>
                          <input
                            id="image-upload"
                            name="image-upload"
                            type="file"
                            className="sr-only"
                            multiple
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </div>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-800 mb-3">
                      Image Previews
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group rounded-xl overflow-hidden shadow-sm">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="h-40 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="px-6 py-5 bg-gray-50 text-right space-x-3">
                <button
                  type="button"
                  onClick={() => navigate('/attractions')}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-800 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white hover:from-blue-800 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                >
                  Create Attraction
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview Container - 1/3 width, sticky */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <LivePreview formData={formData} imagePreviews={imagePreviews} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAttraction;