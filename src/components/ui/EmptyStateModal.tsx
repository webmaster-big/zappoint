import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Ticket, AlertCircle } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';

interface EmptyStateModalProps {
  type: 'packages' | 'attractions';
  isOpen: boolean;
  onClose: () => void;
}

const EmptyStateModal: React.FC<EmptyStateModalProps> = ({ type, isOpen, onClose }) => {
  const { fullColor } = useThemeColor();

  if (!isOpen) return null;

  const isPackages = type === 'packages';
  const Icon = isPackages ? Package : Ticket;
  const title = isPackages ? 'No Packages Available' : 'No Attractions Available';
  const description = isPackages
    ? 'To create bookings, you need to have at least one package available in your system.'
    : 'To create purchases, you need to have at least one attraction available in your system.';
  const actionText = isPackages ? 'Create Your First Package' : 'Create Your First Attraction';
  const actionLink = isPackages ? '/packages/create' : '/attractions/create';
  const secondaryLink = isPackages ? '/packages' : '/attractions';
  const secondaryText = isPackages ? 'View Packages' : 'View Attractions';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fadeIn">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient background */}
        <div 
          className="relative px-5 py-6 text-center"
          style={{
            background: `linear-gradient(135deg, ${fullColor}10 0%, ${fullColor}05 100%)`
          }}
        >
          {/* Animated icon container */}
          <div className="relative inline-block">
            <div 
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ backgroundColor: fullColor }}
            />
            <div 
              className="relative w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{
                background: `linear-gradient(135deg, ${fullColor}20 0%, ${fullColor}10 100%)`,
                boxShadow: `0 8px 24px ${fullColor}30`
              }}
            >
              <Icon size={28} style={{ color: fullColor }} strokeWidth={2} />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Info alert */}
          <div 
            className="flex gap-2.5 p-3 rounded-lg mb-5"
            style={{
              background: `linear-gradient(135deg, ${fullColor}08 0%, ${fullColor}04 100%)`,
              border: `1px solid ${fullColor}20`
            }}
          >
            <AlertCircle 
              size={20} 
              className="flex-shrink-0 mt-0.5" 
              style={{ color: fullColor }}
            />
            <p className="text-sm text-gray-700 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Link
              to={actionLink}
              onClick={onClose}
              className="block w-full text-center px-5 py-2.5 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, ${fullColor} 0%, ${fullColor}dd 100%)`,
              }}
            >
              {actionText}
            </Link>

            <Link
              to={secondaryLink}
              onClick={onClose}
              className="block w-full text-center px-5 py-2.5 font-medium rounded-lg transition-all duration-200 border-2"
              style={{
                color: fullColor,
                borderColor: `${fullColor}40`,
                backgroundColor: 'white'
              }}
            >
              {secondaryText}
            </Link>

            <button
              onClick={onClose}
              className="block w-full text-center px-5 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default EmptyStateModal;
