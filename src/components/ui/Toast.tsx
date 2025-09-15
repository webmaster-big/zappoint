import React from "react";
import { X, CheckCircle2, Info, AlertTriangle } from "lucide-react";

export interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose?: () => void;
}


const typeStyles = {
  success: "text-emerald-700",
  error: "text-rose-700",
  info: "text-blue-700",
};

const iconMap = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
  error: <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
};


const typeDescriptions = {
  success: "Action completed successfully.",
  error: "Something went wrong. Please try again.",
  info: "For your information.",
};

const Toast: React.FC<ToastProps> = ({ message, type = "info", onClose }) => {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-lg min-w-[220px] max-w-xs ${typeStyles[type]} animate-fade-in-up`}
      role="alert"
    >
      <span className="pt-1">{iconMap[type]}</span>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{message}</div>
        <div className="text-xs text-gray-500 mt-0.5">{typeDescriptions[type]}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded hover:bg-black/10 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  );
};

export default Toast;
