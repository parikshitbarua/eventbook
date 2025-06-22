import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { useTheme } from '../hooks/theme.hook';

interface QRData {
  tokenId: number;
  eventId: number;
  owner: string;
  expiresAt: number;
  serverSignature: string;
}

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error';
  title: string;
  qrData?: QRData | null; // For success case, to show QR data details
}

const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  qrData
}) => {
  const { isDark } = useTheme();
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Calculate time remaining and set up countdown
  useEffect(() => {
    if (!isOpen || type !== 'success' || !qrData) {
      setTimeLeft(0);
      return;
    }

    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = qrData.expiresAt - now;
      return Math.max(0, remaining);
    };

    // Set initial time
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      // Auto-close when expired
      if (remaining <= 0) {
        onClose();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, type, qrData, onClose]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get timer color based on time remaining
  const getTimerColor = (seconds: number) => {
    const minutes = seconds / 60;
    if (minutes > 7) return isDark ? 'text-green-400' : 'text-green-600';
    if (minutes > 3) return isDark ? 'text-yellow-400' : 'text-yellow-600';
    return isDark ? 'text-red-400' : 'text-red-600';
  };

  // Get timer background color
  const getTimerBgColor = (seconds: number) => {
    const minutes = seconds / 60;
    if (minutes > 7) return isDark ? 'bg-green-900/20 border-green-600/30' : 'bg-green-50 border-green-200';
    if (minutes > 3) return isDark ? 'bg-yellow-900/20 border-yellow-600/30' : 'bg-yellow-50 border-yellow-200';
    return isDark ? 'bg-red-900/20 border-red-600/30' : 'bg-red-50 border-red-200';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className={`relative w-full max-w-md transform overflow-hidden rounded-lg ${
            isDark 
              ? 'bg-gray-900 border border-gray-700' 
              : 'bg-white border border-gray-200'
          } shadow-xl transition-all`}
        >
          {/* Header */}
          <div className={`px-6 py-4 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {type === 'success' ? (
                  <div className="flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                )}
                <h3 className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className={`rounded-full p-1 hover:bg-gray-100 ${
                  isDark ? 'hover:bg-gray-800 text-gray-400' : 'text-gray-500'
                } transition-colors`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/*<p className={`text-sm ${*/}
            {/*  isDark ? 'text-gray-300' : 'text-gray-600'*/}
            {/*} mb-4`}>*/}
            {/*  {message}*/}
            {/*</p>*/}

            {/* Timer Display */}
            <div className={`text-center p-4 rounded-lg border ${getTimerBgColor(timeLeft)}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg
                    className={`w-5 h-5 ${getTimerColor(timeLeft)}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className={`text-lg font-mono font-bold ${getTimerColor(timeLeft)}`}>
                      {formatTime(timeLeft)}
                    </span>
              </div>
              <p className={`text-xs ${getTimerColor(timeLeft)} opacity-80`}>
                Time remaining until expiration
              </p>
            </div>

            {/* Success QR Code Display */}
            {type === 'success' && qrData && (
              <div className="space-y-6">
                {/* QR Code */}
                <div className="flex justify-center mt-5">
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-white' : 'bg-white'
                  } shadow-inner`}>
                    <QRCode
                      size={200}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      value={JSON.stringify({
                        tokenId: qrData.tokenId,
                        eventId: qrData.eventId,
                        owner: qrData.owner,
                        expiresAt: qrData.expiresAt,
                        serverSignature: qrData.serverSignature
                      })}
                      viewBox={`0 0 200 200`}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      level="M"
                    />
                  </div>
                </div>

                {/* QR Code Summary
                <div className={`rounded-lg p-4 ${
                  isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <h4 className={`text-sm font-medium ${
                    isDark ? 'text-gray-200' : 'text-gray-800'
                  } mb-3`}>
                    Ticket Information:
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className={`block ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Token ID:</span>
                      <span className={`font-mono font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        #{qrData.tokenId}
                      </span>
                    </div>
                    <div>
                      <span className={`block ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Event ID:</span>
                      <span className={`font-mono font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        #{qrData.eventId}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`block ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Owner:</span>
                      <span className={`font-mono text-xs ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {qrData.owner}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`block ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Valid Until:</span>
                      <span className={`font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        {new Date(qrData.expiresAt * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div> */}

                {/* Warning Message */}
                <div className={`text-center p-3 rounded-lg ${
                  isDark ? 'bg-red-900/20 border border-red-600/30' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg
                      className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span className={`text-xs font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      IMPORTANT
                    </span>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                    Do NOT share this QR code with anyone. Only present it to authorized personnel at the event venue.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 border-t ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          } flex justify-end`}>
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                type === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {type === 'success' ? 'Got it!' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRModal; 