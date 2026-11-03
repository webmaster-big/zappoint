interface SpecialCheckAlertProps {
  failed: boolean;
  onRetry: () => void;
  className?: string;
}

const SpecialCheckAlert = ({ failed, onRetry, className = '' }: SpecialCheckAlertProps) => {
  if (!failed) return null;

  return (
    <div className={`rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${className}`}>
      We couldn't check the special price for this visit, so payment is paused.
      <button type="button" onClick={onRetry} className="ml-1 font-semibold underline">
        Try again
      </button>
    </div>
  );
};

export default SpecialCheckAlert;
