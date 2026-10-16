import { EyeOff, Globe } from 'lucide-react';

interface OnlineAvailabilityFieldProps {
  checked: boolean;
  canChange: boolean;
  themeColor: string;
  isActive?: boolean;
  onChange: (next: boolean) => void;
}

const OnlineAvailabilityField = ({ checked, canChange, themeColor, isActive = true, onChange }: OnlineAvailabilityFieldProps) => (
  <div>
    <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
      {checked ? <Globe className="w-5 h-5 text-primary" /> : <EyeOff className="w-5 h-5 text-amber-700" />}
      Front-End Availability
    </h3>
    <label
      className={`flex items-start gap-3 rounded-md border px-4 py-3 ${
        checked ? 'border-gray-200 bg-white' : 'border-amber-200 amber-tone bg-amber-50'
      } ${canChange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!canChange}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500 ${
          canChange ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
        }`}
      />
      <span>
        <span className={`block text-base ${checked ? 'text-neutral-800' : 'text-amber-950'}`}>
          Customers can see and book this package online
        </span>
        <span className={`block text-xs mt-1 ${checked ? 'text-gray-500' : 'text-amber-900'}`}>
          {checked
            ? isActive
              ? 'On: the package shows on the booking site and customers can book it there. Staff can always book it here.'
              : 'On: once the package is switched on, it shows on the booking site and customers can book it there.'
            : isActive
              ? 'Off (backend only): the package is hidden from the booking site and cannot be booked online, even from a saved link. Staff can still book it here, and its schedule and existing bookings stay as they are.'
              : 'Off (backend only): the package is hidden from the booking site and cannot be booked online, even from a saved link. Staff can book it here once it is switched on. Its schedule and existing bookings stay as they are.'}
        </span>
        {!canChange && (
          <span className={`block text-xs mt-1 ${checked ? 'text-gray-500' : 'text-amber-800'}`}>
            Only a location manager or an admin can change this.
          </span>
        )}
      </span>
    </label>
  </div>
);

export default OnlineAvailabilityField;
