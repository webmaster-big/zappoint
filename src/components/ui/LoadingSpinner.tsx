interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'small' | 'medium' | 'large';
  message?: string;
  showProgress?: boolean;
  progress?: number;
}

export default function LoadingSpinner({ 
  fullScreen = false, 
  size = 'medium',
  message,
  showProgress = false,
  progress = 0
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: { width: '100px', height: '100px' },
    medium: { width: '140px', height: '140px' },
    large: { width: '180px', height: '180px' }
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="loader-container">
        <img 
          src="/Zap-Zone.png" 
          alt="Loading..." 
          className="logo-bounce"
          style={{ width: sizeClasses[size].width, height: sizeClasses[size].height }}
        />
        <div className="logo-shadow"></div>
      </div>
      {showProgress && (
        <div className="w-26 mt-4">
          <div className="relative w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-yellow-400 transition-all duration-100 ease-linear"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-center text-sm font-semibold text-gray-700 mt-2">
            {Math.min(Math.floor(progress), 100)}%
          </p>
        </div>
      )}
      {message && !showProgress && <p className="text-sm font-medium text-gray-600 mt-2">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center transition-opacity duration-300">
        {spinner}
        <style>{`
          .loader-container {
            position: relative;
            width: 180px;
            height: 150px;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding-top: 10px;
          }
          
          .logo-bounce {
            position: absolute;
            object-fit: contain;
            animation: bounce 0.6s ease-in-out infinite;
          }
          
          .logo-shadow {
            position: absolute;
            bottom: 0;
            width: 70%;
            height: 10px;
            background: radial-gradient(ellipse, rgba(0, 0, 0, 0.3) 0%, transparent 70%);
            border-radius: 50%;
            animation: shadowPulse 0.6s ease-in-out infinite;
          }
          
          @keyframes bounce {
            0%, 100% {
              transform: translateY(0) scale(1, 1);
            }
            50% {
              transform: translateY(-30px) scale(1.05, 0.95);
            }
          }
          
          @keyframes shadowPulse {
            0%, 100% {
              transform: scale(1, 1);
              opacity: 0.3;
            }
            50% {
              transform: scale(0.7, 1);
              opacity: 0.15;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <style>{`
        .loader-container {
          position: relative;
          width: 160px;
          height: 130px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 10px;
        }
        
        .logo-bounce {
          position: absolute;
          object-fit: contain;
          animation: bounce 0.6s ease-in-out infinite;
        }
        
        .logo-shadow {
          position: absolute;
          bottom: 0;
          width: 70%;
          height: 10px;
          background: radial-gradient(ellipse, rgba(0, 0, 0, 0.3) 0%, transparent 70%);
          border-radius: 50%;
          animation: shadowPulse 0.6s ease-in-out infinite;
        } animation: shadowPulse 0.6s ease-in-out infinite;
        }
        
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0) scale(1, 1);
          }
          50% {
            transform: translateY(-30px) scale(1.05, 0.95);
          }
        }
        
        @keyframes shadowPulse {
          0%, 100% {
            transform: scale(1, 1);
            opacity: 0.3;
          }
          50% {
            transform: scale(0.7, 1);
            opacity: 0.15;
          }
        }
      `}</style>
    </div>
  );
}
