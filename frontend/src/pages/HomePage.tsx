import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JsonRpcProvider, Contract } from 'ethers';
import Confetti from 'react-confetti';
import type { EventData } from '../types/event.types.ts';
import type { EventFactoryContract } from '../types/contracts.types.ts';
import TicketPurchaseModal from '../components/TicketPurchaseModal';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import { fetchFirstImageFromIPFS } from '../utils/ipfs-helper.util';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import { TicketCategory } from '../types/ticket.types.ts';
import { useTheme } from '../hooks/theme.hook.ts';
// const { purchaseTickets } = usePurchaseTickets();

const FACTORY_ADDRESS =
  import.meta.env.VITE_FACTORY_ADDRESS ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const NETWORK_URL = import.meta.env.VITE_NETWORK_URL || 'http://127.0.0.1:8545';

const HomePage = () => {
  const { isDark } = useTheme();
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const provider = new JsonRpcProvider(NETWORK_URL);
        const contract = new Contract(
          FACTORY_ADDRESS,
          EventFactoryABI.abi,
          provider,
        ) as unknown as EventFactoryContract;

        const eventData: EventData[] = [];
        // Get only active event IDs
        const activeEventIds = await contract.getActiveEvents();

        await Promise.all(
          activeEventIds.map(async (eventId: bigint) => {
            let firstImageUrl: string | null = null;
            try {
              // Use getEventDetails instead of events mapping
              const eventDetails = await contract.getEventDetails(eventId);

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
            } catch (err) {
              console.error(`Failed to fetch event ${eventId}:`, err);
            }
          }),
        );

        setAllEvents(eventData);
      } catch (err) {
        console.error('Contract call failed', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Handle window resize for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle success state
  const handlePurchaseSuccess = () => {
    setShowSuccess(true);
    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 5000);
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
          ? 'bg-gray-900 border-gray-700 shadow-lg shadow-black/20'
          : 'bg-white border-gray-200 shadow-lg'
      } rounded-2xl overflow-hidden border animate-pulse transition-colors duration-300`}
    >
      <div
        className={`h-48 w-full ${
          isDark
            ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
            : 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
        } bg-size-200 animate-gradient`}
      ></div>
      <div className="p-4 flex flex-col justify-between h-48">
        <div>
          <div
            className={`h-6 ${
              isDark
                ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                : 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
            } bg-size-200 animate-gradient rounded mb-2`}
          ></div>
          <div
            className={`h-4 ${
              isDark
                ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                : 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
            } bg-size-200 animate-gradient rounded mb-1`}
          ></div>
          <div
            className={`h-4 ${
              isDark
                ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                : 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
            } bg-size-200 animate-gradient rounded w-3/4`}
          ></div>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div
            className={`h-6 ${
              isDark
                ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                : 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
            } bg-size-200 animate-gradient rounded w-20`}
          ></div>
          <div
            className={`h-10 ${
              isDark
                ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                : 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200'
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
        isDark ? 'bg-black' : 'bg-white'
      } px-6 py-10 transition-colors duration-300`}
    >
      <h1 className="text-4xl font-bold text-red-600 text-center mb-10">
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
        isDark ? 'bg-black' : 'bg-white'
      } px-6 py-10 transition-colors duration-300`}
    >
      {/* Confetti Animation */}
      {showSuccess && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}

      {/* Success Message */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`max-w-md mx-4 p-6 rounded-2xl shadow-2xl transform transition-all duration-500 ${
              isDark
                ? 'bg-gray-800 border border-gray-700'
                : 'bg-white border border-gray-200'
            }`}
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-8 w-8 text-green-600"
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
              <h3
                className={`text-lg font-semibold mb-2 transition-colors ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                🎉 Purchase Successful!
              </h3>
              <p
                className={`text-sm transition-colors ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Your tickets have been successfully purchased! Check your wallet
                for the NFT tickets.
              </p>
              <button
                onClick={() => setShowSuccess(false)}
                className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors pointer-events-auto ${
                  isDark
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-4xl font-bold text-red-600 text-center mb-10">
        Upcoming Events
      </h1>

      {allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div
            className={`${
              isDark ? 'text-gray-500' : 'text-gray-400'
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
              isDark ? 'text-white' : 'text-gray-700'
            } mb-2 transition-colors duration-300`}
          >
            No Events Found
          </h3>
          <p
            className={`${
              isDark ? 'text-gray-400' : 'text-gray-500'
            } text-center max-w-md transition-colors duration-300`}
          >
            There are currently no active events available. Check back later or
            create your own event!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {allEvents.map((event) => (
            <div
              key={event.eventId}
              className={`${
                isDark
                  ? 'bg-gray-900 border-gray-700 shadow-lg shadow-black/20 hover:shadow-black/40'
                  : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'
              } rounded-2xl overflow-hidden border transition-all duration-500 ease-in-out hover:scale-105 cursor-pointer`}
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
                <div className="absolute top-4 right-4 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  Live
                </div>
              </div>
              <div className="p-4 flex flex-col justify-between h-48">
                <div>
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
                    } line-clamp-3 transition-colors duration-300`}
                  >
                    {event.description}
                  </p>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-lg font-bold text-red-600">
                    {event.ticketPrice ? Number(event.ticketPrice) / 1e18 : 0}{' '}
                    ETH
                  </span>
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click event
                      setSelectedEvent(event);
                      setIsModalOpen(true);
                    }}
                  >
                    Buy Ticket
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
