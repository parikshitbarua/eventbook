import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JsonRpcProvider, Contract } from 'ethers';

import type { EventData } from '../types/event.types.ts';
import type { EventFactoryContract } from '../types/contracts.types.ts';
import TicketPurchaseModal from '../components/TicketPurchaseModal';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import { fetchFirstImageFromIPFS } from '../utils/ipfs-helper.util';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import { TicketCategory } from '../types/ticket.types.ts';
import { useTheme } from '../hooks/theme.hook.ts';
import { colors } from "../config/global.themes.ts";

const FACTORY_ADDRESS =
  import.meta.env.VITE_FACTORY_ADDRESS ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const NETWORK_URL = import.meta.env.VITE_NETWORK_URL || 'http://127.0.0.1:8545';

const HomePage = () => {
  const { isDark } = useTheme();
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [liveEvents, setLiveEvents] = useState<EventData[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventData[]>([]);
  const [pastEvents, setPastEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Function to categorize events based on current time
  const categorizeEvents = (events: EventData[]) => {
    const now = Date.now() / 1000; // Current time in seconds
    const live: EventData[] = [];
    const upcoming: EventData[] = [];
    const past: EventData[] = [];

    events.forEach(event => {
      const eventEndTime = Number(event.eventEndTime);
      const hoursUntilEnd = (eventEndTime - now) / 3600;
      if (now > eventEndTime) {
        past.push(event);
      } else if (hoursUntilEnd <= 24) {
        live.push(event);
      } else {
        upcoming.push(event);
      }
    });

    setLiveEvents(live);
    setUpcomingEvents(upcoming);
    setPastEvents(past);
  };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const provider = new JsonRpcProvider(NETWORK_URL);
        const contract = new Contract(
          FACTORY_ADDRESS,
          EventFactoryABI.abi,
          provider,
        );

        const eventData: EventData[] = [];
        // Get only active event IDs
        console.log("calling get active events");
        const activeEventIds = await contract.getActiveEvents();
        console.log("active events", activeEventIds);

        await Promise.all(
          activeEventIds.map(async (eventId: bigint) => {
            let firstImageUrl: string | null = null;
            try {
              // First get the event contract address from factory
              // events() returns a tuple: [eventContract, nftContract, organizer, title, createdAt, isActive, ticketsSold, totalRevenue]
              const [
                eventContractAddress,
                nftContractAddress,
                organizerAddress,
                eventTitle,
                eventCreatedAt,
                eventIsActive,
                eventTicketsSold,
                eventTotalRevenue
              ] = await contract.events(eventId);

              console.log(`🏭 HomePage - Factory response for Event ${eventId}:`, {
                eventContractAddress,
                nftContractAddress,
                organizerAddress,
                eventTitle,
                eventCreatedAt,
                eventIsActive,
                eventTicketsSold,
                eventTotalRevenue
              });

              // Create event contract instance
              const eventContractInstance = new Contract(
                eventContractAddress,
                EventContractABI.abi,
                provider,
              );

              // Get event details directly from the event contract
              const [
                title,
                description,
                eventOrganizer,
                price,
                maxTicketsCount,
                ticketsSoldCount,
                active,
                uri,
                creationTime,
                startTime,
                endTime,
                eventVenue
              ] = await eventContractInstance.getEventDetails();

              // Reconstruct eventDetails object to match the expected format
              const eventDetails = {
                eventInfo: {
                  title,
                  organizer: eventOrganizer,
                  isActive: active,
                  ticketsSold: BigInt(ticketsSoldCount),
                  eventContract: eventContractAddress,
                  nftContract: nftContractAddress,
                  createdAt: BigInt(creationTime),
                  totalRevenue: BigInt(eventTotalRevenue),
                },
                description,
                ticketPrice: BigInt(price),
                maxTickets: BigInt(maxTicketsCount),
                eventURI: uri,
                eventStartTime: BigInt(startTime),
                eventEndTime: BigInt(endTime),
                venue: eventVenue,
              };

              if (eventDetails.eventURI) {
                // Fetch the JSON metadata from the eventURI
                const metadataResponse = await fetch(eventDetails.eventURI);
                if (metadataResponse.ok) {
                  const metadata = await metadataResponse.json();

                  // If metadata has an image field (IPFS directory), fetch the first image
                  if (metadata.image !== '') {
                    firstImageUrl = await fetchFirstImageFromIPFS(
                      metadata.image,
                    );
                  }
                }
              }

              let finalTicketPrice = eventDetails.ticketPrice;

              if (eventDetails.ticketPrice === 0n) {
                try {
                  const provider = new JsonRpcProvider(NETWORK_URL);
                  const contract = new Contract(
                    eventDetails.eventInfo.eventContract,
                    EventContractABI.abi,
                    provider,
                  );

                  const categoriesData = await contract.getAllCategories();
                  if (categoriesData && categoriesData.length > 0) {
                    const categoriesArray = Array.from(
                      categoriesData,
                    ) as TicketCategory[];
                    let lowestPrice = BigInt(categoriesArray[0].price);
                    for (let i = 1; i < categoriesArray.length; i++) {
                      const currentPrice = BigInt(categoriesArray[i].price);
                      if (currentPrice < lowestPrice) {
                        lowestPrice = currentPrice;
                      }
                    }

                    finalTicketPrice = lowestPrice;
                  } else {
                    console.warn(
                      `No valid categories found for event ${eventId}, keeping original ticket price`,
                    );
                    // Keep the original ticketPrice as 0n or set a default
                  }
                } catch (categoryError) {
                  console.error(
                    `Failed to fetch categories for event ${eventId}:`,
                    categoryError,
                  );
                  // Keep the original ticketPrice as 0n in case of error
                }
              }

              eventData.push({
                eventId: Number(eventId),
                title: eventDetails.eventInfo.title,
                description: eventDetails.description,
                organizer: eventDetails.eventInfo.organizer as `0x${string}`,
                ticketPrice: finalTicketPrice,
                maxTickets: eventDetails.maxTickets,
                ticketsSold: eventDetails.eventInfo.ticketsSold,
                ticketsLeft: BigInt(
                  Number(eventDetails.maxTickets) -
                    Number(eventDetails.eventInfo.ticketsSold),
                ),
                isActive: eventDetails.eventInfo.isActive,
                eventURI: eventDetails.eventURI,
                createdAt: eventDetails.eventInfo.createdAt,
                // Additional fields from EventFactory
                eventStartTime: eventDetails.eventStartTime,
                eventEndTime: eventDetails.eventEndTime,
                venue: eventDetails.venue,
                eventContract: eventDetails.eventInfo
                  .eventContract as `0x${string}`,
                nftContract: eventDetails.eventInfo
                  .nftContract as `0x${string}`,
                totalRevenue: eventDetails.eventInfo.totalRevenue,
                eventImages: firstImageUrl ? firstImageUrl : '',
              });

              console.log(`✅ HomePage - Successfully processed Event ${eventId}`);
            } catch (err) {
              console.error(`❌ HomePage - Failed to fetch event ${eventId}:`, err);
              // Log which step failed for better debugging
              if (err instanceof Error) {
                console.error(`Error details: ${err.message}`);
              }
            }
          }),
        );

        setAllEvents(eventData);
        categorizeEvents(eventData);
      } catch (err) {
        console.error('Contract call failed', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handlePurchaseSuccess = () => {
    // Success is now handled by the LoadingModal
  };

  // EventCard component for reusability
  const EventCard = ({ event, eventType }: { event: EventData; eventType: 'live' | 'upcoming' | 'past' }) => {
    const getBadgeConfig = () => {
      switch (eventType) {
        case 'live':
          return { text: 'Live', bgColor: colors.success, textColor: 'text-white' };
        case 'upcoming':
          return { text: 'Upcoming', bgColor: colors.primary, textColor: 'text-white' };
        case 'past':
          return { text: 'Ended', bgColor: '#71717a', textColor: 'text-white' };
        default:
          return { text: 'Live', bgColor: colors.success, textColor: 'text-white' };
      }
    };

    const badge = getBadgeConfig();

    return (
      <div
        className={`${
          isDark
            ? 'bg-zinc-900 border-zinc-700 shadow-lg shadow-black/20 hover:shadow-black/40'
            : 'bg-white border-slate-200 shadow-lg hover:shadow-xl'
        } rounded-2xl overflow-hidden border transition-all duration-500 ease-in-out hover:scale-105 cursor-pointer ${
          eventType === 'past' ? 'opacity-75' : ''
        }`}
        onClick={() => navigate(`/event/${event.eventId}`)}
      >
        <div className="relative">
          <img
            src={
              event.eventImages
                ? event.eventImages
                : 'https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2024-07/Tomorrowland.jpg?itok=IhV-aC4t'
            }
            alt={event.title}
            className="h-48 w-full object-cover"
          />
          <div 
            className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-semibold ${badge.textColor}`}
            style={{ backgroundColor: badge.bgColor }}
          >
            {badge.text}
          </div>
        </div>
      <div className="p-4 flex flex-col justify-between h-48">
        <div>
          <h2
            className={`text-xl font-semibold ${
              isDark ? 'text-white' : 'text-zinc-800'
            } mb-2 transition-colors duration-300`}
          >
            {event.title}
          </h2>
          <p
            className={`text-sm ${
              isDark ? 'text-zinc-400' : 'text-zinc-600'
            } line-clamp-3 transition-colors duration-300`}
          >
            {event.description}
          </p>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <span 
            className="text-lg font-bold"
            style={{ color: colors.accent }}
          >
            {event.ticketPrice ? Number(event.ticketPrice) / 1e18 : 0}{' '}
            ETH
          </span>
          {eventType !== 'past' && (
            <button
              className="text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
              style={{ backgroundColor: colors.primary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click event
                setSelectedEvent(event);
                setIsModalOpen(true);
              }}
            >
              Buy Ticket
            </button>
          )}
        </div>
      </div>
    </div>
    );
  };

  // EventSection component for reusability
  const EventSection = ({ 
    title, 
    events, 
    eventType 
  }: { 
    title: string; 
    events: EventData[]; 
    eventType: 'live' | 'upcoming' | 'past';
  }) => {
    if (events.length === 0) return null;

    return (
      <div className="mb-16">
        <h2 
          className="text-3xl font-bold text-center mb-8"
          style={{ 
            color: title === 'Live Events' 
              ? colors.success 
              : title === 'Upcoming Events'
              ? colors.primary
              : '#71717a'
          }}
        >
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {events.map((event) => (
            <EventCard key={event.eventId} event={event} eventType={eventType} />
          ))}
        </div>
      </div>
    );
  };

  // Loading Spinner Component
  // const LoadingSpinner = () => (
  //   <div className="flex items-center justify-center">
  //     <div className="relative">
  //       <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
  //       <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-red-400 rounded-full animate-spin animation-delay-150"></div>
  //     </div>
  //   </div>
  // );

  // Skeleton Card Component
  const SkeletonCard = () => (
    <div
      className={`${
        isDark
          ? 'bg-zinc-900 border-zinc-700 shadow-lg shadow-black/20'
          : 'bg-white border-slate-200 shadow-lg'
      } rounded-2xl overflow-hidden border animate-pulse transition-colors duration-300`}
    >
      <div
        className={`h-48 w-full ${
          isDark
            ? 'bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700'
            : 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200'
        } bg-size-200 animate-gradient`}
      ></div>
      <div className="p-4 flex flex-col justify-between h-48">
        <div>
          <div
            className={`h-6 ${
              isDark
                ? 'bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700'
                : 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200'
            } bg-size-200 animate-gradient rounded mb-2`}
          ></div>
          <div
            className={`h-4 ${
              isDark
                ? 'bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700'
                : 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200'
            } bg-size-200 animate-gradient rounded mb-1`}
          ></div>
          <div
            className={`h-4 ${
              isDark
                ? 'bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700'
                : 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200'
            } bg-size-200 animate-gradient rounded w-3/4`}
          ></div>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div
            className={`h-6 ${
              isDark
                ? 'bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700'
                : 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200'
            } bg-size-200 animate-gradient rounded w-20`}
          ></div>
          <div
            className={`h-10 ${
              isDark
                ? 'bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700'
                : 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200'
            } bg-size-200 animate-gradient rounded w-24`}
          ></div>
        </div>
      </div>
    </div>
  );

  // Loading State Component
  const LoadingState = () => (
    <div
      className={`min-h-screen ${
        isDark ? 'bg-zinc-900' : 'bg-slate-50'
      } px-6 py-10 transition-colors duration-300`}
    >
      <h1 
        className="text-4xl font-bold text-center mb-10"
        style={{ color: colors.primary }}
      >
        Upcoming Events
      </h1>
      {/*<h1 className="text-4xl font-bold text-red-600 text-center mb-10">*/}
      {/*  Loading Events*/}
      {/*</h1>*/}

      {/*<div className="flex flex-col items-center mb-8">*/}
      {/*  <LoadingSpinner />*/}
      {/*  <p className="text-gray-600 mt-4 text-lg">Fetching events from blockchain...</p>*/}
      {/*  <div className="flex items-center mt-2 text-sm text-gray-500">*/}
      {/*    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>*/}
      {/*    <span>This may take a few moments</span>*/}
      {/*  </div>*/}
      {/*</div>*/}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {[...Array(6)].map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );

  // Show loading state while fetching data
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'bg-zinc-900' : 'bg-slate-50'
      } px-6 py-10 transition-colors duration-300`}
    >
      
      {allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div
            className={`${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            } mb-4 transition-colors duration-300`}
          >
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3
            className={`text-xl font-semibold ${
              isDark ? 'text-white' : 'text-zinc-800'
            } mb-2 transition-colors duration-300`}
          >
            No Events Found
          </h3>
          <p
            className={`${
              isDark ? 'text-zinc-400' : 'text-zinc-600'
            } text-center max-w-md transition-colors duration-300`}
          >
            There are currently no active events available. Check back later or
            create your own event!
          </p>
        </div>
      ) : (
        <>
          {/* Live Events Section */}
          <EventSection title="Live Events" events={liveEvents} eventType="live" />
          
          {/* Upcoming Events Section */}
          <EventSection title="Upcoming Events" events={upcomingEvents} eventType="upcoming" />
          
          {/* Past Events Section */}
          <EventSection title="Past Events" events={pastEvents} eventType="past" />
        </>
      )}

      {selectedEvent && (
        <TicketPurchaseModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
};

export default HomePage;
