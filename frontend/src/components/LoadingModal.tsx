import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useTheme } from '../hooks/theme.hook';

export type LoadingAction = 
  | 'ticket-purchase'
  | 'event-creation'
  | 'transaction-pending'
  | 'metadata-upload'
  | 'contract-deployment'
  | 'generic-loading'
  | 'success'
  | 'error';

interface LoadingModalProps {
  isOpen: boolean;
  action: LoadingAction;
  customMessage?: string;
  progress?: number; // 0-100 for progress bar
  onClose?: () => void; // For success/error states
  actionButton?: {
    text: string;
    onClick: () => void;
  }; // Optional action button for success/error states
}

interface ActionConfig {
  title: string;
  message: string;
  icon: React.ReactNode;
  color: string;
}

const LoadingModal = ({
  isOpen,
  action,
  customMessage,
  progress,
  onClose,
  actionButton
}: LoadingModalProps) => {
  const { isDark } = useTheme();

  const getActionConfig = (action: LoadingAction): ActionConfig => {
    const baseClasses = "w-16 h-16 mx-auto mb-4";
    
    switch (action) {
      case 'ticket-purchase':
        return {
          title: 'Processing Ticket Purchase',
          message: customMessage || 'Please wait while we process your ticket purchase. This may take a few moments...',
          color: 'text-blue-600',
          icon: (
            <div className={`${baseClasses} relative`}>
              <svg
                className="animate-spin text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )
        };
      
      case 'event-creation':
        return {
          title: 'Creating Your Event',
          message: customMessage || 'Setting up your event and deploying smart contracts. This process may take a few minutes...',
          color: 'text-green-600',
          icon: (
            <div className={`${baseClasses} relative`}>
              <svg
                className="animate-pulse text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-green-600 rounded-full animate-ping"></div>
              </div>
            </div>
          )
        };
      
      case 'metadata-upload':
        return {
          title: 'Uploading Metadata',
          message: customMessage || 'Uploading your event data and images to IPFS. Please wait...',
          color: 'text-purple-600',
          icon: (
            <div className={`${baseClasses} relative`}>
              <svg
                className="animate-bounce text-purple-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          )
        };
      
      case 'transaction-pending':
        return {
          title: 'Transaction Pending',
          message: customMessage || 'Your transaction is being processed on the blockchain. Please do not close this window...',
          color: 'text-orange-600',
          icon: (
            <div className={`${baseClasses} relative`}>
              <svg
                className="animate-spin text-orange-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
              </div>
            </div>
          )
        };
      
      case 'contract-deployment':
        return {
          title: 'Deploying Smart Contract',
          message: customMessage || 'Deploying your event contract to the blockchain. This may take several minutes...',
          color: 'text-red-600',
          icon: (
            <div className={`${baseClasses} relative`}>
              <div className="animate-pulse">
                <svg
                  className="text-red-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
            </div>
          )
        };
      
      case 'success':
        return {
          title: 'Success! 🎉',
          message: customMessage || 'Operation completed successfully!',
          color: 'text-green-600',
          icon: (
            <div className={`${baseClasses} relative`}>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
          )
        };
      
      case 'error':
        return {
          title: 'Error Occurred',
          message: customMessage || 'Something went wrong. Please try again.',
          color: 'text-red-600',
          icon: (
            <div className={`${baseClasses} relative`}>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
          )
        };
      
      default:
        return {
          title: 'Loading...',
          message: customMessage || 'Please wait while we process your request...',
          color: 'text-gray-600',
          icon: (
            <div className={`${baseClasses}`}>
              <svg
                className="animate-spin text-gray-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )
        };
    }
  };

  const config = getActionConfig(action);

  const getProgressBarColor = (action: LoadingAction): string => {
    switch (action) {
      case 'ticket-purchase':
        return 'bg-blue-600';
      case 'event-creation':
        return 'bg-green-600';
      case 'metadata-upload':
        return 'bg-purple-600';
      case 'transaction-pending':
        return 'bg-orange-600';
      case 'contract-deployment':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const renderProgressBar = () => {
    if (progress === undefined) return null;
    
    const progressPercentage = Math.round(progress);
    const progressBarColor = getProgressBarColor(action);
    
    return (
      <div className="mt-6">
        <div className="flex justify-between text-xs mb-1">
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Progress
          </span>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {progressPercentage}%
          </span>
        </div>
        <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${progressBarColor}`}
            style={{ 
              width: `${Math.max(0, Math.min(100, progress))}%`,
              transform: `translateX(0%)` // Force hardware acceleration
            }}
          />
        </div>
      </div>
    );
  };

  const isLoadingState = !['success', 'error'].includes(action);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose || (() => {})}>
        {/* Backdrop - prevents clicks outside */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`w-full max-w-md transform overflow-hidden rounded-2xl ${
                  isDark ? 'bg-gray-900' : 'bg-white'
                } p-8 text-center align-middle shadow-xl transition-all border ${
                  isDark ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                {/* Icon */}
                <div className="flex justify-center">
                  {config.icon}
                </div>

                {/* Title */}
                <Dialog.Title
                  as="h3"
                  className={`text-xl font-bold leading-6 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-4`}
                >
                  {config.title}
                </Dialog.Title>

                {/* Message */}
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  } mb-4 leading-relaxed`}
                >
                  {config.message}
                </p>

                {/* Progress Bar - only for loading states */}
                {isLoadingState && renderProgressBar()}

                {/* Loading dots animation - only for loading states */}
                {isLoadingState && (
                  <div className="flex justify-center mt-6">
                    <div className="flex space-x-1">
                      <div
                        className={`w-2 h-2 ${config.color.replace('text-', 'bg-')} rounded-full animate-bounce`}
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className={`w-2 h-2 ${config.color.replace('text-', 'bg-')} rounded-full animate-bounce`}
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className={`w-2 h-2 ${config.color.replace('text-', 'bg-')} rounded-full animate-bounce`}
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons - only for success/error states */}
                {!isLoadingState && (
                  <div className="mt-6 flex flex-col gap-3">
                    {actionButton && (
                      <button
                        onClick={actionButton.onClick}
                        className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                          action === 'success'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {actionButton.text}
                      </button>
                    )}
                    {onClose && (
                      <button
                        onClick={onClose}
                        className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        {action === 'success' ? 'Continue' : 'Close'}
                      </button>
                    )}
                  </div>
                )}

                {/* Warning message - only for loading states */}
                {isLoadingState && (
                  <div className={`mt-6 p-3 rounded-lg ${
                    isDark ? 'bg-yellow-900/20 border border-yellow-800/50' : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <p className={`text-xs ${
                      isDark ? 'text-yellow-300' : 'text-yellow-800'
                    }`}>
                      ⚠️ Please do not close this window or navigate away during this process
                    </p>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default LoadingModal; 