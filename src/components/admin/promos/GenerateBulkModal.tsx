import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import StandardButton from "../../ui/StandardButton";
import { useThemeColor } from "../../../hooks/useThemeColor";
import type { PromoType } from "../../../types/Promo.types";

interface GenerateBulkForm {
  name: string;
  description: string;
  type: PromoType;
  value: string;
  start_date: string;
  end_date: string;
  quantity: string;
  code_prefix: string;
  code_length: string;
  usage_limit_per_code: string;
}

interface GenerateBulkModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: GenerateBulkForm) => Promise<void>;
  loading: boolean;
}

const initialForm: GenerateBulkForm = {
  name: "",
  description: "",
  type: "fixed",
  value: "",
  start_date: "",
  end_date: "",
  quantity: "100",
  code_prefix: "",
  code_length: "8",
  usage_limit_per_code: "1",
};

const GenerateBulkModal: React.FC<GenerateBulkModalProps> = ({ open, onClose, onSubmit, loading }) => {
  const { themeColor } = useThemeColor();
  const [form, setForm] = useState<GenerateBulkForm>(initialForm);

  // Reset form when modal opens
  useEffect(() => {
    if (open) setForm(initialForm);
  }, [open]);

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const quantity = parseInt(form.quantity) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg relative border border-gray-200 m-4 max-h-[90vh] overflow-y-auto">
        <StandardButton
          className="absolute top-4 right-4"
          variant="ghost"
          size="sm"
          icon={X}
          onClick={onClose}
        />
        <h3 className="text-xl font-semibold mb-6 text-gray-900">Generate Bulk Promo Codes</h3>

        <form onSubmit={handleSubmit}>
          {/* Campaign Info */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-800 mb-1">Campaign Name *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Spring Flyer Campaign"
              className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-800 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              placeholder="Optional internal description"
              className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
            />
          </div>

          {/* Discount Settings */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Discount Settings</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Type *</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                >
                  <option value="fixed">Fixed Amount ($)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Value * {form.type === "percentage" ? "(%)" : "($)"}
                </label>
                <input
                  type="number"
                  name="value"
                  value={form.value}
                  onChange={handleChange}
                  min="0"
                  step={form.type === "fixed" ? "0.01" : "1"}
                  max={form.type === "percentage" ? "100" : undefined}
                  required
                  placeholder="0"
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>
            </div>
          </div>

          {/* Validity Period */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Validity Period</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Start Date *</label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  required
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">End Date *</label>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                  required
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>
            </div>
          </div>

          {/* Code Generation Settings */}
          <div className="border-t border-gray-200 pt-4 mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Code Generation Settings</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Quantity * <span className="text-gray-400 font-normal">(max 1000)</span></label>
                <input
                  type="number"
                  name="quantity"
                  value={form.quantity}
                  onChange={handleChange}
                  min="1"
                  max="1000"
                  required
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Code Prefix <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  name="code_prefix"
                  value={form.code_prefix}
                  onChange={handleChange}
                  maxLength={10}
                  placeholder="e.g. ZAP"
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Code Length <span className="text-gray-400 font-normal">(4–16)</span></label>
                <input
                  type="number"
                  name="code_length"
                  value={form.code_length}
                  onChange={handleChange}
                  min="4"
                  max="16"
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Uses Per Code</label>
                <input
                  type="number"
                  name="usage_limit_per_code"
                  value={form.usage_limit_per_code}
                  onChange={handleChange}
                  min="1"
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <StandardButton
              variant="secondary"
              size="md"
              onClick={onClose}
              type="button"
              fullWidth
            >
              Cancel
            </StandardButton>
            <StandardButton
              type="submit"
              disabled={loading}
              variant="primary"
              size="md"
              loading={loading}
              fullWidth
            >
              {loading ? "Generating..." : `Generate ${quantity > 0 ? quantity : ""} Code${quantity !== 1 ? "s" : ""}`}
            </StandardButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GenerateBulkModal;
