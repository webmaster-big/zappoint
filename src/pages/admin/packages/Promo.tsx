import React, { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Copy } from "lucide-react";
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
    if (filterStatus === "all") return !promo.deleted;
    return promo.status === filterStatus && !promo.deleted;
  });

  return (
      <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
        <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Promo Codes</h2>
              <p className="text-gray-500 mt-1">Create and manage promotional codes</p>
            </div>
            <button
              className={`bg-${fullColor} text-white rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-${themeColor}-900 transition-colors shadow-sm`}
              onClick={() => setShowModal(true)}
            >
              <Plus className="w-5 h-5" /> New Promo Code
            </button>
          </div>

          {/* Filter Section */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "all" ? `bg-${themeColor}-100 text-${fullColor}` : "bg-gray-100 text-gray-600"}`}
              onClick={() => setFilterStatus("all")}
            >
              All
            </button>
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
              onClick={() => setFilterStatus("active")}
            >
              Active
            </button>
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "inactive" ? "bg-gray-100 text-gray-800" : "bg-gray-100 text-gray-600"}`}
              onClick={() => setFilterStatus("inactive")}
            >
              Inactive
            </button>
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "expired" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600"}`}
              onClick={() => setFilterStatus("expired")}
            >
              Expired
            </button>
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "exhausted" ? `bg-${themeColor}-100 text-${fullColor}` : "bg-gray-100 text-gray-600"}`}
              onClick={() => setFilterStatus("exhausted")}
            >
              Exhausted
            </button>
          </div>

          {/* Promos Grid */}
          {filteredPromos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPromos.map((promo, i) => {
                const isExpired = promo.end_date && new Date(promo.end_date) < new Date();
                const status = isExpired ? 'expired' : promo.status;
                
                return (
                  <div key={i} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {isExpired && <span className="text-xs text-red-500">Expired</span>}
                      </div>
                      <div className="flex gap-1">
                        <button 
                          className={`p-1.5 text-gray-500 hover:text-${fullColor} hover:bg-${themeColor}-50 rounded-md`}
                          onClick={() => openEditModal(i)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {status === 'active' ? (
                          <button 
                            className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md"
                            onClick={() => handleDeactivate(i)}
                            title="Deactivate"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md"
                            onClick={() => handleActivate(i)}
                            title="Activate"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                          onClick={() => handleDelete(i)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-gray-900">Promo Code</h3>
                        <button 
                          onClick={() => copyToClipboard(promo.code)}
                          className={`text-${fullColor} hover:text-${themeColor}-900`}
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
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
            <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl">
              <div className="text-gray-400 mb-2">No promo codes found</div>
              <p className="text-gray-500 text-sm mb-4">Create your first promo code to get started</p>
              <button
                className={`bg-${fullColor} text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-${themeColor}-900 transition-colors mx-auto shadow-sm`}
                onClick={() => setShowModal(true)}
              >
                <Plus className="w-4 h-4" /> Create Promo Code
              </button>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative animate-fade-in-up border border-gray-200 m-4 max-h-[90vh] overflow-y-auto">
              <button className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
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
                      <button 
                        type="button" 
                        className="px-3 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                        onClick={() => setForm({...form, code: generatePromoCode()})}
                      >
                        Generate
                      </button>
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
                <button 
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-${fullColor} text-white py-2.5 rounded-lg font-medium mt-2 hover:bg-${themeColor}-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Creating...' : 'Create Promo Code'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editIndex !== null && editForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative animate-fade-in-up border border-gray-200 m-4">
              <button className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100" onClick={closeEditModal}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
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
                  <button
                    type="submit"
                    className={`flex-1 bg-${fullColor} hover:bg-${themeColor}-900 text-white font-medium py-2.5 rounded-lg transition text-base`}
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition text-base"
                  >
                    Cancel
                  </button>
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