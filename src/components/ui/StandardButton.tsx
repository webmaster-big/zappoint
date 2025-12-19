import React from 'react';
import { useThemeColor } from '../../hooks/useThemeColor';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface StandardButtonProps {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  title?: string;
}

const StandardButton: React.FC<StandardButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  onClick,
  type = 'button',
  fullWidth = false,
  title,
}) => {
  const { themeColor } = useThemeColor();

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return `bg-${themeColor}-600 text-white hover:bg-${themeColor}-700 focus:ring-${themeColor}-500 disabled:bg-${themeColor}-300`;
      case 'secondary':
        return `border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-${themeColor}-500 disabled:bg-gray-100 disabled:text-gray-400`;
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300';
      case 'success':
        return 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300';
      case 'ghost':
        return `text-${themeColor}-600 hover:text-${themeColor}-700 hover:bg-${themeColor}-50 focus:ring-${themeColor}-500 disabled:text-gray-400`;
      default:
        return `bg-${themeColor}-600 text-white hover:bg-${themeColor}-700 focus:ring-${themeColor}-500 disabled:bg-${themeColor}-300`;
    }
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = (disabled || loading) ? 'cursor-not-allowed opacity-50' : '';

  const classes = [
    baseClasses,
    sizeClasses[size],
    getVariantClasses(),
    widthClass,
    disabledClass,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} ${children ? 'mr-2' : ''}`} />
          )}
          {children}
          {Icon && iconPosition === 'right' && (
            <Icon className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} ${children ? 'ml-2' : ''}`} />
          )}
        </>
      )}
    </button>
  );
};

export default StandardButton;