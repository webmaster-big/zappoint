import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Pencil,
  Trash2,
  RefreshCcw,
  Calendar,
  Filter,
  Zap,
  Star,
  DollarSign,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../../components/ui/StandardButton';
import Pagination from '../../../components/ui/Pagination';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import Toast from '../../../components/ui/Toast';
import LocationSelector from '../../../components/admin/LocationSelector';
import { eventService } from '../../../services/EventService';
import { eventCacheService } from '../../../services/EventCacheService';
import { locationService } from '../../../services/LocationService';
import { getStoredUser } from '../../../utils/storage';
import type { Event } from '../../../types/event.types';

const Events = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateTypeFilter, setDateTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  useEffect(() => {
    filterEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, statusFilter, dateTypeFilter, searchQuery]);

  const loadLocations = async () => {
    try {
      const res = await locationService.getLocations();
      if (res.success && Array.isArray(res.data)) {
        setLocations(res.data.map(l => ({ id: l.id, name: l.name })));
      }
    } catch {
      // ignore
    }
  };

  const fetchEvents = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Use cache for faster initial load
      const cached = !forceRefresh ? await eventCacheService.getCachedEvents() : null;
      if (cached && cached.length > 0) {
        let list = cached;
        if (selectedLocation) list = list.filter(e => e.location_id === selectedLocation);
        setEvents(list);
        setLoading(false);
        // Sync in background
        eventCacheService.syncInBackground({ user_id: currentUser?.id });
        return;
      }

      // No cache — fetch from API
      const filters: Record<string, unknown> = {};
      if (selectedLocation) filters.location_id = selectedLocation;
      const res = await eventService.getEvents(filters);
      let list: Event[] = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (res.data && typeof res.data === 'object') {
        const obj = res.data as Record<string, unknown>;
        if (Array.isArray(obj.events)) list = obj.events as Event[];
        else if (Array.isArray(obj.data)) list = obj.data as Event[];
      }
      if (list.length === 0 && Array.isArray(res)) {
        list = res as unknown as Event[];
      }
      setEvents(list);
      // Cache the full list
      await eventCacheService.cacheEvents(list);
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load events', type: 'error' });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];
    if (statusFilter === 'active') filtered = filtered.filter(e => e.is_active);
    if (statusFilter === 'inactive') filtered = filtered.filter(e => !e.is_active);
    if (dateTypeFilter !== 'all') filtered = filtered.filter(e => e.date_type === dateTypeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => e.name.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q));
    }
    setFilteredEvents(filtered);
    setCurrentPage(1);
  };

  const handleToggleStatus = async (id: number, newStatus: string) => {
    try {
      await eventService.toggleStatus(id);
      const isActive = newStatus === 'active';
      setEvents(prev => {
        const updated = prev.map(e => e.id === id ? { ...e, is_active: isActive } : e);
        const found = updated.find(e => e.id === id);
        if (found) eventCacheService.updateEventInCache(found);
        return updated;
      });
      setToast({ message: 'Event status updated', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update status', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    setDeletingId(id);
    try {
      await eventService.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      await eventCacheService.removeEventFromCache(id);
      setToast({ message: 'Event deleted', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete event', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectEvent = (id: number) => {
    setSelectedEvents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedEvents.length === paginatedEvents.length && paginatedEvents.length > 0) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(paginatedEvents.map(e => e.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedEvents.length} event(s)?`)) return;
    for (const id of selectedEvents) {
      try { await eventService.deleteEvent(id); } catch { /* skip */ }
    }
    setEvents(prev => prev.filter(e => !selectedEvents.includes(e.id)));
    for (const eid of selectedEvents) {
      await eventCacheService.removeEventFromCache(eid);
    }
    setSelectedEvents([]);
    setToast({ message: `${selectedEvents.length} event(s) deleted`, type: 'success' });
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setDateTypeFilter('all');
    setSearchQuery('');
  };

  const formatDate = (date: string) => {
    return new Date(date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
  };

  // Metrics
  const metrics = [
    {
      title: 'Total Events',
      value: events.length.toString(),
      change: `${events.filter(e => e.is_active).length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Star,
    },
    {
      title: 'Active Events',
      value: events.filter(e => e.is_active).length.toString(),
      change: `${events.filter(e => !e.is_active).length} inactive`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Zap,
    },
    {
      title: 'Avg. Price',
      value: events.length > 0
        ? `$${(events.reduce((sum, e) => sum + Number(e.price), 0) / events.length).toFixed(2)}`
        : '$0.00',
      change: 'Per event',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: DollarSign,
    },
    {
      title: 'Date Range Events',
      value: events.filter(e => e.date_type === 'date_range').length.toString(),
      change: `${events.filter(e => e.date_type === 'one_time').length} one-time`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Calendar,
    },
  ];

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const indexOfFirst = (currentPage - 1) * itemsPerPage;
  const indexOfLast = indexOfFirst + itemsPerPage;
  const paginatedEvents = filteredEvents.slice(indexOfFirst, indexOfLast);

  // Status colors
  const statusColors: Record<string, string> = {
    active: `bg-${themeColor}-100 text-${fullColor}`,
    inactive: 'bg-gray-100 text-gray-800',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600 mt-1">View and manage all events</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          {isCompanyAdmin && locations.length > 0 && (
            <LocationSelector
              variant="compact"
              locations={locations}
              selectedLocation={selectedLocation?.toString() || ''}
              onLocationChange={(id) => setSelectedLocation(id ? Number(id) : null)}
              themeColor={themeColor}
              fullColor={fullColor}
              showAllOption={true}
            />
          )}
          <StandardButton
            onClick={() => navigate('/events/create')}
            variant="primary"
            size="md"
          >
            New Event
          </StandardButton>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}>
                  <Icon size={20} />
                </div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton
              onClick={() => setShowFilters(!showFilters)}
              variant="secondary"
              size="sm"
              icon={Filter}
            >
              Filters
            </StandardButton>
            <StandardButton
              onClick={() => fetchEvents(true)}
              variant="secondary"
              size="sm"
              icon={RefreshCcw}
            >
              {''}
            </StandardButton>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Date Type</label>
                <select
                  value={dateTypeFilter}
                  onChange={(e) => setDateTypeFilter(e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Types</option>
                  <option value="one_time">One Time</option>
                  <option value="date_range">Date Range</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton
                onClick={clearFilters}
                variant="ghost"
                size="sm"
              >
                Clear Filters
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedEvents.length > 0 && (
        <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
          <span className={`text-${fullColor} font-medium`}>
            {selectedEvents.length} event(s) selected
          </span>
          <div className="flex gap-2">
            <StandardButton
              onClick={handleBulkDelete}
              variant="danger"
              size="md"
              icon={Trash2}
            >
              Delete
            </StandardButton>
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-800 uppercase bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedEvents.length === paginatedEvents.length && paginatedEvents.length > 0}
                    onChange={handleSelectAll}
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                  />
                </th>
                <th scope="col" className="px-6 py-4 font-medium">Event</th>
                <th scope="col" className="px-6 py-4 font-medium">Date</th>
                <th scope="col" className="px-6 py-4 font-medium">Time</th>
                <th scope="col" className="px-6 py-4 font-medium">Price</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-800">
                    No events found
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.id)}
                        onChange={() => handleSelectEvent(event.id)}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{event.name}</div>
                        <div className="text-xs text-gray-600 mt-1">{event.location?.name || '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {event.date_type === 'one_time' ? 'One Time' : 'Date Range'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.date_type === 'one_time' ? (
                        formatDate(event.start_date)
                      ) : (
                        <span>{formatDate(event.start_date)} – {formatDate(event.end_date!)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(event.time_start)} – {formatTime(event.time_end)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${parseFloat(event.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={event.is_active ? 'active' : 'inactive'}
                        onChange={(e) => handleToggleStatus(event.id, e.target.value)}
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[event.is_active ? 'active' : 'inactive']} border-none focus:ring-2 focus:ring-${themeColor}-400`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/events/${event.id}/edit`)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <StandardButton
                          onClick={() => handleDelete(event.id)}
                          disabled={deletingId === event.id}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-6 py-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredEvents.length}
            showingFrom={indexOfFirst + 1}
            showingTo={Math.min(indexOfLast, filteredEvents.length)}
          />
        </div>
      </div>
    </div>
  );
};

export default Events;
