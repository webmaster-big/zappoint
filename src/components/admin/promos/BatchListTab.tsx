import React, { useState, useEffect, useCallback } from "react";
import { Plus, Download, Trash2, Power, RefreshCcw, Eye } from "lucide-react";
import StandardButton from "../../ui/StandardButton";
import Toast from "../../ui/Toast";
import { useThemeColor } from "../../../hooks/useThemeColor";
import { promoService } from "../../../services";
import { getStoredUser } from "../../../utils/storage";
import type { PromoBatch } from "../../../types/Promo.types";
import GenerateBulkModal from "./GenerateBulkModal";

interface BatchListTabProps {
  onViewBatch: (batchId: string) => void;
}

const BatchListTab: React.FC<BatchListTabProps> = ({ onViewBatch }) => {
  const { themeColor, fullColor } = useThemeColor();
  const [batches, setBatches] = useState<PromoBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type?: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      const response = await promoService.getBatches();
      if (response.success) {
        setBatches(response.data);
      }
    } catch (error) {
      console.error("Error loading batches:", error);
      showToast("Error loading batches", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleGenerateBulk = async (form: {
    name: string;
    description: string;
    type: "fixed" | "percentage";
    value: string;
    start_date: string;
    end_date: string;
    quantity: string;
    code_prefix: string;
    code_length: string;
    usage_limit_per_code: string;
  }) => {
    try {
      setGenerating(true);
      const user = getStoredUser();
      const payload = {
        name: form.name,
        type: form.type,
        value: Number(form.value),
        start_date: form.start_date,
        end_date: form.end_date,
        description: form.description || undefined,
        created_by: user?.id,
        quantity: Number(form.quantity),
        code_prefix: form.code_prefix || undefined,
        code_length: form.code_length ? Number(form.code_length) : undefined,
        usage_limit_per_code: form.usage_limit_per_code ? Number(form.usage_limit_per_code) : undefined,
      };

      const response = await promoService.generateBulkCodes(payload);
      showToast(`${response.data.quantity} codes generated successfully!`, "success");
      setShowBulkModal(false);
      await loadBatches();
      // Navigate to the new batch detail
      onViewBatch(response.data.batch_id);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } };
      if (error.response?.status === 422) {
        const errors = error.response.data?.errors;
        if (errors) {
          const messages = Object.values(errors).flat();
          showToast(messages.join(". "), "error");
        } else {
          showToast(error.response.data?.message || "Validation error", "error");
        }
      } else {
        showToast("Failed to generate codes", "error");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCsv = async (batch: PromoBatch) => {
    try {
      const blob = await promoService.exportBatchCsv(batch.batch_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `promo_codes_${batch.batch_id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("CSV exported successfully!", "success");
    } catch {
      showToast("Failed to export CSV", "error");
    }
  };

  const handleDeactivateBatch = async (batch: PromoBatch) => {
    if (!window.confirm(`Are you sure you want to deactivate all ${batch.active_codes} active codes in "${batch.name}"?`)) return;
    try {
      const response = await promoService.deactivateBatch(batch.batch_id);
      showToast(`${response.data.deactivated_count} codes deactivated`, "success");
      await loadBatches();
    } catch {
      showToast("Failed to deactivate batch", "error");
    }
  };

  const handleDeleteBatch = async (batch: PromoBatch) => {
    if (!window.confirm(`This will permanently remove all ${batch.total_codes} codes in "${batch.name}". This action cannot be undone.`)) return;
    try {
      const response = await promoService.deleteBatch(batch.batch_id);
      showToast(`${response.data.deleted_count} codes deleted`, "success");
      await loadBatches();
    } catch {
      showToast("Failed to delete batch", "error");
    }
  };

  const getUsagePercent = (batch: PromoBatch) => {
    if (batch.total_codes === 0) return 0;
    return (batch.total_used / batch.total_codes) * 100;
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return "bg-red-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-500">
          {batches.length} batch{batches.length !== 1 ? "es" : ""}
        </div>
        <div className="flex gap-2">
          <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={loadBatches}>
            {""}
          </StandardButton>
          <StandardButton variant="primary" size="sm" icon={Plus} onClick={() => setShowBulkModal(true)}>
            Generate Bulk
          </StandardButton>
        </div>
      </div>

      {/* Batch List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : batches.length > 0 ? (
        <div className="space-y-4">
          {batches.map((batch) => {
            const usagePercent = getUsagePercent(batch);
            const isExpired = new Date(batch.end_date) < new Date();
            return (
              <div
                key={batch.batch_id}
                className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{batch.name}</h3>
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Expired</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                      <span className="font-medium">
                        {batch.type === "fixed" ? `$${parseFloat(batch.value).toFixed(2)} off` : `${parseFloat(batch.value)}% off`}
                      </span>
                      <span>•</span>
                      <span>{new Date(batch.start_date).toLocaleDateString()} – {new Date(batch.end_date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{batch.total_codes} codes</span>
                    </div>

                    {/* Usage Progress */}
                    <div className="mt-3 max-w-md">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{batch.total_used} used</span>
                        <span>{batch.active_codes} remaining</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${getProgressColor(usagePercent)} rounded-full h-2 transition-all`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Pills */}
                    <div className="flex gap-2 mt-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                        {batch.active_codes} active
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">
                        {batch.exhausted_codes} used
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap gap-2 lg:flex-nowrap">
                    <StandardButton variant="secondary" size="sm" icon={Eye} onClick={() => onViewBatch(batch.batch_id)}>
                      View
                    </StandardButton>
                    <StandardButton variant="secondary" size="sm" icon={Download} onClick={() => handleExportCsv(batch)}>
                      CSV
                    </StandardButton>
                    {batch.active_codes > 0 && (
                      <StandardButton
                        variant="secondary"
                        size="sm"
                        icon={Power}
                        onClick={() => handleDeactivateBatch(batch)}
                        className="text-yellow-600 hover:bg-yellow-50"
                      >
                        Deactivate
                      </StandardButton>
                    )}
                    <StandardButton variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteBatch(batch)}>
                      Delete
                    </StandardButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
            <Plus className={`w-8 h-8 text-${fullColor}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No bulk code batches yet</h3>
          <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">
            Generate unique promo codes in bulk for flyers, mailers, and campaigns
          </p>
          <StandardButton variant="primary" size="md" icon={Plus} onClick={() => setShowBulkModal(true)}>
            Generate Bulk Codes
          </StandardButton>
        </div>
      )}

      {/* Generate Bulk Modal */}
      <GenerateBulkModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSubmit={handleGenerateBulk}
        loading={generating}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default BatchListTab;
