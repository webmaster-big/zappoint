import { useState } from 'react';

export type RelationshipDirection = 'minor_to_signer' | 'signer_to_minor';

const OTHER = 'Other';

const OPTIONS: Record<RelationshipDirection, string[]> = {
  minor_to_signer: [
    'Son',
    'Daughter',
    'Child',
    'Stepson',
    'Stepdaughter',
    'Stepchild',
    'Grandson',
    'Granddaughter',
    'Grandchild',
    'Nephew',
    'Niece',
    'Brother',
    'Sister',
    'Sibling',
    'Foster Child',
    'Legal Ward',
    OTHER,
  ],
  signer_to_minor: [
    'Mother',
    'Father',
    'Stepmother',
    'Stepfather',
    'Grandmother',
    'Grandfather',
    'Aunt',
    'Uncle',
    'Legal Guardian',
    'Foster Parent',
    'Sibling',
    OTHER,
  ],
};

const PROMPTS: Record<RelationshipDirection, string> = {
  minor_to_signer: 'They are my…',
  signer_to_minor: 'I am their…',
};

interface Props {
  value: string;
  direction: RelationshipDirection;
  onChange: (value: string) => void;
  error?: boolean;
  autoComplete?: string;
}

const RelationshipSelect = ({ value, direction, onChange, error, autoComplete }: Props) => {
  const [otherSelected, setOtherSelected] = useState(false);

  const options = OPTIONS[direction];
  const trimmed = value.trim();
  const matched = options
    .filter((option) => option !== OTHER)
    .find((option) => option.toLowerCase() === trimmed.toLowerCase());
  const showOtherInput = otherSelected || (trimmed !== '' && !matched);

  const controlClass = `w-full px-3 py-2 border rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition ${
    error ? 'border-red-300' : 'border-gray-200'
  }`;

  return (
    <div className="space-y-2">
      <select
        className={controlClass}
        value={showOtherInput ? OTHER : (matched ?? '')}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER) {
            setOtherSelected(true);
            onChange('');
            return;
          }
          setOtherSelected(false);
          onChange(next);
        }}
      >
        <option value="">{PROMPTS[direction]}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {showOtherInput && (
        <input
          type="text"
          value={value}
          autoComplete={autoComplete}
          placeholder="Please specify"
          maxLength={100}
          onChange={(e) => onChange(e.target.value)}
          className={controlClass}
        />
      )}
    </div>
  );
};

export default RelationshipSelect;
