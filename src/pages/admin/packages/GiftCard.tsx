import React, { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Copy } from "lucide-react";

// --- Gift Card Data Model ---
export type GiftCardStatus = "active" | "inactive" | "expired" | "redeemed" | "cancelled" | "deleted";
export type GiftCardType = "fixed" | "percentage";

export interface GiftCard {
  code: string;
  type: GiftCardType;
  initial_value: number;
  max_usage: number;
  remaining_usage: number;
  description: string;
  status: GiftCardStatus;
  expiry_date?: string; // ISO string
  created_by: string; // admin id
  created_at: string; // ISO string
  updated_at?: string; // ISO string
  deleted?: boolean;
}

const GiftCard: React.FC = () => {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{
    type: GiftCardType;
    initial_value: string;
    expiry_date: string;
    description: string;
    max_usage: string;
  }>({
    type: "fixed",
    initial_value: "",
    expiry_date: "",
    description: "",
    max_usage: "1",
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Use string values for editForm fields for form compatibility
  const [editForm, setEditForm] = useState<null | Partial<Record<string, string>>>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    const stored = localStorage.getItem("zapzone_giftcards");
    if (stored) setGiftCards(JSON.parse(stored));
  }, []);

  useEffect(() => {
    // On mount, update status to 'inactive' for expired cards
    const now = new Date();
    let updated = false;
    const updatedCards = giftCards.map(card => {
      if (card.expiry_date && new Date(card.expiry_date) < now && card.status !== 'inactive') {
        updated = true;
        return { ...card, status: 'inactive' as GiftCardStatus };
      }
      return card;
    });
    if (updated) {
      setGiftCards(updatedCards);
      localStorage.setItem("zapzone_giftcards", JSON.stringify(updatedCards));
    }
    // eslint-disable-next-line
  }, []);

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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.initial_value.trim() || isNaN(Number(form.initial_value))) return;
    if (!form.max_usage.trim() || isNaN(Number(form.max_usage))) return;
    const now = new Date().toISOString();
    const code = generateGiftCardCode();
    const initialValue = Number(form.initial_value);
    const maxUsage = Number(form.max_usage);
    const newCard: GiftCard = {
      code,
      type: form.type,
      initial_value: initialValue,
  // removed remaining_balance
      max_usage: maxUsage,
      remaining_usage: maxUsage,
      description: form.description,
      status: "active",
      expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : undefined,
      created_by: "admin1",
      created_at: now,
    };
    const updated = [...giftCards, newCard];
    setGiftCards(updated);
    localStorage.setItem("zapzone_giftcards", JSON.stringify(updated));
    setForm({ type: "fixed", initial_value: "", expiry_date: "", description: "", max_usage: "1" });
    setShowModal(false);
  };

  const openEditModal = (index: number) => {
    setEditIndex(index);
    const card = giftCards[index];
    setEditForm({
      type: card.type,
      initial_value: card.initial_value.toString(),
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
  const handleDelete = (index: number) => {
    const updatedCards = [...giftCards];
    updatedCards[index] = {
      ...updatedCards[index],
      status: "deleted" as GiftCardStatus,
      deleted: true,
      updated_at: new Date().toISOString(),
    };
    setGiftCards(updatedCards);
    localStorage.setItem("zapzone_giftcards", JSON.stringify(updatedCards));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: GiftCardStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'redeemed': return 'bg-blue-100 text-blue-800';
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
              className="bg-blue-600 text-white rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
              onClick={() => setShowModal(true)}
            >
              <Plus className="w-5 h-5" /> New Gift Card
            </button>
          </div>

          {/* Filter Section */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button 
              className={`px-3 py-1.5 rounded-full text-sm ${filterStatus === "all" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}
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
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                          onClick={() => openEditModal(originalIndex)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {status === 'active' ? (
                          <button 
                            className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md"
                            onClick={() => handleDeactivate(originalIndex)}
                            title="Deactivate"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md"
                            onClick={() => handleActivate(originalIndex)}
                            title="Activate"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
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
                          className="text-blue-700 hover:text-blue-700"
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
                            <span>Usage</span>
                          </div>
                          <div className="font-medium">
                            {gc.remaining_usage} / {gc.max_usage}
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
                className="bg-blue-600 text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-blue-700 transition-colors mx-auto shadow-sm"
                onClick={() => setShowModal(true)}
              >
                <Plus className="w-4 h-4" /> Create Gift Card
              </button>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative animate-fade-in-up border border-gray-200 m-4">
              <button className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Create Gift Card</h3>
              <form className="space-y-4" onSubmit={handleAdd}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select 
                    name="type" 
                    value={form.type} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                  >
                    <option value="fixed">Fixed Value</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.type === "fixed" ? "Value ($)" : "Percentage (%)"}
                  </label>
                  <input 
                    type="number" 
                    name="initial_value" 
                    value={form.initial_value} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                    min="0" 
                    required 
                    placeholder={form.type === "fixed" ? "0.00" : "0"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Usage</label>
                  <input 
                    type="number" 
                    name="max_usage" 
                    value={form.max_usage} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                    min="1" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input 
                    type="date" 
                    name="expiry_date" 
                    value={form.expiry_date} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    value={form.description} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                    rows={2} 
                    placeholder="Optional description"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium mt-2 hover:bg-blue-700 transition-colors"
                >
                  Create Gift Card
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editIndex !== null && editForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative animate-fade-in-up border border-gray-200 m-4">
              <button className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100" onClick={closeEditModal}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Edit Gift Card</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select 
                      name="type" 
                      value={editForm.type || ''} 
                      onChange={handleEditChange} 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                    >
                      <option value="fixed">Fixed Value</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{editForm.type === "fixed" ? "Value ($)" : "Percentage (%)"}</label>
                    <input 
                      type="number" 
                      name="initial_value" 
                      value={editForm.initial_value || ''} 
                      onChange={handleEditChange} 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                      min="0" 
                      required 
                      placeholder={editForm.type === "fixed" ? "0.00" : "0"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Usage</label>
                    <input 
                      type="number" 
                      name="max_usage" 
                      value={editForm.max_usage || ''} 
                      onChange={handleEditChange} 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                      min="1" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input 
                      type="date" 
                      name="expiry_date" 
                      value={editForm.expiry_date || ''} 
                      onChange={handleEditChange} 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    value={editForm.description || ''} 
                    onChange={handleEditChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700" 
                    rows={2} 
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    name="status" 
                    value={editForm.status || ''} 
                    onChange={handleEditChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
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
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition text-base"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={closeEditModal} 
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition text-base"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default GiftCard;