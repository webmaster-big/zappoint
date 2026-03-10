import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { eventService } from '../../../services/EventService';
import { locationService } from '../../../services/LocationService';
import { addOnService } from '../../../services/AddOnService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import LocationSelector from '../../../components/admin/LocationSelector';
import { getStoredUser } from '../../../utils/storage';
import { Plus, Trash2, GripVertical, X, Calendar, Clock, Image, DollarSign, MapPin, Star, Package } from 'lucide-react';
import type { Event, UpdateEventData } from '../../../types/event.types';

const EditEvent = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [locRes, addOnRes] = await Promise.all([
        locationService.getLocations(),
        addOnService.getAddOns({ user_id: currentUser?.id }),
      ]);

      const locList = Array.isArray(locRes.data) ? locRes.data : [];
      setLocations(locList.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })));

      const addOnList = addOnRes.data?.add_ons || [];
      setAllAddOns(addOnList.map((a: { id: number; name: string; price: number | null }) => ({ id: a.id, name: a.name, price: a.price || 0 })));

      // Load event data
      if (id) {
        const eventRes = await eventService.getEvent(parseInt(id));
        // Handle various API response shapes
        let event: Event;
        const d = eventRes.data as unknown;
        if (d && typeof d === 'object' && 'name' in (d as Record<string, unknown>)) {
          event = d as Event;
        } else if (d && typeof d === 'object') {
          const obj = d as Record<string, unknown>;
          event = (obj.event || obj.data || obj) as Event;
        } else {
          event = eventRes as unknown as Event;
        }
        setName(event.name || '');
        setDescription(event.description || '');
        setImagePreview(event.image || '');
        setDateType(event.date_type || 'one_time');
        setStartDate(event.start_date || '');
        setEndDate(event.end_date || '');
        setTimeStart(event.time_start ? event.time_start.substring(0, 5) : '09:00');
        setTimeEnd(event.time_end ? event.time_end.substring(0, 5) : '17:00');
        setIntervalMinutes(event.interval_minutes || 60);
        setMaxBookingsPerSlot(event.max_bookings_per_slot?.toString() || '');
        setPrice(event.price || '0');
        setFeatures(event.features || []);
        setIsActive(event.is_active ?? true);
        setSelectedLocation(event.location_id?.toString() || '');

        if (event.add_ons_order && event.add_ons_order.length > 0) {
          setSelectedAddOnIds(event.add_ons_order);
        } else if (event.add_ons) {
          setSelectedAddOnIds(event.add_ons.map(a => a.id));
        }
      }
    } catch {
      setToast({ message: 'Failed to load event data', type: 'error' });
    } finally {
      setLoading(false);
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
  const toggleAddOn = (addonId: number) => {
    setSelectedAddOnIds(prev =>
      prev.includes(addonId) ? prev.filter(x => x !== addonId) : [...prev, addonId]
    );
  };

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
    if (!id) return;

    if (!name.trim()) {
      setToast({ message: 'Event name is required', type: 'error' });
      return;
    }
    if (timeStart >= timeEnd && timeEnd !== '00:00') {
      setToast({ message: 'End time must be after start time', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        location_id: parseInt(selectedLocation) || currentUser?.location_id,
        name: name.trim(),
        description: description.trim() || undefined,
        date_type: dateType,
        start_date: startDate,
        end_date: dateType === 'date_range' ? endDate : undefined,
        time_start: timeStart,
        time_end: timeEnd,
        interval_minutes: intervalMinutes,
        max_bookings_per_slot: maxBookingsPerSlot ? parseInt(maxBookingsPerSlot) : null,
        price: parseFloat(price) || 0,
        features: features.filter(f => f.trim()),
        add_on_ids: selectedAddOnIds,
        add_ons_order: selectedAddOnIds,
        is_active: isActive,
      };
      if (image) payload.image = image;

      await eventService.updateEvent(parseInt(id), payload as UpdateEventData);
      setToast({ message: 'Event updated successfully!', type: 'success' });
      setTimeout(() => navigate('/events'), 1000);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update event';
      setToast({ message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

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
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Edit Event</h2>
          <p className="text-sm text-gray-500 mt-2">Update event details</p>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Image</label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImage(''); setImagePreview(''); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition">
                  <Image className="h-6 w-6 text-gray-400" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>
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
            <p className="text-sm text-gray-400">No features added yet.</p>
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
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button type="button" onClick={() => removeFeature(index)} className="p-1.5 text-gray-400 hover:text-red-500 transition">
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
          {allAddOns.length === 0 ? (
            <p className="text-sm text-gray-400">No add-ons available.</p>
          ) : (
            <>
              {/* Selected Add-ons - Draggable list */}
              {selectedAddOnIds.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Selected Add-ons <span className="text-xs font-normal text-gray-500">(drag to reorder)</span></label>
                  <div className="space-y-2">
                    {selectedAddOnIds.map((addonId, index) => {
                      const addon = allAddOns.find(a => a.id === addonId);
                      if (!addon) return null;
                      return (
                        <div
                          key={addonId}
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
                            onClick={() => toggleAddOn(addonId)}
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
              {allAddOns.filter(a => !selectedAddOnIds.includes(a.id)).length > 0 && (
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
            </>
          )}
        </div>

        {/* Submit */}
        <hr className="border-gray-100" />
        <div className="flex gap-2">
          <StandardButton variant="primary" type="submit" loading={isSubmitting} fullWidth>
            {isSubmitting ? 'Updating...' : 'Update Event'}
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
                    : `${formatDateDisplay(startDate)} \u2013 ${endDate ? formatDateDisplay(endDate) : '...'}`
                ) : <span className="text-gray-300">Not set</span>}
              </span>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">Time:</span>
              <span className="text-neutral-800 text-sm">
                {formatTimeDisplay(timeStart)} \u2013 {formatTimeDisplay(timeEnd)}
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

            <div className="mb-4 text-neutral-800 text-base min-h-[48px]">
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
                  ? selectedAddOnIds.map(addonId => {
                      const addon = allAddOns.find(a => a.id === addonId);
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

export default EditEvent;
