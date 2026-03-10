import React from "react";

interface TermsAndConditionsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  error?: string;
  tosUrl?: string;
}

const TermsAndConditionsCheckbox: React.FC<TermsAndConditionsCheckboxProps> = ({
  checked,
  onChange,
  required = true,
  error,
  tosUrl = "https://zap-zone.com/terms-conditions/",
}) => {
  return (
    <>
      {/* Checkbox */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="terms_accepted"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="terms_accepted" className="text-sm text-gray-700 leading-5 select-none">
          I agree to the{" "}
          <a
            href={tosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 font-medium"
          >
            Terms &amp; Conditions
          </a>
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>
      {error && <p className="text-sm text-red-500 mt-1 ml-7">{error}</p>}
    </>
  );
};

export default TermsAndConditionsCheckbox;
