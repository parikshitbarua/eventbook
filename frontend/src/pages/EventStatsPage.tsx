import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { JsonRpcProvider, Contract, formatEther } from 'ethers';
import { useTheme } from '../hooks/theme.hook.ts';
import { FACTORY_ADDRESS, NETWORK_URL } from '../config/app.config.ts';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import EventTicketNFTABI from '../contracts/EventTicketNFT.sol/EventTicketNFT.json';
import { EventDetailsResponseData } from '../types/event.types.ts';

interface EventStats {
  totalCapacity: number;
  totalSold: number;
  availableTickets: number;
  totalRevenue: bigint;
  royaltyInfo: {
    royaltyFee: bigint;
    royaltyReceiver: string;
  };
  hasCategories: boolean;
  categories?: Array<{
    name: string;
    price: bigint;
    maxSupply: bigint;
    sold: bigint;
    revenue: bigint;
  }>;
}

interface EventData {
  title: string;
  organizer: string;
  eventContract: string;
  nftContract: string;
  createdAt: bigint;
  eventStartTime: bigint;
  eventEndTime: bigint;
  venue: string;
}

const EventStatsPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDark } = useTheme();

  const fetchEventStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const provider = new JsonRpcProvider(NETWORK_URL);
      const factoryContract = new Contract(
        FACTORY_ADDRESS,
        EventFactoryABI.abi,
        provider,
      );

      // Fetch event details
      const eventDetails: EventDetailsResponseData =
        await factoryContract.getEventDetails(BigInt(eventId!));

      // Set basic event data
      setEventData({
        title: eventDetails.eventInfo.title,
        organizer: eventDetails.eventInfo.organizer,
        eventContract: eventDetails.eventInfo.eventContract,
        nftContract: eventDetails.eventInfo.nftContract,
        createdAt: eventDetails.eventInfo.createdAt,
        eventStartTime: eventDetails.eventStartTime,
        eventEndTime: eventDetails.eventEndTime,
        venue: eventDetails.venue,
      });

      // Get contracts
      const eventContract = new Contract(
        eventDetails.eventInfo.eventContract,
        EventContractABI.abi,
        provider,
      );

      const nftContract = new Contract(
        eventDetails.eventInfo.nftContract,
        EventTicketNFTABI.abi,
        provider,
      );

      // Fetch royalty info
      let royaltyInfo = {
        royaltyFee: BigInt(0),
        royaltyReceiver: '',
      };

      try {
        const royaltyFee = await nftContract.ROYALTY_FEE();
        // For royalty receiver, we'll call royaltyInfo with a dummy token ID and sale price
        // Since we need a valid token ID, let's try with token ID 1 (if it exists)
        try {
          const [receiver] = await nftContract.royaltyInfo(1, BigInt(10000));
          royaltyInfo = {
            royaltyFee,
            royaltyReceiver: receiver,
          };
        } catch {
          // If token 1 doesn't exist, use the organizer as the receiver
          royaltyInfo = {
            royaltyFee,
            royaltyReceiver: eventDetails.eventInfo.organizer,
          };
        }
      } catch (err) {
        console.error('Failed to fetch royalty info:', err);
      }

      // Fetch categories
      let categories: any[] = [];
      let hasCategories = false;
      let totalCapacity = 0;
      let totalSold = 0;
      let totalRevenue = BigInt(0);

      try {
        categories = await eventContract.getAllCategories();
        hasCategories = categories.length > 0;

        if (hasCategories) {
          // Calculate stats from categories
          const categoryStats = categories.map((category) => {
            const revenue = BigInt(category.price) * BigInt(category.sold);
            totalCapacity += Number(category.maxSupply);
            totalSold += Number(category.sold);
            totalRevenue += revenue;

            return {
              name: category.name,
              price: BigInt(category.price),
              maxSupply: BigInt(category.maxSupply),
              sold: BigInt(category.sold),
              revenue: revenue,
            };
          });

          setEventStats({
            totalCapacity,
            totalSold,
            availableTickets: totalCapacity - totalSold,
            totalRevenue,
            royaltyInfo,
            hasCategories: true,
            categories: categoryStats,
          });
        } else {
          // Use basic event data
          totalCapacity = Number(eventDetails.maxTickets);
          totalSold = Number(eventDetails.eventInfo.ticketsSold);
          totalRevenue = eventDetails.eventInfo.totalRevenue;

          setEventStats({
            totalCapacity,
            totalSold,
            availableTickets: totalCapacity - totalSold,
            totalRevenue,
            royaltyInfo,
            hasCategories: false,
          });
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        // Fallback to basic stats
        totalCapacity = Number(eventDetails.maxTickets);
        totalSold = Number(eventDetails.eventInfo.ticketsSold);
        totalRevenue = eventDetails.eventInfo.totalRevenue;

        setEventStats({
          totalCapacity,
          totalSold,
          availableTickets: totalCapacity - totalSold,
          totalRevenue,
          royaltyInfo,
          hasCategories: false,
        });
      }
    } catch (err) {
      console.error('Failed to fetch event stats:', err);
      setError('Failed to load event statistics');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      fetchEventStats();
    }
  }, [eventId, fetchEventStats]);

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEthValue = (value: bigint) => {
    const ethValue = Number(formatEther(value));
    if (ethValue === 0) return '0 ETH';
    if (ethValue < 0.0001) return `${ethValue.toFixed(7)} ETH`;
    if (ethValue < 0.01) return `${ethValue.toFixed(6)} ETH`;
    if (ethValue < 1) return `${ethValue.toFixed(5)} ETH`;
    return `${ethValue.toFixed(4)} ETH`;
  };

  if (isLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center transition-colors ${
          isDark ? 'bg-gray-900' : 'bg-gray-50'
        }`}
      >
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-red-600 mx-auto mb-4"
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
            className={`transition-colors ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            Loading event statistics...
          </p>
        </div>
      </div>
    );
  }

  if (error || !eventData || !eventStats) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center transition-colors ${
          isDark ? 'bg-gray-900' : 'bg-gray-50'
        }`}
      >
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3
            className={`text-xl font-semibold mb-2 transition-colors ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}
          >
            Unable to Load Statistics
          </h3>
          <p
            className={`mb-4 transition-colors ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {error || 'The event statistics could not be loaded.'}
          </p>
          <button
            onClick={() => navigate(`/event/${eventId}`)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Back to Event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => navigate(`/event/${eventId}`)}
              className={`mr-4 p-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-white hover:bg-gray-50 text-gray-600'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <div>
              <h1
                className={`text-3xl font-bold transition-colors ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                Event Statistics
              </h1>
              <h2
                className={`text-xl transition-colors ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {eventData.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div
            className={`rounded-2xl p-6 shadow-sm transition-colors ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {eventStats.totalSold.toLocaleString()}
              </div>
              <p
                className={`transition-colors ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Tickets Sold
              </p>
            </div>
          </div>

          <div
            className={`rounded-2xl p-6 shadow-sm transition-colors ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {formatEthValue(eventStats.totalRevenue)}
              </div>
              <p
                className={`transition-colors ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Total Revenue
              </p>
            </div>
          </div>

          <div
            className={`rounded-2xl p-6 shadow-sm transition-colors ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {eventStats.availableTickets.toLocaleString()}
              </div>
              <p
                className={`transition-colors ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Available
              </p>
            </div>
          </div>

          <div
            className={`rounded-2xl p-6 shadow-sm transition-colors ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {((eventStats.totalSold / eventStats.totalCapacity) * 100).toFixed(1)}%
              </div>
              <p
                className={`transition-colors ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Capacity Filled
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Royalty Information */}
          <div
            className={`rounded-2xl p-8 shadow-sm transition-colors ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <h3
              className={`text-2xl font-bold mb-6 transition-colors ${
                isDark ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              Royalty Information
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span
                  className={`transition-colors ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Royalty Fee:
                </span>
                <span
                  className={`font-semibold transition-colors ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  {Number(eventStats.royaltyInfo.royaltyFee) / 100}%
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span
                  className={`transition-colors ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Royalty Receiver:
                </span>
                <span
                  className={`font-mono text-sm break-all transition-colors ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  {eventStats.royaltyInfo.royaltyReceiver
                    ? `${eventStats.royaltyInfo.royaltyReceiver.slice(0, 6)}...${eventStats.royaltyInfo.royaltyReceiver.slice(-4)}`
                    : 'Not set'}
                </span>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div
                  className={`text-sm transition-colors ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Secondary market sales can generate{' '}
                  {Number(eventStats.royaltyInfo.royaltyFee) / 100}% royalties for the event organizer.
                </div>
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div
            className={`rounded-2xl p-8 shadow-sm transition-colors ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <h3
              className={`text-2xl font-bold mb-6 transition-colors ${
                isDark ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              Event Details
            </h3>
            <div className="space-y-4">
              <div>
                <span
                  className={`block text-sm transition-colors ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Organizer
                </span>
                <span
                  className={`font-mono text-sm transition-colors ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  {eventData.organizer.slice(0, 6)}...{eventData.organizer.slice(-4)}
                </span>
              </div>
              <div>
                <span
                  className={`block text-sm transition-colors ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Event Date
                </span>
                <span
                  className={`transition-colors ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  {formatDate(eventData.eventStartTime)} at {formatTime(eventData.eventStartTime)}
                </span>
              </div>
              <div>
                <span
                  className={`block text-sm transition-colors ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Venue
                </span>
                <span
                  className={`transition-colors ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  {eventData.venue}
                </span>
              </div>
              <div>
                <span
                  className={`block text-sm transition-colors ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  NFT Contract
                </span>
                <span
                  className={`font-mono text-sm transition-colors ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  {eventData.nftContract.slice(0, 6)}...{eventData.nftContract.slice(-4)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {eventStats.hasCategories && eventStats.categories && (
          <div
            className={`mt-8 rounded-2xl p-8 shadow-sm transition-colors ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <h3
              className={`text-2xl font-bold mb-6 transition-colors ${
                isDark ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              Category Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={`border-b transition-colors ${
                      isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <th
                      className={`text-left py-3 px-4 transition-colors ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Category
                    </th>
                    <th
                      className={`text-left py-3 px-4 transition-colors ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Price (ETH)
                    </th>
                    <th
                      className={`text-left py-3 px-4 transition-colors ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Sold / Total
                    </th>
                    <th
                      className={`text-left py-3 px-4 transition-colors ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Revenue (ETH)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eventStats.categories.map((category, index) => (
                    <tr
                      key={index}
                      className={`border-b transition-colors ${
                        isDark ? 'border-gray-700' : 'border-gray-200'
                      }`}
                    >
                      <td
                        className={`py-3 px-4 transition-colors ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {category.name}
                      </td>
                      <td
                        className={`py-3 px-4 transition-colors ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {formatEthValue(category.price)}
                      </td>
                      <td
                        className={`py-3 px-4 transition-colors ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {Number(category.sold)} / {Number(category.maxSupply)}
                      </td>
                      <td
                        className={`py-3 px-4 transition-colors ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {formatEthValue(category.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventStatsPage;
