import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { JsonRpcProvider, Contract } from 'ethers';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import EventTicketNFTABI from '../contracts/EventTicketNFT.sol/EventTicketNFT.json';
import { NETWORK_URL, FACTORY_ADDRESS } from '../config/app.config';

interface TicketNFT {
  tokenId: number;
  tokenURI: string;
  image: string | null;
  eventTitle: string;
  eventId: number;
  nftContract: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }> | null;
  external_url: string | null;
  name: string | null;
  description: string | null;
}

const MyTickets: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [tickets, setTickets] = useState<TicketNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicketMetadata = async (
    tokenURI: string,
  ): Promise<{
    image: string | null;
    attributes: Array<{ trait_type: string; value: string }> | null;
    external_url: string | null;
    name: string | null;
    description: string | null;
  }> => {
    try {
      const response = await fetch(tokenURI);
      if (!response.ok) {
        return {
          image: null,
          attributes: null,
          external_url: null,
          name: null,
          description: null,
        };
      }

      const metadata = await response.json();
      const imageUrl: string | null = metadata.image;

      return {
        image: imageUrl,
        attributes: metadata?.attributes || null,
        external_url: metadata?.external_url || null,
        name: metadata?.name || null,
        description: metadata?.description || null,
      };
    } catch (error) {
      console.error('Failed to fetch ticket metadata:', error);
      return {
        image: null,
        attributes: null,
        external_url: null,
        name: null,
        description: null,
      };
    }
  };

  const fetchUserTickets = useCallback(async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to view your tickets');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const provider = new JsonRpcProvider(NETWORK_URL);
      const factoryContract = new Contract(
        FACTORY_ADDRESS,
        EventFactoryABI.abi,
        provider,
      );

      // Get all events
      const allEventIds = await factoryContract.getAllEventIds();
      const userTickets: TicketNFT[] = [];

      // For each event, get the NFT contract and check for user's tickets
      for (const eventId of allEventIds) {
        try {
          const eventDetails = await factoryContract.getEventDetails(eventId);
          const nftContractAddress = eventDetails.eventInfo.nftContract;

          const nftContract = new Contract(
            nftContractAddress,
            EventTicketNFTABI.abi,
            provider,
          );

          // Check if user has any tickets for this event
          const balance = await nftContract.balanceOf(address);

          if (Number(balance) > 0) {
            // Get all token IDs owned by the user
            const tokenIds = await nftContract.getTicketsOfOwner(address);

            // For each token, get metadata and image
            for (const tokenId of tokenIds) {
              try {
                const tokenURI = await nftContract.tokenURI(tokenId);
                const metadata = await fetchTicketMetadata(tokenURI);

                userTickets.push({
                  tokenId: Number(tokenId),
                  tokenURI,
                  image: metadata.image,
                  eventTitle: eventDetails.eventInfo.title,
                  eventId: Number(eventId),
                  nftContract: nftContractAddress,
                  attributes: metadata.attributes,
                  external_url: metadata.external_url,
                  name: metadata.name,
                  description: metadata.description,
                });
              } catch (err) {
                console.error(
                  `Failed to fetch metadata for token ${tokenId}:`,
                  err,
                );
              }
            }
          }
        } catch (err) {
          console.error(`Failed to process event ${eventId}:`, err);
        }
      }

      setTickets(userTickets);
    } catch (err) {
      console.error('Failed to fetch user tickets:', err);
      setError('Failed to load your tickets');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchUserTickets();
  }, [fetchUserTickets]);

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
          <p className="text-gray-600">Loading your tickets...</p>
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

  if (tickets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              My Tickets
            </h1>
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
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a1 1 0 001 1h1a1 1 0 001-1V7a2 2 0 00-2-2H5zM5 21a2 2 0 002-2v-3a1 1 0 00-1-1H5a1 1 0 00-1 1v3a2 2 0 002 2h0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No tickets found
              </h3>
              <p className="text-gray-500 mb-6">
                You don't have any tickets yet. Purchase some tickets to see
                them here!
              </p>
              <button
                onClick={() => (window.location.href = '/')}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Browse Events
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tickets</h1>
          <p className="text-gray-600">
            You have {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tickets.map((ticket) => (
            <div
              key={`${ticket.nftContract}-${ticket.tokenId}`}
              className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl hover:border-red-200 hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="aspect-square relative overflow-hidden">
                {ticket.image ? (
                  <img
                    src={ticket.image}
                    alt={`Ticket #${ticket.tokenId}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={`${ticket.image ? 'hidden' : ''} w-full h-full bg-gradient-to-br from-red-400 via-red-500 to-red-600 flex items-center justify-center`}
                >
                  <svg
                    className="w-16 h-16 text-white opacity-60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a1 1 0 001 1h1a1 1 0 001-1V7a2 2 0 00-2-2H5zM5 21a2 2 0 002-2v-3a1 1 0 00-1-1H5a1 1 0 00-1 1v3a2 2 0 002 2h0z"
                    />
                  </svg>
                </div>

                {/* Enhanced Token ID Badge */}
                <div className="absolute top-3 right-3 bg-gradient-to-r from-gray-900 to-black text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm">
                  #{ticket.tokenId}
                </div>

                {/* Decorative corner accent */}
                <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-red-500/20 to-transparent"></div>
              </div>

              <div className="p-5 bg-gradient-to-b from-white to-gray-50/30">
                <h3 className="font-bold text-gray-900 mb-2 truncate text-lg">
                  {ticket.name || ticket.eventTitle}
                </h3>
                {ticket.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                    {ticket.description}
                  </p>
                )}

                <div className="space-y-2.5 text-sm text-gray-600">
                  <div className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded-lg">
                    <span className="font-medium">Token ID:</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded text-xs border">
                      #{ticket.tokenId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded-lg">
                    <span className="font-medium">Event ID:</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded text-xs border">
                      #{ticket.eventId}
                    </span>
                  </div>

                  {/* Display attributes */}
                  {ticket.attributes && ticket.attributes.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200/70">
                      <h4 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wide">
                        Attributes
                      </h4>
                      <div className="space-y-2">
                        {ticket.attributes.map((attr, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center py-1 px-2 bg-blue-50 rounded-md"
                          >
                            <span className="text-xs text-blue-700 font-medium">
                              {attr.trait_type}:
                            </span>
                            <span className="text-xs font-semibold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                              {attr.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 space-y-2">
                    {/* External URL link */}
                    {/*{ticket.external_url && (*/}
                    {/*  <a*/}
                    {/*    href={ticket.external_url}*/}
                    {/*    target="_blank"*/}
                    {/*    rel="noopener noreferrer"*/}
                    {/*    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200 text-sm text-center block"*/}
                    {/*  >*/}
                    {/*    View Details*/}
                    {/*  </a>*/}
                    {/*)}*/}

                    <button
                      onClick={() =>
                        (window.location.href = `/event/${ticket.eventId}`)
                      }
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3 px-4 rounded-lg font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm"
                    >
                      <span className="flex items-center justify-center gap-2">
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
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        View Event
                      </span>
                    </button>
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

export default MyTickets;
