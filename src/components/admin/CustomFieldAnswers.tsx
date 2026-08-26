import { Check, X } from 'lucide-react';

interface CustomFieldResponse {
  id: number;
  label: string;
  value: boolean;
}

/**
 * What the guest or staff member answered to the extra checkboxes. Reads the record
 * straight off any purchase payload so no detail page needs its own type change.
 */
const CustomFieldAnswers = ({
  source,
  className,
  heading = 'Extra confirmations',
}: {
  source: unknown;
  className?: string;
  heading?: string;
}) => {
  const responses =
    (source as { custom_field_responses?: CustomFieldResponse[] } | null | undefined)
      ?.custom_field_responses ?? [];

  if (!responses.length) return null;

  return (
    <div className={className}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{heading}</p>
      <ul className="space-y-1.5">
        {responses.map(response => (
          <li key={response.id} className="flex items-start gap-2 text-sm">
            {response.value ? (
              <Check size={15} className="text-green-600 mt-0.5 shrink-0" />
            ) : (
              <X size={15} className="text-gray-400 mt-0.5 shrink-0" />
            )}
            <span className={response.value ? 'text-gray-800' : 'text-gray-500'}>{response.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CustomFieldAnswers;
