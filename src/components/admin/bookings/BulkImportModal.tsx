import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, SkipForward } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../ui/StandardButton';
import bookingService from '../../../services/bookingService';

interface Location {
  id: number;
  name: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
  total_rows: number;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onImportComplete?: () => void;
  isCompanyAdmin?: boolean;
  userLocationId?: number | null;
}

type ModalState = 'upload' | 'importing' | 'results';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  locations,
  onImportComplete,
  isCompanyAdmin = false,
  userLocationId = null,
}) => {
  const { themeColor, fullColor } = useThemeColor();
  const [state, setState] = useState<ModalState>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [locationId, setLocationId] = useState<number | ''>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('upload');
      setFile(null);
      // Auto-set location for non-company-admin users
      setLocationId(!isCompanyAdmin && userLocationId ? userLocationId : '');
      setSkipDuplicates(true);
      setResult(null);
      setError(null);
      setIsDragOver(false);
    }
  }, [isOpen, isCompanyAdmin, userLocationId]);

  const validateFile = useCallback((f: File): string | null => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Invalid file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`;
    }
    if (f.size > MAX_FILE_SIZE) {
      return 'File size exceeds 10 MB limit.';
    }
    return null;
  }, []);

  const handleFileSelect = useCallback((f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(f);
    setError(null);
  }, [validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  const handleImport = async () => {
    if (!file || !locationId) return;

    setState('importing');
    setError(null);

    try {
      const response = await bookingService.bulkImportCsv(file, locationId as number, skipDuplicates);
      setResult(response.data);
      setState('results');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } };
      if (axiosErr.response?.status === 422) {
        const validationErrors = axiosErr.response.data?.errors;
        const msg = validationErrors
          ? Object.values(validationErrors).flat().join(', ')
          : axiosErr.response.data?.message;
        setError(msg || 'Validation error');
      } else {
        setError(axiosErr.response?.data?.message || 'Import failed. Please try again.');
      }
      setState('upload');
    }
  };

  const handleDone = () => {
    onClose();
    if (state === 'results') {
      onImportComplete?.();
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade"
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== 'importing') handleDone();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-lg relative border border-gray-200 m-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Bulk Import Bookings</h2>
          {state !== 'importing' && (
            <StandardButton
              variant="ghost"
              size="sm"
              icon={X}
              onClick={handleDone}
              className="!p-1"
            />
          )}
        </div>

        {/* Upload State */}
        {state === 'upload' && (
          <div className="p-6">
            <p className="text-gray-600 text-sm mb-5">
              Import bookings from a Bookly CSV or Excel file.
            </p>

            {/* Location select — only shown for company admins */}
            {isCompanyAdmin ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(Number(e.target.value) || '')}
                  className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                >
                  <option value="">Select location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {locations.find((loc) => loc.id === userLocationId)?.name || 'Your assigned location'}
                </p>
              </div>
            )}

            {/* Dropzone */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? `border-${themeColor}-400 bg-${themeColor}-50`
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <FileText className={`mx-auto h-10 w-10 ${isDragOver ? `text-${fullColor}` : 'text-gray-400'} mb-3`} />
                <p className="text-sm font-medium text-gray-700">
                  Drag & drop your file here
                </p>
                <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-3">
                  Accepted: .csv, .xlsx, .xls (max 10MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <FileText className={`h-8 w-8 text-${fullColor} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={removeFile}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Skip duplicates checkbox */}
            <label className="flex items-center gap-2 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
              />
              <span className="text-sm text-gray-700">Skip duplicate Bookly IDs (recommended)</span>
            </label>

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <StandardButton variant="secondary" size="md" onClick={handleDone}>
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="md"
                icon={Upload}
                onClick={handleImport}
                disabled={!file || !locationId}
              >
                Import
              </StandardButton>
            </div>
          </div>
        )}

        {/* Importing State */}
        {state === 'importing' && (
          <div className="p-6 text-center">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
              <FileText className={`h-8 w-8 text-${fullColor} flex-shrink-0`} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{file?.name}</p>
                <p className="text-xs text-gray-500">{file ? (file.size / 1024 / 1024).toFixed(2) : '0'} MB</p>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
              <div
                className={`bg-${fullColor} h-2.5 rounded-full animate-pulse`}
                style={{ width: '100%' }}
              />
            </div>

            <p className="text-sm text-gray-600">
              Importing bookings... Please do not close this window.
            </p>
          </div>
        )}

        {/* Results State */}
        {state === 'results' && result && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">Import Complete</h3>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                <p className="text-xl font-bold text-gray-900">{result.total_rows}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                <p className="text-xl font-bold text-green-700">{result.imported}</p>
                <p className="text-xs text-green-600 mt-0.5 flex items-center justify-center gap-1">
                  <CheckCircle2 size={12} /> Imported
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                <p className="text-xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-xs text-amber-600 mt-0.5 flex items-center justify-center gap-1">
                  <SkipForward size={12} /> Skipped
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                <p className="text-xl font-bold text-red-700">{result.errors.length}</p>
                <p className="text-xs text-red-600 mt-0.5 flex items-center justify-center gap-1">
                  <AlertTriangle size={12} /> Errors
                </p>
              </div>
            </div>

            {/* Error list */}
            {result.errors.length > 0 && (
              <div className="mb-5">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-500" />
                  Errors ({result.errors.length})
                </h4>
                <div className="bg-red-50 border border-red-200 rounded-lg divide-y divide-red-100 max-h-48 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="px-3 py-2 text-sm text-red-700">
                      <span className="font-medium">Row {err.row}:</span> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Done button */}
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <StandardButton variant="primary" size="md" onClick={handleDone}>
                Done — View Bookings
              </StandardButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkImportModal;
