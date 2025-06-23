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
  isUsed: boolean;
}

const MyTickets: React.FC = () => {
  const { isDark } = useTheme();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [unusedTickets, setUnusedTickets] = useState<TicketNFT[]>([]);
  const [usedTickets, setUsedTickets] = useState<TicketNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null); // Track which ticket is generating QR
  
  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
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

                // Get ticket status to check if it's used
                const ticketInfo = await nftContract.getTicket(tokenId);
                const isUsed = ticketInfo.isUsed;

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
                  isUsed: isUsed,
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

      setUnusedTickets(userTickets.filter(ticket => !ticket.isUsed));
      setUsedTickets(userTickets.filter(ticket => ticket.isUsed));
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

  // Watch for wallet connection changes and refresh
  useEffect(() => {
    if (isConnected && address && error) {
      // Clear error state and refresh when wallet gets connected
      setError(null);
      fetchUserTickets();
    }
  }, [isConnected, address, error, fetchUserTickets]);

  const handleGenerateQR = async (ticket: TicketNFT) => {
    if (!walletClient || !address) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Wallet Not Connected',
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
        qrData: data.data,
      });

    } catch (error: unknown) {
      console.error('Error generating QR:', error);
      
      setModal({
        isOpen: true,
        type: 'error',
        title: 'QR Generation Failed',
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
                Connect Your Wallet to View Tickets
              </h2>

              {/* Description */}
              <p
                className={`text-lg ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                } mb-8 max-w-2xl mx-auto transition-colors duration-300`}
              >
                Your wallet connection is required to access your NFT tickets. 
                Connect to view, manage, and use your blockchain-based event tickets.
              </p>

              {/* Features List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a1 1 0 001 1h1a1 1 0 001-1V7a2 2 0 00-2-2H5zM5 21a2 2 0 002-2v-3a1 1 0 00-1-1H5a1 1 0 00-1 1v3a2 2 0 002 2h0z" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    NFT Ticket Collection
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    View all your NFT tickets in one place, including used and unused tickets.
                  </p>
                </div>

                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2h8a2 2 0 012 2v6zM8 9l8 8m0-8l-8 8" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    QR Code Generation
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    Generate secure QR codes for event entry and ticket validation.
                  </p>
                </div>

                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    Transferable Assets
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    Transfer or trade your NFT tickets on secondary marketplaces.
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
                  className="text-red-600 hover:text-red-700 underline"
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

  if (unusedTickets.length === 0 && usedTickets.length === 0) {
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
            You have {unusedTickets.length} unused ticket{unusedTickets.length !== 1 ? 's' : ''} and {usedTickets.length} used ticket{usedTickets.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Unused Tickets Section */}
        {unusedTickets.length > 0 && (
          <div className="mb-12">
            <h2
              className={`text-2xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              } mb-6 transition-colors duration-300`}
            >
              Active Tickets ({unusedTickets.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {unusedTickets.map((ticket) => (
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
        )}

        {/* Used Tickets Section */}
        {usedTickets.length > 0 && (
          <div>
            <h2
              className={`text-2xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              } mb-6 transition-colors duration-300`}
            >
              Used Tickets ({usedTickets.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {usedTickets.map((ticket) => (
                <div
                  key={`${ticket.nftContract}-${ticket.tokenId}`}
                  className={`${
                    isDark
                      ? 'bg-gray-800 border-gray-600 shadow-lg shadow-black/20'
                      : 'bg-gray-50 border-gray-200 shadow-lg'
                  } rounded-xl border overflow-hidden opacity-75 transition-all duration-300 group relative`}
                >
                  {/*/!* Used Badge *!/*/}
                  {/*<div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg backdrop-blur-sm z-10">*/}
                  {/*  USED*/}
                  {/*</div>*/}

                  <div className="aspect-square relative overflow-hidden">
                    {ticket.image ? (
                      <img
                        src={ticket.image}
                        alt={`Ticket #${ticket.tokenId}`}
                        className="w-full h-full object-cover grayscale"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div
                      className={`${ticket.image ? 'hidden' : ''} w-full h-full bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 flex items-center justify-center`}
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
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm">
                      #{ticket.tokenId}
                    </div>

                    {/* Category Type Badge */}
                    {ticket.attributes && ticket.attributes.find(attr => attr.trait_type === 'Category') && (
                      <div className="absolute bottom-3 left-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm">
                        {ticket.attributes.find(attr => attr.trait_type === 'Category')?.value}
                      </div>
                    )}

                    {/* Overlay for used effect */}
                    <div className="absolute inset-0 bg-black/20"></div>
                  </div>

                  <div
                    className={`p-5 ${
                      isDark
                        ? 'bg-gradient-to-b from-gray-800 to-gray-700/30'
                        : 'bg-gradient-to-b from-gray-50 to-gray-100/30'
                    } transition-colors duration-300`}
                  >
                    <h3
                      className={`font-bold ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      } mb-2 truncate text-lg transition-colors duration-300`}
                    >
                      {ticket.name || ticket.eventTitle}
                    </h3>
                    {ticket.description && (
                      <p
                        className={`text-sm ${
                          isDark ? 'text-gray-500' : 'text-gray-500'
                        } mb-3 line-clamp-2 leading-relaxed transition-colors duration-300`}
                      >
                        {ticket.description}
                      </p>
                    )}

                    <div className="pt-4">
                      <button
                        onClick={() =>
                          (window.location.href = `/event/${ticket.eventId}`)
                        }
                        className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white py-2 px-3 rounded-xl font-medium shadow-sm hover:shadow-md backdrop-blur-sm transition-all duration-150 text-xs border-0 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
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
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      <QRModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        qrData={modal.qrData}
      />
    </div>
  );
};

export default MyTickets;
// Test comment
