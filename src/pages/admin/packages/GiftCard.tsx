import React, { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Copy } from "lucide-react";
import type { GiftCardStatus, GiftCardType, GiftCardItem } from '../../../types/GiftCard.types';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { giftCardService } from '../../../services';
import Toast from '../../../components/ui/Toast';

const GiftCard: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [giftCards, setGiftCards] = useState<GiftCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{
    type: GiftCardType;
    initial_value: string;
    balance: string;
    expiry_date: string;
    description: string;
    max_usage: string;
  }>({
    type: "fixed",
    initial_value: "",
    balance: "",
    expiry_date: "",
    description: "",
    max_usage: "1",
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Use string values for editForm fields for form compatibility
  const [editForm, setEditForm] = useState<null | Partial<Record<string, string>>>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Toast state
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);
  const showToast = (message: string, type?: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadGiftCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGiftCards = async () => {
    try {
      setLoading(true);
      const response = await giftCardService.getGiftCards();
      
      if (response.data && response.data.gift_cards) {
        const formattedCards: GiftCardItem[] = response.data.gift_cards.map(card => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(card as any), // Keep all backend fields including id
          code: card.code,
          type: card.type as GiftCardType,
          initial_value: Number(card.initial_value),
          balance: Number(card.balance),
          max_usage: Number(card.max_usage),
          description: card.description || '',
          status: card.status as GiftCardStatus,
          expiry_date: card.expiry_date,
          created_by: card.created_by?.toString() || 'admin',
          created_at: card.created_at,
          updated_at: card.updated_at,
          deleted: card.deleted || false
        }));
        setGiftCards(formattedCards);
      }
    } catch (error) {
      console.error('Error loading gift cards:', error);
      showToast('Error loading gift cards', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Note: Status updates for expired cards should be handled by the backend
  // This useEffect is removed to avoid localStorage dependency

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Helper to generate a unique code
  function generateGiftCardCode(): string {
    return (
      'GC-' +
      Math.random().toString(36).substring(2, 8).toUpperCase() +
      '-' +
      Date.now().toString().slice(-4)
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.initial_value.trim() || isNaN(Number(form.initial_value))) {
      showToast('Please enter a valid initial value', 'error');
      return;
    }
    if (!form.balance.trim() || isNaN(Number(form.balance))) {
      showToast('Please enter a valid balance', 'error');
      return;
    }
    if (!form.max_usage.trim() || isNaN(Number(form.max_usage))) {
      showToast('Please enter a valid max usage', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const code = generateGiftCardCode();
      
      await giftCardService.createGiftCard({
        code,
        type: form.type,
        initial_value: Number(form.initial_value),
        balance: Number(form.balance),
        max_usage: Number(form.max_usage),
        description: form.description,
        status: 'active',
        created_by: 1 // Default user ID
      });

      showToast('Gift card created successfully!', 'success');
      await loadGiftCards();
      setForm({ type: "fixed", initial_value: "", balance: "", expiry_date: "", description: "", max_usage: "1" });
      setShowModal(false);
    } catch (error) {
      console.error('Error creating gift card:', error);
      showToast('Error creating gift card', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (index: number) => {
    setEditIndex(index);
    const card = giftCards[index];
    setEditForm({
      type: card.type,
      initial_value: card.initial_value.toString(),
      balance: card.balance?.toString() || '',
      max_usage: card.max_usage.toString(),
      description: card.description || '',
      expiry_date: card.expiry_date ? card.expiry_date.slice(0, 10) : '',
      status: card.status,
    });
  };
  const closeEditModal = () => {
    setEditIndex(null);
    setEditForm(null);
  };
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleEditSave = () => {
    if (editIndex === null || !editForm) return;
    const updatedCards = [...giftCards];
    const card = { ...updatedCards[editIndex] };
    if (editForm.type) card.type = editForm.type as GiftCardType;
    if (editForm.initial_value !== undefined) card.initial_value = Number(editForm.initial_value);
    if (editForm.balance !== undefined) card.balance = Number(editForm.balance);
    if (editForm.max_usage !== undefined) card.max_usage = Number(editForm.max_usage);
    if (editForm.description !== undefined) card.description = editForm.description;
    if (editForm.expiry_date !== undefined) card.expiry_date = editForm.expiry_date ? new Date(editForm.expiry_date).toISOString() : undefined;
    if (editForm.status) card.status = editForm.status as GiftCardStatus;
    card.updated_at = new Date().toISOString();
    updatedCards[editIndex] = card;
    setGiftCards(updatedCards);
    localStorage.setItem("zapzone_giftcards", JSON.stringify(updatedCards));
    closeEditModal();
  };

  const handleDeactivate = (index: number) => {
    const updatedCards = [...giftCards];
    updatedCards[index] = {
      ...updatedCards[index],
      status: "inactive" as GiftCardStatus,
      updated_at: new Date().toISOString(),
    };
    setGiftCards(updatedCards);
    localStorage.setItem("zapzone_giftcards", JSON.stringify(updatedCards));
  };
  const handleActivate = (index: number) => {
    const updatedCards = [...giftCards];
    updatedCards[index] = {
      ...updatedCards[index],
      status: "active" as GiftCardStatus,
      updated_at: new Date().toISOString(),
    };
    setGiftCards(updatedCards);
    localStorage.setItem("zapzone_giftcards", JSON.stringify(updatedCards));
  };
  const handleDelete = async (index: number) => {
    const card = giftCards[index];
    if (!window.confirm(`Are you sure you want to delete gift card "${card.code}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const cardId = (card as unknown as { id?: number }).id;
      if (cardId) {
        await giftCardService.deleteGiftCard(cardId);
        showToast('Gift card deleted successfully!', 'success');
        await loadGiftCards();
      }
    } catch (error) {
      console.error('Error deleting gift card:', error);
      showToast('Error deleting gift card', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: GiftCardStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'redeemed': return `bg-${themeColor}-100 text-${fullColor}`;
      case 'cancelled': return 'bg-yellow-100 text-yellow-800';
      case 'deleted': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredGiftCards = giftCards.filter(card => {
    if (filterStatus === "all") return !card.deleted;
    return card.status === filterStatus && !card.deleted;
  });

  return (
      <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
        <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Gift Cards</h2>
              <p className="text-gray-500 mt-1">Create and manage gift cards for your customers</p>
            </div>
            <button
              className={`bg-${fullColor} text-white rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-${themeColor}-900 transition-colors shadow-sm`}
              onClick={() => setShowModal(true)}
            >
              <Plus className="w-5 h-5" /> New Gift Card
            </button>
          </div>

          {/* Filter Section */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "all" ? `bg-${themeColor}-100 text-${fullColor}` : "bg-gray-100 text-gray-800"}`}
              onClick={() => setFilterStatus("all")}
            >
              All
            </button>
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
              onClick={() => setFilterStatus("active")}
            >
              Active
            </button>
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "inactive" ? "bg-gray-100 text-gray-800" : "bg-gray-100 text-gray-800"}`}
              onClick={() => setFilterStatus("inactive")}
            >
              Inactive
            </button>
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "expired" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}
              onClick={() => setFilterStatus("expired")}
            >
              Expired
            </button>
          </div>

          {/* Gift Cards Grid */}
          {filteredGiftCards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGiftCards.map((gc, i) => {
                const isExpired = gc.expiry_date && new Date(gc.expiry_date) < new Date();
                const status = isExpired ? 'inactive' : gc.status;
                const originalIndex = giftCards.findIndex(card => card.code === gc.code);
                
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
                          onClick={() => openEditModal(originalIndex)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {status === 'active' ? (
                          <button 
                            className="p-1.5 text-gray-500 hover:text-yellow-800 hover:bg-yellow-50 rounded-md"
                            onClick={() => handleDeactivate(originalIndex)}
                            title="Deactivate"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            className="p-1.5 text-gray-500 hover:text-green-800 hover:bg-green-50 rounded-md"
                            onClick={() => handleActivate(originalIndex)}
                            title="Activate"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          className="p-1.5 text-gray-500 hover:text-red-800 hover:bg-red-50 rounded-md"
                          onClick={() => handleDelete(originalIndex)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-gray-900">Gift Card Code</h3>
                        <button 
                          onClick={() => copyToClipboard(gc.code)}
                          className={`text-${fullColor} hover:text-${themeColor}-900`}
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="font-mono bg-gray-50 p-2.5 rounded-lg text-sm">
                        {gc.code}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <span>Value</span>
                        </div>
                        <div className="font-medium">
                          {gc.type === "fixed" ? `$${gc.initial_value}` : `${gc.initial_value}%`}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <span>Balance</span>
                        </div>
                        <div className="font-medium">
                          {gc.type === "fixed" ? `$${gc.balance}` : `${gc.balance}%`}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <span>Expires</span>
                        </div>
                        <div className="font-medium">
                          {gc.expiry_date ? gc.expiry_date.slice(0, 10) : 'No expiry'}
                        </div>
                      </div>
                    </div>

                    {gc.description && (
                      <div className="mb-4">
                        <div className="text-sm text-gray-500 mb-1">Description</div>
                        <div className="text-sm">{gc.description}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl">
              <div className="text-gray-400 mb-2">No gift cards found</div>
              <p className="text-gray-500 text-sm mb-4">Create your first gift card to get started</p>
              <button
                className={`bg-${fullColor} text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-${themeColor}-900 transition-colors mx-auto shadow-sm`}
                onClick={() => setShowModal(true)}
              >
                <Plus className="w-4 h-4" /> Create Gift Card
              </button>
            </div>
          )}
        </div>
        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative animate-fade-in-up border border-gray-200 m-4">
              <button className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Create Gift Card</h3>
              <form className="space-y-4" onSubmit={handleAdd}>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Type</label>
                  <select 
                    name="type" 
                    value={form.type} 
                    onChange={handleChange} 
                    className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                  >
                    <option value="fixed">Fixed Value</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">
                    {form.type === "fixed" ? "Value ($)" : "Percentage (%)"}
                  </label>
                  <input 
                    type="number" 
                    name="initial_value" 
                    value={form.initial_value} 
                    onChange={handleChange} 
                    className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    min="0" 
                    required 
                    placeholder={form.type === "fixed" ? "0.00" : "0"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">
                    {form.type === "fixed" ? "Balance ($)" : "Balance (%)"}
                  </label>
                  <input 
                    type="number" 
                    name="balance" 
                    value={form.balance} 
                    onChange={handleChange} 
                    className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    min="0" 
                    required 
                    placeholder={form.type === "fixed" ? "0.00" : "0"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Max Usage</label>
                  <input 
                    type="number" 
                    name="max_usage" 
                    value={form.max_usage} 
                    onChange={handleChange} 
                    className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    min="1" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Expiry Date</label>
                  <input 
                    type="date" 
                    name="expiry_date" 
                    value={form.expiry_date} 
                    onChange={handleChange} 
                    className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                  />
                </div>
                <div>
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
                <button 
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-${fullColor} text-white py-2.5 rounded-lg font-medium mt-2 hover:bg-${themeColor}-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Creating...' : 'Create Gift Card'}
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
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Edit Gift Card</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Type</label>
                    <select 
                      name="type" 
                      value={editForm.type || ''} 
                      onChange={handleEditChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    >
                      <option value="fixed">Fixed Value</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">{editForm.type === "fixed" ? "Value ($)" : "Percentage (%)"}</label>
                    <input 
                      type="number" 
                      name="initial_value" 
                      value={editForm.initial_value || ''} 
                      onChange={handleEditChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="0" 
                      required 
                      placeholder={editForm.type === "fixed" ? "0.00" : "0"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">{editForm.type === "fixed" ? "Balance ($)" : "Balance (%)"}</label>
                    <input 
                      type="number" 
                      name="balance" 
                      value={editForm.balance || ''} 
                      onChange={handleEditChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="0" 
                      required 
                      placeholder={editForm.type === "fixed" ? "0.00" : "0"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Max Usage</label>
                    <input 
                      type="number" 
                      name="max_usage" 
                      value={editForm.max_usage || ''} 
                      onChange={handleEditChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      min="1" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Expiry Date</label>
                    <input 
                      type="date" 
                      name="expiry_date" 
                      value={editForm.expiry_date || ''} 
                      onChange={handleEditChange} 
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    value={editForm.description || ''} 
                    onChange={handleEditChange} 
                    className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    rows={2} 
                    placeholder="Optional description"
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
                    <option value="redeemed">Redeemed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={handleEditSave} 
                    className={`flex-1 bg-${fullColor} hover:bg-${themeColor}-900 text-white font-medium py-2.5 rounded-lg transition text-base`}
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={closeEditModal} 
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition text-base"
                  >
                    Cancel
                  </button>
                </div>
              </div>
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

export default GiftCard;