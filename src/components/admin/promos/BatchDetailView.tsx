import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Download, Power, Trash2, Search, Eye, EyeOff, RefreshCcw } from "lucide-react";
import StandardButton from "../../ui/StandardButton";
import Pagination from "../../ui/Pagination";
import Toast from "../../ui/Toast";
import { useThemeColor } from "../../../hooks/useThemeColor";
import { promoService } from "../../../services";
import type { PromoItem, BatchSummary, BatchDetailFilters, PromoStatus } from "../../../types/Promo.types";

interface BatchDetailViewProps {
  batchId: string;
  onBack: () => void;
}

const BatchDetailView: React.FC<BatchDetailViewProps> = ({ batchId, onBack }) => {
  const { themeColor } = useThemeColor();
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [batchName, setBatchName] = useState("");
  const [batchMeta, setBatchMeta] = useState<{ type: string; value: string; start_date: string; end_date: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 50, total: 0, from: null as number | null, to: null as number | null });
  const [filters, setFilters] = useState<BatchDetailFilters>({ per_page: 50, page: 1 });
  const [searchCode, setSearchCode] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [usedFilter, setUsedFilter] = useState<string>("all");
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type?: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBatchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const queryFilters: BatchDetailFilters = { ...filters };
      if (statusFilter !== "all") queryFilters.status = statusFilter as PromoStatus;
      if (usedFilter === "used") queryFilters.used = true;
      else if (usedFilter === "unused") queryFilters.used = false;

      const response = await promoService.getBatchDetail(batchId, queryFilters);
      if (response.success) {
        const data = response.data;
        setSummary(data.summary);
        setPagination(data.pagination);

        // Extract batch name & meta from first promo if available
        if (data.promos.length > 0) {
          const first = data.promos[0];
          setBatchName(first.name);
          setBatchMeta({
            type: first.type,
            value: String(first.value),
            start_date: first.start_date,
            end_date: first.end_date,
          });
        }

        setPromos(data.promos.map(p => ({
          ...p,
          value: Number(p.value),
          usage_limit_total: p.usage_limit_total ? Number(p.usage_limit_total) : null,
          usage_limit_per_user: Number(p.usage_limit_per_user),
          current_usage: Number(p.current_usage),
          created_by: Number(p.created_by),
        })));
      }
    } catch (error) {
      console.error("Error loading batch detail:", error);
      showToast("Error loading batch details", "error");
    } finally {
      setLoading(false);
    }
  }, [batchId, filters, statusFilter, usedFilter]);

  useEffect(() => {
    loadBatchDetail();
  }, [loadBatchDetail]);

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleExportCsv = async () => {
    try {
      const blob = await promoService.exportBatchCsv(batchId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `promo_codes_${batchId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("CSV exported!", "success");
    } catch {
      showToast("Failed to export CSV", "error");
    }
  };

  const handleDeactivateAll = async () => {
    if (!summary || summary.active_codes === 0) return;
    if (!window.confirm(`Are you sure you want to deactivate all ${summary.active_codes} active codes in this batch?`)) return;
    try {
      const response = await promoService.deactivateBatch(batchId);
      showToast(`${response.data.deactivated_count} codes deactivated`, "success");
      await loadBatchDetail();
    } catch {
      showToast("Failed to deactivate batch", "error");
    }
  };

  const handleDeleteBatch = async () => {
    if (!summary) return;
    if (!window.confirm(`This will permanently remove all ${summary.total_codes} codes in "${batchName}". This action cannot be undone.`)) return;
    try {
      await promoService.deleteBatch(batchId);
      showToast("Batch deleted", "success");
      onBack();
    } catch {
      showToast("Failed to delete batch", "error");
    }
  };

  const handleToggleCode = async (promo: PromoItem) => {
    try {
      await promoService.togglePromoStatus(promo.id);
      await loadBatchDetail();
    } catch {
      showToast("Failed to toggle code status", "error");
    }
  };

  const getStatusBadge = (status: PromoStatus) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: "bg-green-100", text: "text-green-800", label: "Active" },
      inactive: { bg: "bg-gray-100", text: "text-gray-800", label: "Inactive" },
      expired: { bg: "bg-red-100", text: "text-red-800", label: "Expired" },
      exhausted: { bg: "bg-orange-100", text: "text-orange-800", label: "Used" },
    };
    const c = config[status] || config.inactive;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  // Client-side search filtering (on top of server-side filtering)
  const displayedPromos = searchCode
    ? promos.filter((p) => p.code.toLowerCase().includes(searchCode.toLowerCase()))
    : promos;

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <StandardButton variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="mb-3">
          Back to Batches
        </StandardButton>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{batchName || "Batch Details"}</h2>
            {batchMeta && (
              <p className="text-sm text-gray-600 mt-1">
                {batchMeta.type === "fixed" ? `$${parseFloat(batchMeta.value).toFixed(2)} off` : `${parseFloat(batchMeta.value)}% off`}
                {" • "}
                {new Date(batchMeta.start_date).toLocaleDateString()} – {new Date(batchMeta.end_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total", value: summary.total_codes, color: "bg-blue-50 text-blue-700" },
            { label: "Used", value: summary.total_used, color: "bg-orange-50 text-orange-700" },
            { label: "Active", value: summary.active_codes, color: "bg-green-50 text-green-700" },
            { label: "Exhausted", value: summary.exhausted_codes, color: "bg-yellow-50 text-yellow-700" },
            { label: "Inactive", value: summary.inactive_codes, color: "bg-gray-50 text-gray-700" },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg p-4 ${card.color}`}>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium mt-1">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <StandardButton variant="secondary" size="sm" icon={Download} onClick={handleExportCsv}>
          Export CSV
        </StandardButton>
        {summary && summary.active_codes > 0 && (
          <StandardButton variant="secondary" size="sm" icon={Power} onClick={handleDeactivateAll} className="text-yellow-600 hover:bg-yellow-50">
            Deactivate All
          </StandardButton>
        )}
        <StandardButton variant="danger" size="sm" icon={Trash2} onClick={handleDeleteBatch}>
          Delete Batch
        </StandardButton>
        <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={loadBatchDetail}>
          {""}
        </StandardButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-600" />
          </div>
          <input
            type="text"
            placeholder="Search code..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setFilters((prev) => ({ ...prev, page: 1 }));
          }}
          className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="exhausted">Exhausted</option>
        </select>
        <select
          value={usedFilter}
          onChange={(e) => {
            setUsedFilter(e.target.value);
            setFilters((prev) => ({ ...prev, page: 1 }));
          }}
          className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
        >
          <option value="all">All Codes</option>
          <option value="used">Used Only</option>
          <option value="unused">Unused Only</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Used</th>
                <th className="text-center px-4 py-3 font-medium">Limit</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedPromos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No codes found matching your filters
                  </td>
                </tr>
              ) : (
                displayedPromos.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">{promo.code}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(promo.status)}</td>
                    <td className="text-center px-4 py-3">{promo.current_usage}</td>
                    <td className="text-center px-4 py-3">{promo.usage_limit_total ?? "∞"}</td>
                    <td className="text-right px-4 py-3">
                      {promo.status !== "exhausted" && (
                        <StandardButton
                          variant="ghost"
                          size="sm"
                          icon={promo.status === "active" ? EyeOff : Eye}
                          onClick={() => handleToggleCode(promo)}
                          title={promo.status === "active" ? "Deactivate" : "Activate"}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={pagination.current_page}
            totalPages={pagination.last_page}
            onPageChange={handlePageChange}
            totalItems={pagination.total}
            itemsPerPage={pagination.per_page}
            showingFrom={pagination.from ?? undefined}
            showingTo={pagination.to ?? undefined}
            itemLabel="codes"
          />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default BatchDetailView;
