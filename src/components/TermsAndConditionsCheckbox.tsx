import React, { useState } from "react";
import TermsContent from "./TermsContent";

interface TermsAndConditionsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  error?: string;
}

const TermsAndConditionsCheckbox: React.FC<TermsAndConditionsCheckboxProps> = ({
  checked,
  onChange,
  required = true,
  error,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Checkbox */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="terms_accepted"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="terms_accepted" className="text-sm text-gray-700">
          I agree to the{" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsModalOpen(true);
            }}
            className="text-blue-600 underline hover:text-blue-800 font-medium"
          >
            Terms &amp; Conditions
          </button>
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

      {/* Terms & Conditions Modal (read-only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                Terms &amp; Conditions
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body — Scrollable */}
            <div className="px-6 py-4 overflow-y-auto flex-1 text-sm text-gray-700 leading-relaxed space-y-6">
              <TermsContent />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TermsAndConditionsCheckbox;
