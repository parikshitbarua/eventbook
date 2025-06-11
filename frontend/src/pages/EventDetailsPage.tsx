import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { JsonRpcProvider, Contract } from 'ethers';
import TicketPurchaseModal from '../components/TicketPurchaseModal';
import type { EventData } from '../utils/models';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import { fetchFirstImageFromIPFS } from '../utils/ipfs-helper.util';

const FACTORY_ADDRESS =
  import.meta.env.FACTORY_ADDRESS ||
  '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const NETWORK_URL = import.meta.env.NETWORK_URL || 'http://127.0.0.1:8545';

interface EventMetadata {
  name?: string;
  description?: string;
  image?: string;
  location?: string;
  website?: string;
  socialMedia?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    facebook?: string;
  };
  tags?: string[];
  ageRestriction?: string;
  dresscode?: string;
  amenities?: string[];
}

interface TicketCategory {
  name: string;
  price: bigint;
  maxSupply: bigint;
  sold: bigint;
  isActive: boolean;
  categoryURI: string;
}

interface EventStats {
  totalCapacity: number;
  totalSold: number;
  availableTickets: number;
  hasCategories: boolean;
}

const EventDetailsPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [eventMetadata, setEventMetadata] = useState<EventMetadata | null>(
    null,
  );
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEventStats = useCallback(
    async (eventContractAddress: string): Promise<EventStats> => {
      try {
        const provider = new JsonRpcProvider(NETWORK_URL);
        const eventContract = new Contract(
          eventContractAddress,
          EventContractABI.abi,
          provider,
        );

        // Fetch all categories
        const categories: TicketCategory[] =
          await eventContract.getAllCategories();

        if (categories.length === 0) {
          // No categories, use the original event data
          const factoryContract = new Contract(
            FACTORY_ADDRESS,
            EventFactoryABI.abi,
            provider,
          );
          const eventDetails = await factoryContract.getEventDetails(
            BigInt(eventId!),
          );

          return {
            totalCapacity: Number(eventDetails.maxTickets),
            totalSold: Number(eventDetails.eventInfo.ticketsSold),
            availableTickets:
              Number(eventDetails.maxTickets) -
              Number(eventDetails.eventInfo.ticketsSold),
            hasCategories: false,
          };
        } else {
          // Calculate totals from categories
          let totalCapacity = 0;
          let totalSold = 0;

          categories.forEach((category) => {
            totalCapacity += Number(category.maxSupply);
            totalSold += Number(category.sold);
          });

          return {
            totalCapacity,
            totalSold,
            availableTickets: totalCapacity - totalSold,
            hasCategories: true,
          };
        }
      } catch (error) {
        console.error('Failed to fetch event stats:', error);
        // Fallback to original data
        return {
          totalCapacity: 0,
          totalSold: 0,
          availableTickets: 0,
          hasCategories: false,
        };
      }
    },
    [eventId],
  );

  const fetchEventDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const provider = new JsonRpcProvider(NETWORK_URL);
      const factoryContract = new Contract(
        FACTORY_ADDRESS,
        EventFactoryABI.abi,
        provider,
      );

      const eventDetails = await factoryContract.getEventDetails(
        BigInt(eventId!),
      );

      // Fetch first image from IPFS
      let firstImageUrl: string | null = null;
      let metadata: EventMetadata | null = null;

      if (eventDetails.eventURI) {
        try {
          const metadataResponse = await fetch(eventDetails.eventURI);
          if (metadataResponse.ok) {
            metadata = await metadataResponse.json();

            if (metadata?.image) {
              firstImageUrl = await fetchFirstImageFromIPFS(metadata.image);
            }
          }
        } catch (err) {
          console.error('Failed to fetch metadata:', err);
        }
      }

      // Fetch ticket categories to calculate proper stats
      const stats = await fetchEventStats(eventDetails.eventInfo.eventContract);

      const eventData: EventData = {
        eventId: Number(eventId),
        title: eventDetails.eventInfo.title,
        description: eventDetails.description,
        organizer: eventDetails.eventInfo.organizer as `0x${string}`,
        ticketPrice: eventDetails.ticketPrice,
        maxTickets: BigInt(stats.totalCapacity), // Use calculated capacity
        ticketsSold: BigInt(stats.totalSold), // Use calculated sold count
        ticketsLeft: BigInt(stats.availableTickets), // Use calculated available
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
      };

      setEvent(eventData);
      setEventMetadata(metadata);
      setEventStats(stats);
    } catch (err) {
      console.error('Failed to fetch event details:', err);
      setError('Failed to load event details');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, fetchEventStats]);

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
    }
  }, [eventId, fetchEventDetails]);

  const handlePurchase = async (quantity: number, categoryId?: number) => {
    try {
      console.log('Purchasing tickets:', { quantity, categoryId, eventId });
      // TODO: Implement actual purchase logic
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  };

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

  const formatDateTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
          <p className="text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error || !event || !eventStats) {
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
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Event Not Found
          </h3>
          <p className="text-gray-500 mb-4">
            {error || 'The requested event could not be found.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative h-96 md:h-[500px] overflow-hidden">
        <img
          src={
            event.eventImages ||
            'https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2024-07/Tomorrowland.jpg?itok=IhV-aC4t'
          }
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="absolute inset-0 flex items-end">
          <div className="container mx-auto px-6 pb-12">
            <div className="text-white">
              <div className="flex items-center mb-4">
                <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold mr-4">
                  Live Event
                </span>
                <span className="text-sm opacity-75">
                  {eventStats.availableTickets > 0
                    ? `${eventStats.availableTickets.toLocaleString()} tickets left`
                    : 'Sold Out'}
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                {event.title}
              </h1>
              <div className="flex flex-wrap items-center text-lg opacity-90 space-x-6">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
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
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
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
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Event Description */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                About This Event
              </h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                {event.description}
              </p>

              {eventMetadata?.tags && (
                <div className="flex flex-wrap gap-2">
                  {eventMetadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Event Statistics */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Event Statistics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {eventStats.totalCapacity.toLocaleString()}
                  </div>
                  <p className="text-gray-600">Total Capacity</p>
                  {eventStats.hasCategories && (
                    <p className="text-xs text-gray-500 mt-1">
                      Across all categories
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {eventStats.totalSold.toLocaleString()}
                  </div>
                  <p className="text-gray-600">Tickets Sold</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {eventStats.availableTickets.toLocaleString()}
                  </div>
                  <p className="text-gray-600">Available</p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            {(eventMetadata?.ageRestriction ||
              eventMetadata?.dresscode ||
              eventMetadata?.amenities) && (
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Event Information
                </h2>
                <div className="space-y-4">
                  {eventMetadata?.ageRestriction && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                        <svg
                          className="w-3 h-3 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          Age Restriction
                        </h4>
                        <p className="text-gray-600">
                          {eventMetadata.ageRestriction}
                        </p>
                      </div>
                    </div>
                  )}

                  {eventMetadata?.dresscode && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                        <svg
                          className="w-3 h-3 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          Dress Code
                        </h4>
                        <p className="text-gray-600">
                          {eventMetadata.dresscode}
                        </p>
                      </div>
                    </div>
                  )}

                  {eventMetadata?.amenities && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                        <svg
                          className="w-3 h-3 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          Amenities
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {eventMetadata.amenities.map((amenity, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ticket Purchase Card */}
            <div className="bg-white rounded-2xl p-8 shadow-sm sticky top-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-red-600 mb-2">
                  {event.ticketPrice ? Number(event.ticketPrice) / 1e18 : 0} ETH
                </div>
                <p className="text-gray-600">Starting from</p>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                disabled={eventStats.availableTickets === 0}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-colors ${
                  eventStats.availableTickets === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {eventStats.availableTickets === 0 ? 'Sold Out' : 'Buy Tickets'}
              </button>

              <div className="mt-4 text-center text-sm text-gray-500">
                {eventStats.availableTickets > 0 && (
                  <p>
                    {eventStats.availableTickets.toLocaleString()} tickets
                    remaining
                  </p>
                )}
              </div>
            </div>

            {/* Event Details Card */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Event Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">Date & Time</h4>
                    <p className="text-gray-600">
                      {formatDateTime(event.eventStartTime)} -{' '}
                      {formatTime(event.eventEndTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">Venue</h4>
                    <p className="text-gray-600">{event.venue}</p>
                    {eventMetadata?.location && (
                      <p className="text-gray-500 text-sm">
                        {eventMetadata.location}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">Organizer</h4>
                    <p className="text-gray-600 font-mono text-sm">
                      {event.organizer
                        ? `${event.organizer.slice(0, 6)}...${event.organizer.slice(-4)}`
                        : 'Unknown'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Total Capacity
                    </h4>
                    <p className="text-gray-600">
                      {eventStats.totalCapacity.toLocaleString()} attendees
                    </p>
                    {eventStats.hasCategories && (
                      <p className="text-gray-500 text-sm">
                        Multiple ticket categories available
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            {eventMetadata?.socialMedia && (
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  Follow Event
                </h3>
                <div className="space-y-3">
                  {eventMetadata.socialMedia.website && (
                    <a
                      href={eventMetadata.socialMedia.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <svg
                        className="w-5 h-5 mr-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Website
                    </a>
                  )}
                  {eventMetadata.socialMedia.twitter && (
                    <a
                      href={eventMetadata.socialMedia.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <svg
                        className="w-5 h-5 mr-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                      </svg>
                      Twitter
                    </a>
                  )}
                  {eventMetadata.socialMedia.instagram && (
                    <a
                      href={eventMetadata.socialMedia.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <svg
                        className="w-5 h-5 mr-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.5 2A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11a2.5 2.5 0 002.5-2.5v-11A2.5 2.5 0 0015.5 2h-11zM10 7a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 100 2 1 1 0 000-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Instagram
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="fixed bottom-6 left-6">
        <button
          onClick={() => navigate('/')}
          className="bg-white shadow-lg rounded-full p-3 hover:shadow-xl transition-shadow"
        >
          <svg
            className="w-6 h-6 text-gray-600"
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
      </div>

      {/* Ticket Purchase Modal */}
      {event && (
        <TicketPurchaseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          event={event}
          onPurchase={handlePurchase}
        />
      )}
    </div>
  );
};

export default EventDetailsPage;
