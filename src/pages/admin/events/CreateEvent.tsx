import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { eventService } from '../../../services/EventService';
import { locationService } from '../../../services/LocationService';
import { addOnService } from '../../../services/AddOnService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import LocationSelector from '../../../components/admin/LocationSelector';
import { getStoredUser } from '../../../utils/storage';
import type { CreateEventData } from '../../../types/event.types';
import { Plus, Trash2, GripVertical, X, Calendar, Clock, DollarSign, MapPin, Star, Package } from 'lucide-react';

const CreateEvent = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [dateType, setDateType] = useState<'one_time' | 'date_range'>('one_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [maxBookingsPerSlot, setMaxBookingsPerSlot] = useState('');
  const [price, setPrice] = useState('0');
  const [features, setFeatures] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Add-ons
  const [allAddOns, setAllAddOns] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<number[]>([]);
  const [draggedAddOnIndex, setDraggedAddOnIndex] = useState<number | null>(null);

  useEffect(() => {
    loadLocations();
    loadAddOns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLocations = async () => {
    try {
      const res = await locationService.getLocations();
      const list = Array.isArray(res.data) ? res.data : [];
      setLocations(list.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })));
      if (list.length > 0 && !selectedLocation) {
        setSelectedLocation(list[0].id.toString());
      }
    } catch {
      // ignore
    }
  };

  const loadAddOns = async () => {
    try {
      const res = await addOnService.getAddOns({ user_id: currentUser?.id });
      const list = res.data?.add_ons || [];
      setAllAddOns(list.map((a: { id: number; name: string; price: number | null }) => ({ id: a.id, name: a.name, price: a.price || 0 })));
    } catch {
      // ignore
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Features management
  const addFeature = () => setFeatures(prev => [...prev, '']);
  const removeFeature = (index: number) => setFeatures(prev => prev.filter((_, i) => i !== index));
  const updateFeature = (index: number, value: string) => {
    setFeatures(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  // Feature drag
  const [draggedFeatureIndex, setDraggedFeatureIndex] = useState<number | null>(null);
  const handleFeatureDragStart = (index: number) => setDraggedFeatureIndex(index);
  const handleFeatureDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFeatureIndex === null || draggedFeatureIndex === index) return;
    setFeatures(prev => {
      const items = [...prev];
      const dragged = items[draggedFeatureIndex];
      items.splice(draggedFeatureIndex, 1);
      items.splice(index, 0, dragged);
      setDraggedFeatureIndex(index);
      return items;
    });
  };
  const handleFeatureDragEnd = () => setDraggedFeatureIndex(null);

  // Add-on selection
  const toggleAddOn = (id: number) => {
    setSelectedAddOnIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Add-on drag reorder
  const handleAddOnDragStart = (index: number) => setDraggedAddOnIndex(index);
  const handleAddOnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedAddOnIndex === null || draggedAddOnIndex === index) return;
    setSelectedAddOnIds(prev => {
      const items = [...prev];
      const dragged = items[draggedAddOnIndex];
      items.splice(draggedAddOnIndex, 1);
      items.splice(index, 0, dragged);
      setDraggedAddOnIndex(index);
      return items;
    });
  };
  const handleAddOnDragEnd = () => setDraggedAddOnIndex(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setToast({ message: 'Event name is required', type: 'error' });
      return;
    }
    if (!startDate) {
      setToast({ message: 'Start date is required', type: 'error' });
      return;
    }
    if (dateType === 'date_range' && !endDate) {
      setToast({ message: 'End date is required for date range events', type: 'error' });
      return;
    }
    if (timeStart >= timeEnd && timeEnd !== '00:00') {
      setToast({ message: 'End time must be after start time', type: 'error' });
      return;
    }

    const locationId = isCompanyAdmin ? parseInt(selectedLocation) : currentUser?.location_id;
    if (!locationId) {
      setToast({ message: 'Please select a location', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        location_id: locationId,
        name: name.trim(),
        description: description.trim() || undefined,
        image: image || undefined,
        date_type: dateType,
        start_date: startDate,
        end_date: dateType === 'date_range' ? endDate : undefined,
        time_start: timeStart,
        time_end: timeEnd,
        interval_minutes: intervalMinutes,
        max_bookings_per_slot: maxBookingsPerSlot ? parseInt(maxBookingsPerSlot) : null,
        price: parseFloat(price) || 0,
        features: features.filter(f => f.trim()),
        add_on_ids: selectedAddOnIds.length > 0 ? selectedAddOnIds : undefined,
        add_ons_order: selectedAddOnIds.length > 0 ? selectedAddOnIds : undefined,
        is_active: isActive,
      };

      await eventService.createEvent(payload as unknown as CreateEventData);
      setToast({ message: 'Event created successfully!', type: 'success' });
      setTimeout(() => navigate('/events'), 1000);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create event';
      setToast({ message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
  };

  const formatDateDisplay = (date: string) => {
    if (!date) return '';
    return new Date(date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Form Column */}
      <div className="flex-1 mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Create Event</h2>
          <p className="text-sm text-gray-500 mt-2">Fill in the details below to create a new event.</p>
        </div>

      <form onSubmit={handleSubmit} className="space-y-8" autoComplete="off">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" /> Basic Information
          </h3>

          {isCompanyAdmin && locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <LocationSelector
                locations={locations}
                selectedLocation={selectedLocation}
                onLocationChange={setSelectedLocation}
                themeColor={themeColor}
                fullColor={fullColor}
                showAllOption={false}
                variant="compact"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g., Summer Splash Party"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Describe the event..."
            />
          </div>

          <div>
            <label className="block font-semibold mb-2 text-base text-neutral-800">Event Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-${themeColor}-50 file:text-${fullColor} hover:file:bg-${themeColor}-100`}
            />
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-800 font-medium">Recommended: 16:9 aspect ratio (1280×720 or 1920×1080 pixels)</p>
              <p className="text-xs text-blue-600 mt-1">Images will be cropped to fit the display area. Center your subject for best results.</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Max file size: 20MB. Use optimized images for faster loading.</p>
            {imagePreview && (
              <div className="mt-4">
                <p className="text-xs text-gray-600 mb-2 font-medium">Preview (as customers will see it):</p>
                <div className="relative w-full aspect-video rounded-md border border-gray-200 overflow-hidden bg-gray-100">
                  <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImage(''); setImagePreview(''); }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity text-xs"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Date & Time */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" /> Date & Time
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Type</label>
            <div className="flex gap-4">
              {(['one_time', 'date_range'] as const).map(dt => (
                <label key={dt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateType"
                    value={dt}
                    checked={dateType === dt}
                    onChange={() => setDateType(dt)}
                    className="text-blue-600"
                  />
                  <span className="text-sm">{dt === 'one_time' ? 'One Time' : 'Date Range'}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            {dateType === 'date_range' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Clock className="h-4 w-4" /> Start Time *
              </label>
              <input
                type="time"
                value={timeStart}
                onChange={e => setTimeStart(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Clock className="h-4 w-4" /> End Time *
              </label>
              <input
                type="time"
                value={timeEnd}
                onChange={e => setTimeEnd(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interval (minutes) *</label>
              <input
                type="number"
                min={5}
                value={intervalMinutes}
                onChange={e => setIntervalMinutes(parseInt(e.target.value) || 60)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Pricing & Capacity */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4 text-neutral-900">Pricing & Capacity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Ticket ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings per Slot</label>
              <input
                type="number"
                min={1}
                value={maxBookingsPerSlot}
                onChange={e => setMaxBookingsPerSlot(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400 mt-1">Leave empty for unlimited</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Features */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-neutral-900">Features</h3>
            <StandardButton variant="ghost" size="sm" icon={Plus} onClick={addFeature} type="button">
              Add Feature
            </StandardButton>
          </div>
          {features.length === 0 && (
            <p className="text-sm text-gray-400">No features added yet. Click "Add Feature" to start.</p>
          )}
          <div className="space-y-2">
            {features.map((feature, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleFeatureDragStart(index)}
                onDragOver={(e) => handleFeatureDragOver(e, index)}
                onDragEnd={handleFeatureDragEnd}
                className="flex items-center gap-2 group"
              >
                <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
                <input
                  type="text"
                  value={feature}
                  onChange={e => updateFeature(index, e.target.value)}
                  placeholder="e.g., Access to all water slides"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Add-ons */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-neutral-900">Add-Ons</h3>
            {allAddOns.length > 0 && (
              <StandardButton
                type="button"
                onClick={() => {
                  if (selectedAddOnIds.length === allAddOns.length) {
                    setSelectedAddOnIds([]);
                  } else {
                    setSelectedAddOnIds(allAddOns.map(a => a.id));
                  }
                }}
                variant={selectedAddOnIds.length === allAddOns.length ? 'primary' : 'ghost'}
                size="sm"
              >
                {selectedAddOnIds.length === allAddOns.length ? 'Deselect All' : 'Select All'}
              </StandardButton>
            )}
          </div>
          <p className="text-sm text-gray-500">Select add-ons available for this event.</p>

          {/* Selected Add-ons - Draggable list */}
          {selectedAddOnIds.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Selected Add-ons <span className="text-xs font-normal text-gray-500">(drag to reorder)</span></label>
              <div className="space-y-2">
                {selectedAddOnIds.map((id, index) => {
                  const addon = allAddOns.find(a => a.id === id);
                  if (!addon) return null;
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg ${draggedAddOnIndex === index ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={() => handleAddOnDragStart(index)}
                      onDragOver={(e) => handleAddOnDragOver(e, index)}
                      onDragEnd={handleAddOnDragEnd}
                    >
                      <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-800">{addon.name}</span>
                      <span className="text-xs text-green-600">${Number(addon.price).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => toggleAddOn(id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Add-ons to select */}
          {allAddOns.length === 0 ? (
            <p className="text-sm text-gray-400">No add-ons available.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allAddOns.filter(a => !selectedAddOnIds.includes(a.id)).map(addon => (
                <StandardButton
                  type="button"
                  key={addon.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleAddOn(addon.id)}
                >
                  {addon.name} <span className="text-xs opacity-70">${Number(addon.price).toFixed(2)}</span>
                </StandardButton>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <hr className="border-gray-100" />
        <div className="flex gap-2">
          <StandardButton variant="primary" type="submit" loading={isSubmitting} icon={Plus} fullWidth>
            {isSubmitting ? 'Creating...' : 'Create Event'}
          </StandardButton>
          <StandardButton variant="secondary" onClick={() => navigate('/events')} type="button" fullWidth>
            Cancel
          </StandardButton>
        </div>
      </form>
      </div>
      </div>

      {/* Live Preview Sidebar */}
      <div className="w-full md:w-[420px] md:max-w-sm h-fit">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none sticky top-24">
          <h3 className="text-2xl font-bold mb-6 text-neutral-900 tracking-tight">Live Preview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-2xl text-primary tracking-tight">{name || <span className="text-gray-400">Event Name</span>}</span>
              <span className="text-lg text-gray-500 font-semibold">${price || '--'}</span>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">Date:</span>
              <span className="text-neutral-800 text-sm">
                {startDate ? (
                  dateType === 'one_time'
                    ? formatDateDisplay(startDate)
                    : `${formatDateDisplay(startDate)} – ${endDate ? formatDateDisplay(endDate) : '...'}`
                ) : <span className="text-gray-300">Not set</span>}
              </span>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">Time:</span>
              <span className="text-neutral-800 text-sm">
                {formatTimeDisplay(timeStart)} – {formatTimeDisplay(timeEnd)}
              </span>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">Location:</span>
              <span className="text-neutral-800 text-sm">
                {selectedLocation ? (locations.find(l => l.id.toString() === selectedLocation)?.name || <span className="text-gray-300">Unknown</span>) : <span className="text-gray-300">Not set</span>}
              </span>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">Interval:</span>
              <span className="text-neutral-800 text-sm">{intervalMinutes} min</span>
            </div>

            {maxBookingsPerSlot && (
              <div className="mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                <span className="font-semibold">Capacity:</span>
                <span className="text-neutral-800 text-sm">{maxBookingsPerSlot} per slot</span>
              </div>
            )}

            <div className="mb-4 text-neutral-800 text-base min-h-[48px] whitespace-pre-line">
              {description || <span className="text-gray-300">Description</span>}
            </div>

            <div className="mb-2">
              <span className="font-semibold">Features:</span>{' '}
              <span className="text-neutral-800 text-sm">
                {features.filter(f => f.trim()).length > 0
                  ? features.filter(f => f.trim()).map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500" />{f}{i < features.filter(f2 => f2.trim()).length - 1 ? ', ' : ''}
                      </span>
                    ))
                  : <span className="text-gray-300">None</span>}
              </span>
            </div>

            <div className="mb-2">
              <span className="font-semibold">Add-ons:</span>{' '}
              <span className="text-neutral-800 text-sm">
                {selectedAddOnIds.length > 0
                  ? selectedAddOnIds.map(id => {
                      const addon = allAddOns.find(a => a.id === id);
                      return addon ? `${addon.name} ($${Number(addon.price).toFixed(2)})` : '';
                    }).filter(Boolean).join(', ')
                  : <span className="text-gray-300">None</span>}
              </span>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold">Status:</span>
              <span className={`text-sm font-medium ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {imagePreview && (
              <div className="mt-4">
                <img src={imagePreview} alt="Event preview" className="w-full rounded-lg object-cover max-h-48" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEvent;
