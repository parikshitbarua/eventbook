import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { JsonRpcProvider, Contract } from 'ethers';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import { FACTORY_ADDRESS, NETWORK_URL } from '../config/app.config';
import { useTheme } from '../hooks/theme.hook';
import { colors } from '../config/global.themes';

interface OrganizerProtectedRouteProps {
  children: React.ReactNode;
}

const OrganizerProtectedRoute: React.FC<OrganizerProtectedRouteProps> = ({ children }) => {
  const { id: eventId } = useParams<{ id: string }>();
  const { address, isConnected } = useAccount();
  const { isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthorization = async () => {
      // Check if wallet is connected
      if (!isConnected || !address) {
        setError('Please connect your wallet to access this page');
        setIsLoading(false);
        return;
      }

      // Check if eventId is provided
      if (!eventId) {
        setError('Invalid event ID');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch event details to get organizer address
        const provider = new JsonRpcProvider(NETWORK_URL);
        const factoryContract = new Contract(
          FACTORY_ADDRESS,
          EventFactoryABI.abi,
          provider,
        );

        const eventDetails = await factoryContract.getEventDetails(BigInt(eventId));
        const eventOrganizer = eventDetails.eventInfo.organizer;

        // Check if current user is the event organizer
        if (eventOrganizer.toLowerCase() === address.toLowerCase()) {
          setIsAuthorized(true);
        } else {
          setError('You are not authorized to access this page. Only the event organizer can make changes.');
        }
      } catch (err) {
        console.error('Error checking authorization:', err);
        setError('Failed to verify event ownership. The event may not exist.');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthorization();
  }, [eventId, address, isConnected]);

  // Show loading state
  if (isLoading) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'bg-zinc-900' : 'bg-slate-50'
        } flex items-center justify-center transition-colors duration-300`}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4" 
               style={{ borderColor: colors.primary }}></div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
            Verifying Access
          </h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Checking if you're authorized to access this page...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'bg-zinc-900' : 'bg-slate-50'
        } flex items-center justify-center transition-colors duration-300`}
      >
        <div className="max-w-md w-full mx-4">
          <div
            className={`${
              isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
            } border rounded-xl p-8 text-center transition-colors duration-300`}
          >
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            {/* Error Title */}
            <h2 className={`text-xl font-bold ${isDark ? 'text-red-400' : 'text-red-800'} mb-4`}>
              Access Denied
            </h2>

            {/* Error Message */}
            <p className={`${isDark ? 'text-red-300' : 'text-red-700'} mb-6`}>
              {error}
            </p>

            {/* Action Buttons */}
            <div className="space-y-3">
              {!isConnected && (
                <div className="flex justify-center">
                  <appkit-button />
                </div>
              )}
              <button
                onClick={() => window.history.back()}
                className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If not authorized, redirect to home
  if (!isAuthorized) {
    return <Navigate to="/home" replace />;
  }

  // If authorized, render the protected content
  return <>{children}</>;
};

export default OrganizerProtectedRoute; 