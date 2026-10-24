import { MapPin } from 'lucide-react';
import type { TemplateLocationsValue } from '../../../utils/emailTemplateOptions';
import type { EmailTemplateTargetLocation } from '../../../types/EmailCampaign.types';

interface TemplateLocationsPickerProps {
  locations: Array<{ id: number; name: string }>;
  targetLocations?: EmailTemplateTargetLocation[];
  value: TemplateLocationsValue;
  onChange: (value: TemplateLocationsValue) => void;
  disabled?: boolean;
  error?: string;
}

const unlistedOption = (id: number, target?: EmailTemplateTargetLocation) => ({
  id,
  label: target?.name ?? `Location #${id}`,
  inactive: Boolean(target?.name) && target?.active === false,
  unlisted: true,
});

const TemplateLocationsPicker = ({ locations, targetLocations = [], value, onChange, disabled = false, error }: TemplateLocationsPickerProps) => {
  const listed = new Set(locations.map((location) => location.id));
  const unlistedIds = [
    ...new Set([...targetLocations.filter((target) => target.name !== null).map((target) => target.id), ...value.selectedIds]),
  ].filter((id) => !listed.has(id));
  const options = [
    ...locations.map((location) => ({ id: location.id, label: location.name, inactive: false, unlisted: false })),
    ...unlistedIds.map((id) => unlistedOption(id, targetLocations.find((target) => target.id === id))),
  ];
  const ticked = options.filter((option) => value.selectedIds.includes(option.id)).length;

  const toggle = (id: number) =>
    onChange({
      allLocations: false,
      selectedIds: value.selectedIds.includes(id) ? value.selectedIds.filter((selected) => selected !== id) : [...value.selectedIds, id],
    });

  const optionClass = (on: boolean) =>
    `flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${
      on ? 'border-blue-300 bg-blue-50 text-blue-900 ring-2 ring-blue-500' : 'border-gray-200 text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <fieldset className="min-w-0 border-0 p-0 m-0">
      <legend className="block text-sm font-medium text-gray-700">Locations</legend>
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className={optionClass(value.allLocations)}>
          <input
            type="radio"
            name="template-locations"
            checked={value.allLocations}
            onChange={() => onChange({ ...value, allLocations: true })}
            disabled={disabled}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block font-medium">Every location</span>
            <span className="block text-xs text-gray-500">Includes locations added later</span>
          </span>
        </label>
        <label className={optionClass(!value.allLocations)}>
          <input
            type="radio"
            name="template-locations"
            checked={!value.allLocations}
            onChange={() => onChange({ ...value, allLocations: false })}
            disabled={disabled}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block font-medium">Only the locations I tick</span>
            <span className="block text-xs text-gray-500">
              {ticked === 0 ? 'None ticked yet' : `${ticked} of ${options.length} ticked`}
            </span>
          </span>
        </label>
      </div>

      {!value.allLocations && (
        <div className={`mt-2 max-h-56 overflow-y-auto border ${error ? 'border-red-400' : 'border-gray-200'} rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1`}>
          {options.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm ${option.unlisted ? 'text-gray-500' : 'text-gray-700'} ${
                disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                checked={value.selectedIds.includes(option.id)}
                onChange={() => toggle(option.id)}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300"
              />
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{option.label}</span>
              {option.inactive && <span className="flex-shrink-0 text-xs">(inactive)</span>}
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </fieldset>
  );
};

export default TemplateLocationsPicker;
