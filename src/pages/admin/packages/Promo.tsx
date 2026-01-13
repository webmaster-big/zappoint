import React, { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Copy, Search, Filter, RefreshCcw } from "lucide-react";
import StandardButton from '../../../components/ui/StandardButton';
import type { PromoStatus, PromoType, PromoItem } from '../../../types/Promo.types';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { promoService } from '../../../services';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from "../../../utils/storage";

const Promo: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<null | Partial<PromoItem>>(null);
  
  const [form, setForm] = useState({
    type: "fixed" as PromoType,
    value: "",
    code: "",
    start_date: "",
    end_date: "",
    usage_limit_total: "",
    usage_limit_per_user: "",
    description: "",
  });

  // Toast state
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);
  const showToast = (message: string, type?: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPromos = async () => {
    try {
      setLoading(true);
      const response = await promoService.getPromos();
      
      if (response.data && response.data.promos) {
        const formattedPromos: PromoItem[] = response.data.promos.map(promo => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(promo as any), // Keep all backend fields including id
          code: promo.code,
          type: promo.type as PromoType,
          value: Number(promo.value), // Ensure it's a number
          start_date: promo.start_date,
          end_date: promo.end_date,
          usage_limit_total: Number(promo.usage_limit_total || 0),
          usage_limit_per_user: Number(promo.usage_limit_per_user),
          status: promo.status as PromoStatus,
          description: promo.description || '',
          created_by: promo.created_by?.toString() || 'admin',
          created_at: promo.created_at,
          updated_at: promo.updated_at,
          deleted: promo.deleted || false
        }));
        setPromos(formattedPromos);
      }
    } catch (error) {
      console.error('Error loading promos:', error);
      showToast('Error loading promo codes', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Note: Status updates for expired promos should be handled by the backend
  // This useEffect is removed to avoid localStorage dependency and infinite loops

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Helper to generate a unique code
  function generatePromoCode(): string {
    return (
      'PROMO-' +
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.value.trim() || isNaN(Number(form.value))) {
      showToast('Please enter a valid value', 'error');
      return;
    }
    if (!form.usage_limit_total.trim() || isNaN(Number(form.usage_limit_total))) {
      showToast('Please enter a valid usage limit', 'error');
      return;
    }
    if (!form.usage_limit_per_user.trim() || isNaN(Number(form.usage_limit_per_user))) {
      showToast('Please enter a valid usage limit per user', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const code = form.code || generatePromoCode();
      const now = new Date().toISOString();
      
      await promoService.createPromo({
        name: code, // Using code as name
        code,
        type: form.type,
        value: Number(form.value),
        start_date: form.start_date || now.split('T')[0],
        end_date: form.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        usage_limit_per_user: Number(form.usage_limit_per_user),
        description: form.description,
        status: 'active',
        created_by: getStoredUser()?.id
      });

      showToast('Promo code created successfully!', 'success');
      await loadPromos();
      setForm({
        type: "fixed",
        value: "",
        code: "",
        start_date: "",
        end_date: "",
        usage_limit_total: "",
        usage_limit_per_user: "",
        description: "",
      });
      setShowModal(false);
    } catch (error) {
      console.error('Error creating promo:', error);
      showToast('Error creating promo code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (index: number) => {
    setEditIndex(index);
    const promo = promos[index];
    setEditForm({
      type: promo.type,
      value: promo.value,
      start_date: promo.start_date ? promo.start_date.slice(0, 10) : '',
      end_date: promo.end_date ? promo.end_date.slice(0, 10) : '',
      usage_limit_total: promo.usage_limit_total,
      usage_limit_per_user: promo.usage_limit_per_user,
      status: promo.status,
      description: promo.description,
    });
  };

  const closeEditModal = () => {
    setEditIndex(null);
    setEditForm(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]:
        ["value", "usage_limit_total", "usage_limit_per_user"].includes(name)
          ? value === "" ? "" : Number(value)
          : value
    }));
  };

  const handleEditSave = () => {
    if (editIndex === null || !editForm) return;
    const updatedPromos = [...promos];
    const promo = { ...updatedPromos[editIndex] };
    if (editForm.type) promo.type = editForm.type as PromoType;
    if (editForm.value !== undefined) promo.value = Number(editForm.value);
    if (editForm.start_date !== undefined) promo.start_date = editForm.start_date ? new Date(editForm.start_date).toISOString() : '';
    if (editForm.end_date !== undefined) promo.end_date = editForm.end_date ? new Date(editForm.end_date).toISOString() : '';
    if (editForm.usage_limit_total !== undefined) promo.usage_limit_total = Number(editForm.usage_limit_total);
    if (editForm.usage_limit_per_user !== undefined) promo.usage_limit_per_user = Number(editForm.usage_limit_per_user);
    if (editForm.status) promo.status = editForm.status as PromoStatus;
    if (editForm.description !== undefined) promo.description = editForm.description;
    promo.updated_at = new Date().toISOString();
    updatedPromos[editIndex] = promo;
    setPromos(updatedPromos);
    localStorage.setItem("zapzone_promos", JSON.stringify(updatedPromos));
    closeEditModal();
  };

  const handleDeactivate = (index: number) => {
    const updatedPromos = [...promos];
    updatedPromos[index] = {
      ...updatedPromos[index],
      status: "inactive" as PromoStatus,
      updated_at: new Date().toISOString(),
    };
    setPromos(updatedPromos);
    localStorage.setItem("zapzone_promos", JSON.stringify(updatedPromos));
  };

  const handleActivate = (index: number) => {
    const updatedPromos = [...promos];
    updatedPromos[index] = {
      ...updatedPromos[index],
      status: "active" as PromoStatus,
      updated_at: new Date().toISOString(),
    };
    setPromos(updatedPromos);
    localStorage.setItem("zapzone_promos", JSON.stringify(updatedPromos));
  };

  const handleDelete = async (index: number) => {
    const promo = promos[index];
    if (!window.confirm(`Are you sure you want to delete promo "${promo.code}"?`)) {
      return;
    }

    try {
      setLoading(true);
      // Assuming promo has an id field from backend
      const promoId = (promo as unknown as { id?: number }).id;
      if (promoId) {
        await promoService.deletePromo(promoId);
        showToast('Promo deleted successfully!', 'success');
        await loadPromos();
      }
    } catch (error) {
      console.error('Error deleting promo:', error);
      showToast('Error deleting promo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: PromoStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'exhausted': return `bg-${themeColor}-100 text-${fullColor}`;
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredPromos = promos.filter(promo => {
    if (promo.deleted) return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!promo.code.toLowerCase().includes(search) && 
          !promo.description?.toLowerCase().includes(search)) {
        return false;
      }
    }
    
    // Status filter
    if (filterStatus !== "all" && promo.status !== filterStatus) {
      return false;
    }
    
    return true;
  });

  // Clear filters function
  const clearFilters = () => {
    setFilterStatus("all");
    setSearchTerm("");
  };

  return (
    <div className="px-6 py-8">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promo Codes</h1>
          <p className="text-gray-600 mt-2">Create and manage promotional codes</p>
        </div>
        <StandardButton
          onClick={() => setShowModal(true)}
          variant="primary"
          size="md"
          icon={Plus}
        >
          Create Promo Code
        </StandardButton>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

        {/* Search and Filter Section */}
        <div className="mb-6">
          {/* Search Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-600" />
              </div>
              <input
                type="text"
                placeholder="Search promo codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
              />
            </div>
            <div className="flex gap-1">
              <StandardButton
                variant="secondary"
                size="sm"
                icon={Filter}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </StandardButton>
              <StandardButton
                variant="secondary"
                size="sm"
                icon={RefreshCcw}
                onClick={() => loadPromos()}
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
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="expired">Expired</option>
                    <option value="exhausted">Exhausted</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <StandardButton
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear Filters
                </StandardButton>
              </div>
            </div>
          )}

          {/* Results count */}
          <div className="text-sm text-gray-500 mt-3">
            Showing {filteredPromos.length} promo code{filteredPromos.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Promos Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredPromos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPromos.map((promo, i) => {
                const isExpired = promo.end_date && new Date(promo.end_date) < new Date();
                const status = isExpired ? 'expired' : promo.status;
                
                return (
                  <div key={i} className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg hover:scale-105 hover:border-gray-300 transition-all bg-white">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {isExpired && <span className="text-xs text-red-500">Expired</span>}
                      </div>
                      <div className="flex gap-1">
                        <StandardButton 
                          onClick={() => openEditModal(i)}
                          variant="ghost"
                          size="sm"
                          className="p-1.5"
                          icon={Edit2}
                        />
                        {status === 'active' ? (
                          <StandardButton 
                            onClick={() => handleDeactivate(i)}
                            variant="ghost"
                            size="sm"
                            className="p-1.5 text-yellow-600 hover:bg-yellow-50"
                            icon={EyeOff}
                            title="Deactivate"
                          />
                        ) : (
                          <StandardButton 
                            onClick={() => handleActivate(i)}
                            variant="ghost"
                            size="sm"
                            className="p-1.5 text-green-600 hover:bg-green-50"
                            icon={Eye}
                            title="Activate"
                          />
                        )}
                        <StandardButton 
                          onClick={() => handleDelete(i)}
                          variant="danger"
                          size="sm"
                          className="p-1.5"
                          icon={Trash2}
                          title="Delete"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-gray-900">Promo Code</h3>
                        <StandardButton 
                          onClick={() => copyToClipboard(promo.code)}
                          variant="secondary"
                          size="sm"
                          icon={Copy}
                          title="Copy code"
                        />
                      </div>
                      <div className="font-mono bg-gray-50 p-2.5 rounded-lg text-sm">
                        {promo.code}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <span>Discount</span>
                        </div>
                        <div className="font-medium">
                          {promo.type === "fixed" ? `$${promo.value}` : `${promo.value}%`}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <span>Total Uses</span>
                        </div>
                        <div className="font-medium">
                          {promo.usage_limit_total}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <span>Per User</span>
                        </div>
                        <div className="font-medium">
                          {promo.usage_limit_per_user}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <span>Expires</span>
                        </div>
                        <div className="font-medium">
                          {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : 'No expiry'}
                        </div>
                      </div>
                    </div>

                    {promo.description && (
                      <div className="mb-4">
                        <div className="text-sm text-gray-500 mb-1">Description</div>
                        <div className="text-sm">{promo.description}</div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16">
              <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
                <Plus className={`w-8 h-8 text-${fullColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No promo codes found</h3>
              <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">Create your first promo code to get started</p>
              <StandardButton
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => setShowModal(true)}
              >
                Create Promo Code
              </StandardButton>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative border border-gray-200 m-4 max-h-[90vh] overflow-y-auto">
            <StandardButton 
              className="absolute top-4 right-4" 
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => setShowModal(false)}
            />
            <h3 className="text-xl font-semibold mb-4 text-gray-900">Create Promo Code</h3>
            <form onSubmit={handleAdd}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Type</label>
                    <select 
                      name="type" 
                      value={form.type} 
                      onChange={handleChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                      {form.type === "fixed" ? "Discount Value ($)" : "Discount Percentage (%)"}
                    </label>
                    <input 
                      type="number" 
                      name="value" 
                      value={form.value} 
                      onChange={handleChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="0" 
                      required 
                      placeholder={form.type === "fixed" ? "0.00" : "0"}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-800 mb-1">Promo Code</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        name="code" 
                        value={form.code} 
                        onChange={handleChange} 
                        className={`flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                        placeholder="Leave empty to auto-generate"
                      />
                      <StandardButton 
                        type="button" 
                        variant="secondary"
                        size="md"
                        onClick={() => setForm({...form, code: generatePromoCode()})}
                      >
                        Generate
                      </StandardButton>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Start Date</label>
                    <input 
                      type="date" 
                      name="start_date" 
                      value={form.start_date} 
                      onChange={handleChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">End Date</label>
                    <input 
                      type="date" 
                      name="end_date" 
                      value={form.end_date} 
                      onChange={handleChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Total Usage Limit</label>
                    <input 
                      type="number" 
                      name="usage_limit_total" 
                      value={form.usage_limit_total} 
                      onChange={handleChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="1" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Usage Limit Per User</label>
                    <input 
                      type="number" 
                      name="usage_limit_per_user" 
                      value={form.usage_limit_per_user} 
                      onChange={handleChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="1" 
                      required 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-800 mb-1">Description</label>
                    <textarea 
                      name="description" 
                      value={form.description} 
                      onChange={handleChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      rows={2} 
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <StandardButton 
                  type="submit"
                  disabled={loading}
                  variant="primary"
                  size="md"
                  loading={loading}
                  fullWidth
                >
                  {loading ? 'Creating...' : 'Create Promo Code'}
                </StandardButton>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editIndex !== null && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative border border-gray-200 m-4">
            <StandardButton 
              className="absolute top-4 right-4" 
              variant="ghost"
              size="sm"
              icon={X}
              onClick={closeEditModal}
            />
            <h3 className="text-xl font-semibold mb-4 text-gray-900">Edit Promo Code</h3>
            <form onSubmit={e => { e.preventDefault(); handleEditSave(); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Type</label>
                    <select
                      name="type"
                      value={editForm.type || ''}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">{editForm.type === "fixed" ? "Discount Value ($)" : "Discount Percentage (%)"}</label>
                    <input
                      type="number"
                      name="value"
                      value={editForm.value === undefined ? '' : editForm.value}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      value={editForm.start_date || ''}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">End Date</label>
                    <input
                      type="date"
                      name="end_date"
                      value={editForm.end_date || ''}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Total Usage Limit</label>
                    <input
                      type="number"
                      name="usage_limit_total"
                      value={editForm.usage_limit_total === undefined ? '' : editForm.usage_limit_total}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Usage Limit Per User</label>
                    <input
                      type="number"
                      name="usage_limit_per_user"
                      value={editForm.usage_limit_per_user === undefined ? '' : editForm.usage_limit_per_user}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Status</label>
                    <select
                      name="status"
                      value={editForm.status || ''}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="expired">Expired</option>
                      <option value="exhausted">Exhausted</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-800 mb-1">Description</label>
                    <textarea
                      name="description"
                      value={editForm.description || ''}
                      onChange={handleEditChange}
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <StandardButton
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                  >
                    Save Changes
                  </StandardButton>
                  <StandardButton
                    onClick={closeEditModal}
                    variant="secondary"
                    size="md"
                    fullWidth
                  >
                    Cancel
                  </StandardButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
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

export default Promo;