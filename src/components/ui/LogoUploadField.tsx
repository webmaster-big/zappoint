import { useRef, useState } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import BrandLogo from './BrandLogo';
import {
  LOGO_FILE_HINT,
  LOGO_FIT_HINT,
  LOGO_MAX_BYTES,
  LOGO_SIZE_HINT,
  logoBoxStyle,
} from '../../utils/logo';

interface LogoUploadFieldProps {
  label?: string;
  value?: string | null;
  onUpload: (dataUri: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  disabled?: boolean;
}

const readAsDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });

const LogoUploadField = ({
  label = 'Logo',
  value,
  onUpload,
  onRemove,
  disabled = false,
}: LogoUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = logoBoxStyle('xl');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError('That image is larger than 20MB. Please use a smaller file.');
      return;
    }

    setBusy(true);
    try {
      await onUpload(await readAsDataUri(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The logo could not be uploaded.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setError(null);
    setBusy(true);
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The logo could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-start gap-4">
        <div
          className="relative shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-2"
          style={{ width: preview.width + 16, height: preview.height + 16 }}
        >
          <ImageIcon className="absolute w-8 h-8 text-gray-300" />
          {value && (
            <BrandLogo
              src={value}
              alt={`${label} preview`}
              size="xl"
              fallbackSrc=""
              className="relative bg-white"
            />
          )}
          {busy && (
            <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-t-2 border-white" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {value ? 'Replace' : 'Upload'}
            </button>
            {value && onRemove && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-gray-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>

          <p className="text-xs text-gray-600 mt-2">{LOGO_SIZE_HINT}</p>
          <p className="text-xs text-gray-500 mt-1">{LOGO_FIT_HINT}</p>
          <p className="text-xs text-gray-400 mt-1">{LOGO_FILE_HINT}</p>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        disabled={disabled || busy}
      />
    </div>
  );
};

export default LogoUploadField;
