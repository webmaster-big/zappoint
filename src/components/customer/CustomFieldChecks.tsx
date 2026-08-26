import type { ApplicableCustomField } from '../../services/CustomFieldService';

/**
 * The extra checkboxes an item asks for, rendered wherever a purchase is confirmed.
 * Answers live in the parent so it can block its own submit button and send them along.
 */
const CustomFieldChecks = ({
  fields,
  answers,
  onChange,
  className,
  unavailable,
}: {
  fields: ApplicableCustomField[];
  answers: Record<number, boolean>;
  onChange: (id: number, value: boolean) => void;
  className?: string;
  /** True when the questions could not be loaded — silence would look like "none to ask". */
  unavailable?: boolean;
}) => {
  if (unavailable) {
    return (
      <p className={`text-xs text-amber-700 ${className ?? ''}`}>
        We couldn't load the final confirmations for this item. Please reload the page before
        paying, or you may be asked for them again.
      </p>
    );
  }

  if (!fields.length) return null;

  return (
    <div className={`space-y-2.5 ${className ?? ''}`}>
      {fields.map(field => (
        <label key={field.id} className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={answers[field.id] ?? false}
            onChange={event => onChange(field.id, event.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-800 focus:ring-blue-500 cursor-pointer shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm text-gray-800 group-hover:text-gray-900">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            {field.help_text && <span className="block text-xs text-gray-500">{field.help_text}</span>}
          </span>
        </label>
      ))}
    </div>
  );
};

export default CustomFieldChecks;
