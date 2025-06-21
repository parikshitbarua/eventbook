import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { JsonRpcProvider, Contract } from 'ethers';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import EventTicketNFTABI from '../contracts/EventTicketNFT.sol/EventTicketNFT.json';
import { NETWORK_URL, FACTORY_ADDRESS } from '../config/app.config';
import { useTheme } from '../hooks/theme.hook.ts';
import { useWalletClient } from 'wagmi';
import QRModal from '../components/QRModal';
import { API_ENDPOINTS } from '../config/api.config';

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
  const { isDark } = useTheme();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [tickets, setTickets] = useState<TicketNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null); // Track which ticket is generating QR
  
  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
    qrData?: {
      tokenId: number;
      eventId: number;
      owner: string;
      expiresAt: number;
      serverSignature: string;
    } | null;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    qrData: null,
  });

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

  const handleGenerateQR = async (ticket: TicketNFT) => {
    if (!walletClient || !address) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Wallet Not Connected',
        message: 'Please connect your wallet first to generate QR codes.',
        qrData: null,
      });
      return;
    }

    const ticketKey = `${ticket.nftContract}-${ticket.tokenId}`;
    setGeneratingQR(ticketKey);

    try {
      // Create the message to sign
      const message = `I am the owner of ticket ${ticket.tokenId} for event ${ticket.eventId}`;
      
      // Request signature from user
      const signature = await walletClient.signMessage({
        message,
      });

      // Call the backend API
      const response = await fetch(API_ENDPOINTS.GENERATE_QR, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId: ticket.tokenId.toString(),
          eventId: ticket.eventId.toString(),
          walletAddress: address,
          userSignature: signature,
          message: message, // Include the message that was signed
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate QR data');
      }

      // Show success modal with QR data
      console.log('QR Data generated successfully:', data);
      setModal({
        isOpen: true,
        type: 'success',
        title: 'QR Code Generated!',
        message: 'Your QR code has been successfully generated and is valid for 10 minutes.',
        qrData: data.data,
      });

    } catch (error: unknown) {
      console.error('Error generating QR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR code';
      
      setModal({
        isOpen: true,
        type: 'error',
        title: 'QR Generation Failed',
        message: errorMessage,
        qrData: null,
      });
    } finally {
      setGeneratingQR(null);
    }
  };

  const closeModal = () => {
    setModal({
      isOpen: false,
      type: 'success',
      title: '',
      message: '',
      qrData: null,
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
            className={`${
              isDark ? 'text-gray-400' : 'text-gray-600'
            } transition-colors duration-300`}
          >
            Loading your tickets...
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
        } flex items-center justify-center transition-colors duration-300`}
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
            className={`text-xl font-semibold ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            } mb-2 transition-colors duration-300`}
          >
            {error}
          </h3>
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
              My Tickets
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
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a1 1 0 001 1h1a1 1 0 001-1V7a2 2 0 00-2-2H5zM5 21a2 2 0 002-2v-3a1 1 0 00-1-1H5a1 1 0 00-1 1v3a2 2 0 002 2h0z"
                />
              </svg>
              <h3
                className={`text-xl font-semibold ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                } mb-2 transition-colors duration-300`}
              >
                No tickets found
              </h3>
              <p
                className={`${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                } mb-6 transition-colors duration-300`}
              >
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
    <div
      className={`min-h-screen ${
        isDark ? 'bg-black' : 'bg-gray-50'
      } py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1
            className={`text-3xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            } mb-2 transition-colors duration-300`}
          >
            My Tickets
          </h1>
          <p
            className={`${
              isDark ? 'text-gray-400' : 'text-gray-600'
            } transition-colors duration-300`}
          >
            You have {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tickets.map((ticket) => (
            <div
              key={`${ticket.nftContract}-${ticket.tokenId}`}
              className={`${
                isDark
                  ? 'bg-gray-900 border-gray-700 shadow-lg shadow-black/20 hover:shadow-black/40 hover:border-red-600'
                  : 'bg-white border-gray-100 shadow-lg hover:shadow-2xl hover:border-red-200'
              } rounded-xl border overflow-hidden hover:-translate-y-1 transition-all duration-300 group`}
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

                {/* Category Type Badge */}
                {ticket.attributes && ticket.attributes.find(attr => attr.trait_type === 'Category') && (
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm">
                    {ticket.attributes.find(attr => attr.trait_type === 'Category')?.value}
                  </div>
                )}

                {/* Decorative corner accent */}
                <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-red-500/20 to-transparent"></div>
              </div>

              <div
                className={`p-5 ${
                  isDark
                    ? 'bg-gradient-to-b from-gray-900 to-gray-800/30'
                    : 'bg-gradient-to-b from-white to-gray-50/30'
                } transition-colors duration-300`}
              >
                <h3
                  className={`font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 truncate text-lg transition-colors duration-300`}
                >
                  {ticket.name || ticket.eventTitle}
                </h3>
                {ticket.description && (
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    } mb-3 line-clamp-2 leading-relaxed transition-colors duration-300`}
                  >
                    {ticket.description}
                  </p>
                )}

                <div
                  className={`space-y-2.5 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}
                >



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

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleGenerateQR(ticket)}
                        disabled={generatingQR === `${ticket.nftContract}-${ticket.tokenId}`}
                        className={`flex-1 ${
                          generatingQR === `${ticket.nftContract}-${ticket.tokenId}`
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-95'
                        } text-white py-2 px-3 rounded-xl font-medium shadow-sm hover:shadow-md backdrop-blur-sm transition-all duration-150 text-xs border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          {generatingQR === `${ticket.nftContract}-${ticket.tokenId}` ? (
                            <>
                              <svg
                                className="animate-spin h-3.5 w-3.5"
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
                              <span className="hidden sm:inline font-medium">Generating...</span>
                              <span className="sm:hidden font-medium">Gen...</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="2.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h4.5v4.5h-4.5v-4.5z"
                                />
                              </svg>
                              <span className="hidden sm:inline font-medium">Scan QR</span>
                              <span className="sm:hidden font-medium">QR</span>
                            </>
                          )}
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          (window.location.href = `/event/${ticket.eventId}`)
                        }
                        className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 active:scale-95 text-white py-2 px-3 rounded-xl font-medium shadow-sm hover:shadow-md backdrop-blur-sm transition-all duration-150 text-xs border-0 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="2.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="hidden sm:inline font-medium">View Event</span>
                          <span className="sm:hidden font-medium">View</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Modal */}
      <QRModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        qrData={modal.qrData}
      />
    </div>
  );
};

export default MyTickets;
