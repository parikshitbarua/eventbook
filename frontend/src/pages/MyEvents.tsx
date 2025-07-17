import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { JsonRpcProvider, Contract } from 'ethers';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import { fetchFirstImageFromIPFS } from '../utils/ipfs-helper.util';
import type { EventData, EventDetailsResponseData } from '../types/event.types.ts';
import { NETWORK_URL, FACTORY_ADDRESS } from '../config/app.config';
import { useTheme } from '../hooks/theme.hook.ts';
import EventContractABI from "../contracts/EventContract.sol/EventContract.json";
import { TicketCategory } from "../types/ticket.types.ts";
import QRScannerModal from '../components/QRScannerModal';
import { colors } from '../config/global.themes';

const MyEvents: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedNftContract, setSelectedNftContract] = useState<string>('');

  const fetchEventDetails = useCallback(async (eventId: bigint) => {
    try {
      let maxTickets = 0n;
      const provider = new JsonRpcProvider(NETWORK_URL);
      const factoryContract = new Contract(
        FACTORY_ADDRESS,
        EventFactoryABI.abi,
        provider,
      );

      const eventDetails: EventDetailsResponseData = await factoryContract.getEventDetails(eventId);

      if (eventDetails.ticketPrice === 0n && eventDetails.maxTickets === 0n) {
        const eventContract = new Contract(
            eventDetails.eventInfo.eventContract as `0x${string}`,
            EventContractABI.abi,
            provider,
        );
        const categories: TicketCategory[] =
            await eventContract.getAllCategories();
        if (categories.length > 0) {
          maxTickets = categories.reduce((total, category) => {
              total += category.maxSupply;
              return total;
          },0n)
        }
      }

      // Fetch first image from IPFS
      let firstImageUrl: string | null = null;
      if (eventDetails.eventURI) {
        try {
          const metadataResponse = await fetch(eventDetails.eventURI);
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            if (metadata?.image) {
              firstImageUrl = await fetchFirstImageFromIPFS(metadata.image);
            }
          }
        } catch (err) {
          console.error('Failed to fetch metadata:', err);
        }
      }

      return {
        eventId: Number(eventId),
        title: eventDetails.eventInfo.title,
        description: eventDetails.description,
        organizer: eventDetails.eventInfo.organizer as `0x${string}`,
        ticketPrice: eventDetails.ticketPrice,
        maxTickets: maxTickets > 0n ? maxTickets : eventDetails.maxTickets,
        ticketsSold: eventDetails.eventInfo.ticketsSold,
        ticketsLeft: BigInt(maxTickets > 0n || eventDetails.maxTickets == null ? maxTickets - eventDetails.eventInfo.ticketsSold :
          eventDetails.maxTickets - eventDetails.eventInfo.ticketsSold),
        isActive: eventDetails.eventInfo.isActive,
        eventURI: eventDetails.eventURI,
        createdAt: eventDetails.eventInfo.createdAt,
        eventStartTime: eventDetails.eventStartTime,
        eventEndTime: eventDetails.eventEndTime,
        venue: eventDetails.venue,
        eventContract: eventDetails.eventInfo.eventContract as `0x${string}`,
        nftContract: eventDetails.eventInfo.nftContract as `0x${string}`,
        totalRevenue: eventDetails.eventInfo.totalRevenue,
        eventImages: firstImageUrl || '',
      } as EventData;
    } catch (err) {
      console.error(`Failed to fetch event ${eventId}:`, err);
      return null;
    }
  }, []);

  const fetchOrganizerEvents = useCallback(async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to view your events');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const provider = new JsonRpcProvider(NETWORK_URL);
      const factoryContract = new Contract(
        FACTORY_ADDRESS,
        EventFactoryABI.abi,
        provider,
      );

      const eventIds = await factoryContract.getOrganizerEvents(address);
      const eventPromises = eventIds.map(fetchEventDetails);
      const eventResults = await Promise.all(eventPromises);

      // Filter out any null results and sort by creation date (newest first)
      const validEvents = eventResults
        .filter(
          (event): event is EventData & { createdAt: bigint } =>
            event !== null && event.createdAt !== undefined,
        )
        .sort((a, b) => Number(b.createdAt - a.createdAt));

      setEvents(validEvents);
    } catch (err) {
      console.error('Failed to fetch organizer events:', err);
      setError('Failed to load your events');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, fetchEventDetails]);

  useEffect(() => {
    fetchOrganizerEvents();
  }, [fetchOrganizerEvents, address, isConnected]);

  // Watch for wallet connection changes and refresh
  useEffect(() => {
    if (isConnected && address && error) {
      // Clear error state and refresh when wallet gets connected
      setError(null);
      fetchOrganizerEvents();
    }
  }, [isConnected, address, error, fetchOrganizerEvents]);

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'bg-black' : 'bg-gray-50'
        } flex items-center justify-center transition-colors duration-300`}
      >
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 mx-auto mb-4"
            style={{ color: colors.primary }}
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p
            className={`${
              isDark ? 'text-gray-400' : 'text-gray-600'
            } transition-colors duration-300`}
          >
            Loading your events...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'bg-black' : 'bg-gray-50'
        } py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center transition-colors duration-300`}
      >
        <div className="max-w-4xl mx-auto">
          <div className={`${
            isDark
              ? 'bg-gray-900 shadow-2xl shadow-black/20'
              : 'bg-white shadow-2xl'
          } rounded-3xl overflow-hidden transition-colors duration-300`}>
            <div className="px-8 py-16 sm:px-12 sm:py-20 text-center">
              {/* Wallet Icon */}
              <div className={`mx-auto w-24 h-24 ${
                isDark ? 'bg-gray-800' : 'bg-gray-100'
              } rounded-full flex items-center justify-center mb-8 transition-colors duration-300`}>
                <svg
                  className={`w-12 h-12 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>

              {/* Title */}
              <h2
                className={`text-3xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                } mb-4 transition-colors duration-300`}
              >
                Connect Your Wallet to View Events
              </h2>

              {/* Description */}
              <p
                className={`text-lg ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                } mb-8 max-w-2xl mx-auto transition-colors duration-300`}
              >
                Your wallet connection is required to access and manage your blockchain events. 
                Connect to view your created events and track their performance.
              </p>

              {/* Features List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4" 
                       style={{ backgroundColor: `${colors.primary}20` }}>
                    <svg className="w-6 h-6" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    Event Management
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    View, edit, and manage all your blockchain events from one dashboard.
                  </p>
                </div>

                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4" 
                       style={{ backgroundColor: `${colors.primary}20` }}>
                    <svg className="w-6 h-6" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 00-2-2m0 0V9a2 2 0 012-2h2a2 2 0 00-2-2" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    Revenue Analytics
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    Track ticket sales, revenue, and attendance analytics in real-time.
                  </p>
                </div>

                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4" 
                       style={{ backgroundColor: `${colors.primary}20` }}>
                    <svg className="w-6 h-6" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    Instant Payouts
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    Receive payments directly to your wallet as tickets are sold.
                  </p>
                </div>
              </div>

              {/* Connect Button */}
              <div className="flex justify-center">
                <appkit-button />
              </div>

              {/* Help Text */}
              <p className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              } mt-6 transition-colors duration-300`}>
                Don't have a wallet? We recommend{' '}
                <a 
                  href="https://metamask.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline transition-colors duration-200"
                  style={{ color: colors.accent }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.accentHover}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.accent}
                >
                  MetaMask
                </a>{' '}
                for beginners.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'bg-black' : 'bg-gray-50'
        } py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1
              className={`text-3xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              } mb-4 transition-colors duration-300`}
            >
              My Events
            </h1>
            <div
              className={`${
                isDark
                  ? 'bg-gray-900 shadow-lg shadow-black/20'
                  : 'bg-white shadow-sm'
              } rounded-lg p-8 transition-colors duration-300`}
            >
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h2
                className={`text-xl font-semibold ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                } mb-2 transition-colors duration-300`}
              >
                No Events Found
              </h2>
              <p
                className={`${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                } mb-6 transition-colors duration-300`}
              >
                You haven't created any events yet.
              </p>
              <button
                onClick={() => navigate('/new-event')}
                className="px-6 py-3 text-white rounded-lg font-medium transition-all duration-200"
                style={{
                  backgroundColor: colors.primary,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >
                Create Your First Event
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'bg-black' : 'bg-gray-50'
      } py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto">
        {/* <div className="flex justify-between items-center mb-8">
          <h1
            className={`text-3xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            } transition-colors duration-300`}
          >
            My Events
          </h1>
          <button
            onClick={() => navigate('/new-event')}
            className="px-4 sm:px-6 py-2 sm:py-3 text-white
            font-medium rounded-xl shadow-sm text-sm sm:text-base
            transition-all duration-200 border flex items-center justify-center gap-2"
            style={{
              backgroundColor: colors.primary,
              borderColor: colors.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.primaryHover;
              e.currentTarget.style.borderColor = colors.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.primary;
              e.currentTarget.style.borderColor = colors.primary;
            }}
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 4v16m8-8H4" 
              />
            </svg>
            <span className="hidden sm:inline">New Event</span>
            <span className="sm:hidden">New</span>
          </button>
        </div> */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <div
              key={event.eventId}
              className={`${
                isDark
                  ? 'bg-gray-900 border-gray-700 shadow-lg shadow-black/20 hover:shadow-black/40'
                  : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'
              } rounded-2xl overflow-hidden border transition-all duration-300`}
            >
              <div className="relative">
                <img
                  src={
                    event.eventImages ||
                    'https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2024-07/Tomorrowland.jpg?itok=IhV-aC4t'
                  }
                  alt={event.title}
                  className="h-48 w-full object-cover"
                />
                <div className="absolute top-4 right-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      event.isActive
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-500 text-white'
                    }`}
                  >
                    {event.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <h2
                  className={`text-xl font-semibold ${
                    isDark ? 'text-white' : 'text-gray-800'
                  } mb-2 transition-colors duration-300`}
                >
                  {event.title}
                </h2>
                <p
                  className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } line-clamp-2 mb-4 transition-colors duration-300`}
                >
                  {event.description}
                </p>

                <div className="space-y-3 mb-4">
                  <div
                    className={`flex items-center text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    } transition-colors duration-300`}
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      style={{ color: colors.primary }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {formatDate(event.eventStartTime)}
                  </div>
                  <div
                    className={`flex items-center text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    } transition-colors duration-300`}
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      style={{ color: colors.primary }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {event.venue}
                  </div>
                </div>

                <div
                  className={`flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t ${
                    isDark ? 'border-gray-700' : 'border-gray-100'
                  } gap-3 sm:gap-0 transition-colors duration-300`}
                >
                  <div
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    } transition-colors duration-300`}
                  >
                    <span className="font-semibold" style={{ color: colors.primary }}>
                      {Number(event.ticketsSold)}/{Number(event.maxTickets)}
                    </span>{' '}
                    tickets sold
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="flex flex-row gap-2">
                      <button
                        onClick={() => navigate(`/event/${event.eventId}`)}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium ${
                          isDark
                            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } rounded-md transition-colors`}
                      >
                        View
                      </button>
                      {event.isActive && (
                        <button
                          onClick={() =>
                            navigate(`/event/${event.eventId}/manage`)
                          }
                          className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium text-white rounded-md transition-all duration-200"
                          style={{
                            backgroundColor: colors.primary,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
                        >
                          Manage
                        </button>
                      )}
                    </div>
                    {event.isActive && (
                      <button
                        onClick={() => {
                          setSelectedEventId(event.eventId.toString());
                          setSelectedNftContract(event.nftContract);
                          setIsQRScannerOpen(true);
                        }}
                        className={`w-full sm:w-auto px-3 py-1.5 text-xs font-medium ${
                          isDark
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        } text-white rounded-md transition-colors flex items-center justify-center gap-1.5`}
                      >
                        {/*<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">*/}
                        {/*  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2h8a2 2 0 012 2v6zM8 9l8 8m0-8l-8 8" />*/}
                        {/*</svg>*/}
                        Scan Tickets
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        eventId={selectedEventId}
        nftContractAddress={selectedNftContract}
      />
    </div>
  );
};

export default MyEvents;
