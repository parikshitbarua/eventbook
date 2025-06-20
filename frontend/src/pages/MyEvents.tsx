import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { JsonRpcProvider, Contract } from 'ethers';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import { fetchFirstImageFromIPFS } from '../utils/ipfs-helper.util';
import type { EventData } from '../types/event.types.ts';
import { NETWORK_URL, FACTORY_ADDRESS } from '../config/app.config';

const MyEvents: React.FC = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEventDetails = useCallback(async (eventId: bigint) => {
    try {
      const provider = new JsonRpcProvider(NETWORK_URL);
      const factoryContract = new Contract(
        FACTORY_ADDRESS,
        EventFactoryABI.abi,
        provider,
      );

      const eventDetails = await factoryContract.getEventDetails(eventId);

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
        maxTickets: eventDetails.maxTickets,
        ticketsSold: eventDetails.eventInfo.ticketsSold,
        ticketsLeft: BigInt(
          eventDetails.maxTickets - eventDetails.eventInfo.ticketsSold,
        ),
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
          <p className="text-gray-600">Loading your events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
          <h3 className="text-xl font-semibold text-gray-700 mb-2">{error}</h3>
          {!isConnected && (
            <div className="flex justify-center">
              <appkit-button />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">My Events</h1>
            <div className="bg-white rounded-lg shadow-sm p-8">
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
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                No Events Found
              </h2>
              <p className="text-gray-500 mb-6">
                You haven't created any events yet.
              </p>
              <button
                onClick={() => navigate('/new-event')}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Events</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <div
              key={event.eventId}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition-all duration-300"
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
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  {event.title}
                </h2>
                <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                  {event.description}
                </p>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg
                      className="w-4 h-4 mr-2 text-red-600"
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
                  <div className="flex items-center text-sm text-gray-600">
                    <svg
                      className="w-4 h-4 mr-2 text-red-600"
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

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-gray-100 gap-3 sm:gap-0">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-red-600">
                      {Number(event.ticketsSold)}/{Number(event.maxTickets)}
                    </span>{' '}
                    tickets sold
                  </div>
                  <div className="flex flex-row sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => navigate(`/event/${event.eventId}`)}
                      className="flex-1 sm:flex-none px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      View
                    </button>
                    {event.isActive && (
                      <button
                        onClick={() =>
                          navigate(`/event/${event.eventId}/manage`)
                        }
                        className="flex-1 sm:flex-none px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyEvents;
