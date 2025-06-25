import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi';
import { parseEther, keccak256, toUtf8Bytes, Interface } from 'ethers';
import { useDropzone } from 'react-dropzone';
import {
  CONTRACT_CONFIG,
  validateEventForm,
  type CreateEventParams,
} from '../utils/contractHelpers';
import {
  locationData,
  getStatesForCountry,
  getCitiesForState,
  type State,
  type City,
} from '../data/locations';
import {
  uploadImagesToIPFSHelperUtil,
  createEventURIHelper,
} from '../utils/ipfs-helper.util.ts';

import { useTheme } from '../hooks/theme.hook.ts';
import LoadingModal from '../components/LoadingModal';
import { useLoadingModal } from '../hooks/useLoadingModal.hook';

const NewEventPage = () => {
  const { isDark } = useTheme();
  const {
    writeContractAsync,
    isPending,
    error: writeError,
  } = useWriteContract();
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  
  // Loading modal state
  const {
    isOpen: isLoadingModalOpen,
    action: loadingAction,
    customMessage: loadingMessage,
    progress: loadingProgress,
    onClose: modalOnClose,
    actionButton: modalActionButton,
    showEventCreationModal,
    showMetadataUploadModal,
    showContractDeploymentModal,
    showTransactionPendingModal,
    showSuccessModal,
    showErrorModal,
    hideLoadingModal,
    updateMessage,
    updateProgress,
  } = useLoadingModal();
  
  const [availableStates, setAvailableStates] = useState<State[]>([]);
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  const [txHash, setTxHash] = useState<`0x${string}`>('0x');
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });
  const [hasSingleCategory, setHasSingleCategory] = useState(false);

  const [formData, setFormData] = useState<CreateEventParams>({
    title: '',
    description: '',
    ticketPrice: '',
    maxTickets: '',
    eventStartTime: '',
    eventEndTime: '',
    venue: '',
    country: '',
    state: '',
    city: '',
    nftName: '',
    nftSymbol: '',
    eventImages: [],
  });

  // Log write errors from wagmi
  useEffect(() => {
    if (writeError) {
      console.error('Wagmi write error:', writeError);
    }
  }, [writeError]);

  useEffect(() => {
    if (receipt?.logs && receipt.logs.length > 0) {
      const eventCreatedSignature =
        'EventCreated(uint256,address,address,address,string)';
      const eventCreatedTopic = keccak256(toUtf8Bytes(eventCreatedSignature));

      const eventCreatedLog = receipt.logs.find(
        (log) =>
          log.topics &&
          log.topics.length > 0 &&
          log.topics[0] === eventCreatedTopic,
      );

      if (eventCreatedLog) {
        try {
          const parsedLog = new Interface(CONTRACT_CONFIG.abi).parseLog({
            topics: eventCreatedLog.topics as string[],
            data: eventCreatedLog.data,
          });

          if (parsedLog) {
            const { eventId, organizer, eventContract, nftContract } =
              parsedLog.args;

            if (!hasSingleCategory) {
              // Navigate to add-tickets only if not single category
              navigate('/add-tickets', {
                state: {
                  eventId: eventId.toString(),
                  organizer: organizer,
                  eventContract: eventContract,
                  nftContract: nftContract,
                  transactionHash: receipt.transactionHash,
                  eventTitle: formData.title,
                  eventDescription: formData.description,
                  receipt: receipt,
                  eventCreatedLog: eventCreatedLog,
                },
              });
            }
          }
        } catch (decodeError) {
          console.error('Error decoding EventCreated log:', decodeError);
        }
      }
    }
  }, [
    receipt,
    navigate,
    formData.title,
    formData.description,
    hasSingleCategory,
  ]);



  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    // Auto-uppercase the NFT symbol
    const processedValue = name === 'nftSymbol' ? value.toUpperCase() : value;

    // Handle country change - reset state and city
    if (name === 'country') {
      const states = getStatesForCountry(value);
      setAvailableStates(states);
      setAvailableCities([]);
      setFormData({
        ...formData,
        [name]: processedValue,
        state: '',
        city: '',
      });
      return;
    }

    // Handle state change - reset city
    if (name === 'state') {
      const cities = getCitiesForState(formData.country, value);
      setAvailableCities(cities);
      setFormData({
        ...formData,
        [name]: processedValue,
        city: '',
      });
      return;
    }

    setFormData({ ...formData, [name]: processedValue });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFormData((prev) => ({
      ...prev,
      eventImages: [...prev.eventImages, ...acceptedFiles],
    }));
  }, []);

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      eventImages: prev.eventImages.filter((_, i) => i !== index),
    }));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    },
    multiple: true,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPending || isLoadingModalOpen) return;

    // Check wallet connection first
    if (!isConnected || !address) {
      alert('Please connect your wallet before creating an event');
      return;
    }

    // Show initial loading modal
    showEventCreationModal('Preparing to create your event...');

    // Validate form data
    const validation = validateEventForm(formData, hasSingleCategory);
    if (!validation.isValid) {
      hideLoadingModal();
      alert(validation.error);
      return;
    }

    const {
      title,
      description,
      ticketPrice,
      maxTickets,
      eventStartTime,
      eventEndTime,
      venue,
      nftName,
      nftSymbol,
      country,
      city,
      state,
    } = formData;

    try {
      let imageDirectoryCID: string | undefined;
      if (formData.eventImages && formData.eventImages.length > 0) {
        // Show metadata upload with progress
        showMetadataUploadModal('Uploading event images to IPFS...', 0);
        
        // Simulate progress during image upload
        updateProgress(20);
        imageDirectoryCID = await uploadImagesToIPFSHelperUtil(
          formData.eventImages,
        );
        
        if (!imageDirectoryCID) {
          hideLoadingModal();
          alert('Failed to upload images. Please try again.');
          return;
        }
        
        updateProgress(60);
      }
      
      updateMessage('Creating event metadata...');
      updateProgress(80);
      
      const eventURI = await createEventURIHelper(
        title,
        description,
        country,
        city,
        state,
        venue,
        imageDirectoryCID || '',
      );
      
      updateProgress(100);
      
      // Convert dates to Unix timestamps
      const startTimestamp = Math.floor(
        new Date(eventStartTime).getTime() / 1000,
      );
      const endTimestamp = Math.floor(new Date(eventEndTime).getTime() / 1000);

      // Add detailed logging for maxTickets
      console.log('maxTickets value at different stages:');
      console.log('1. Raw form value:', maxTickets);
      console.log('2. After parseInt:', parseInt(maxTickets));
      console.log('3. After BigInt conversion:', BigInt(maxTickets).toString());
      console.log('4. Type of maxTickets:', typeof maxTickets);

      console.log('Contract Config:', CONTRACT_CONFIG);
      console.log('Transaction Args:', {
        title,
        description,
        ticketPrice: hasSingleCategory
          ? parseEther(ticketPrice).toString()
          : '0',
        maxTickets: hasSingleCategory ? maxTickets : '0',
        maxTicketsBigInt: hasSingleCategory
          ? BigInt(maxTickets).toString()
          : '0',
        eventURI: eventURI || '',
        startTimestamp,
        endTimestamp,
        venue,
        nftName,
        nftSymbol,
      });

      // Show contract deployment modal
      showContractDeploymentModal('Deploying your event smart contract...');
      updateMessage('Waiting for wallet confirmation...');
      
      console.log('Calling writeContractAsync...');
      const tx = await writeContractAsync({
        address: CONTRACT_CONFIG.address,
        abi: CONTRACT_CONFIG.abi,
        functionName: 'createEvent',
        args: [
          title,
          description,
          hasSingleCategory ? parseEther(ticketPrice) : BigInt(0),
          hasSingleCategory ? BigInt(maxTickets) : BigInt(0),
          eventURI || '',
          BigInt(startTimestamp),
          BigInt(endTimestamp),
          venue,
          nftName,
          nftSymbol,
        ],
      });
      
      console.log('Transaction successful:', tx);
      setTxHash(tx as `0x${string}`);

      // Show transaction pending
      showTransactionPendingModal('Event creation transaction submitted to blockchain...');
      updateMessage('Waiting for blockchain confirmation...');

      if (hasSingleCategory) {
        // For single category events, show success modal
        setTimeout(() => {
          showSuccessModal(
            'Event has been successfully created! 🎉',
            {
              text: 'Continue to Home',
              onClick: () => {
                hideLoadingModal();
                navigate('/');
              }
            },
            () => {
              hideLoadingModal();
              navigate('/');
            }
          );
        }, 2000);
      } else {
        // For multi-category events, hide modal and navigate
        setTimeout(() => {
          hideLoadingModal();
        }, 2000);
      }
    } catch (err) {
      console.error('Contract call failed:', err);
      console.error('Error details:', err);
      
      showErrorModal(
        `Failed to create event: ${err instanceof Error ? err.message : 'Unknown error'}`,
        {
          text: 'Try Again',
          onClick: () => {
            hideLoadingModal();
          }
        },
        () => {
          hideLoadingModal();
        }
      );
    }
  };



  return (
    <div
      className={`min-h-screen ${
        isDark
          ? 'bg-gradient-to-br from-gray-900 to-black'
          : 'bg-gradient-to-br from-gray-50 to-gray-100'
      } py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300`}
    >


      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1
            className={`text-4xl font-extrabold ${
              isDark ? 'text-white' : 'text-gray-900'
            } sm:text-5xl transition-colors duration-300`}
          >
            Create New Event
          </h1>
          <p
            className={`mt-4 text-xl ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            } transition-colors duration-300`}
          >
            Fill in the details to create your blockchain-powered event
          </p>
        </div>

        {/* Wallet Connection Required Screen */}
        {!isConnected ? (
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
                Wallet Connection Required
              </h2>

              {/* Description */}
              <p
                className={`text-lg ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                } mb-8 max-w-2xl mx-auto transition-colors duration-300`}
              >
                To create an event on the blockchain, you need to connect your wallet first. 
                This allows you to sign transactions and deploy your event smart contracts.
              </p>

              {/* Features List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    Secure & Decentralized
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    Your event data is stored on the blockchain, ensuring transparency and immutability.
                  </p>
                </div>

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
                    NFT Tickets
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    Create unique NFT tickets that can be traded on secondary markets.
                  </p>
                </div>

                <div className={`p-6 ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                } rounded-xl transition-colors duration-300`}>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className={`font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  } mb-2 transition-colors duration-300`}>
                    Instant Deployment
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  } transition-colors duration-300`}>
                    Deploy your event smart contract in minutes, not days.
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
        ) : (
          /* Event Creation Form */
          <form
            onSubmit={handleSubmit}
            className={`${
              isDark
                ? 'bg-gray-900 shadow-2xl shadow-black/20'
                : 'bg-white shadow-2xl'
            } rounded-3xl overflow-hidden transition-colors duration-300`}
          >
            <div className="px-8 py-10 sm:px-12 sm:py-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-8">
                  <div
                    className={`${
                      isDark ? 'bg-gray-800' : 'bg-gray-50'
                    } p-6 rounded-2xl transition-colors duration-300`}
                  >
                    <h3
                      className={`text-lg font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      } mb-6 transition-colors duration-300`}
                    >
                      Event Information
                    </h3>

                    {/* Title */}
                    <div className="mb-6">
                      <label
                        className={`block text-sm font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        } mb-2 transition-colors duration-300`}
                      >
                        Event Title *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border ${
                          isDark
                            ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                            : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                        } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                        placeholder="Summer Music Festival 2024"
                        required
                      />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                      <label
                        className={`block text-sm font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        } mb-2 transition-colors duration-300`}
                      >
                        Description *
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={4}
                        className={`w-full px-4 py-3 border ${
                          isDark
                            ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                            : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                        } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                        placeholder="Describe your event in detail..."
                        required
                      />
                    </div>

                    {/* Pricing */}
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="singleCategory"
                        checked={hasSingleCategory}
                        onChange={(e) => setHasSingleCategory(e.target.checked)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="singleCategory"
                        className={`ml-2 block text-sm font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        } transition-colors duration-300`}
                      >
                        This event has only one ticket category
                      </label>
                    </div>

                    {hasSingleCategory && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            className={`block text-sm font-medium ${
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            } mb-2 transition-colors duration-300`}
                          >
                            Ticket Price (ETH) *
                          </label>
                          <input
                            type="number"
                            name="ticketPrice"
                            value={formData.ticketPrice}
                            onChange={handleChange}
                            step="0.000001"
                            min="0"
                            className={`w-full px-4 py-3 border ${
                              isDark
                                ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                                : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                            } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                            placeholder="0.1"
                            required={hasSingleCategory}
                          />
                        </div>
                        <div>
                          <label
                            className={`block text-sm font-medium ${
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            } mb-2 transition-colors duration-300`}
                          >
                            Max Tickets *
                          </label>
                          <input
                            type="number"
                            name="maxTickets"
                            value={formData.maxTickets}
                            onChange={handleChange}
                            min="1"
                            className={`w-full px-4 py-3 border ${
                              isDark
                                ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                                : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                            } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                            placeholder="1000"
                            required={hasSingleCategory}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Date & Time */}
                  <div
                    className={`${
                      isDark ? 'bg-gray-800' : 'bg-gray-50'
                    } p-6 rounded-2xl transition-colors duration-300`}
                  >
                    <h3
                      className={`text-lg font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      } mb-6 transition-colors duration-300`}
                    >
                      Schedule
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          className={`block text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-2 transition-colors duration-300`}
                        >
                          Start Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          name="eventStartTime"
                          value={formData.eventStartTime}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border ${
                            isDark
                              ? 'border-gray-600 bg-gray-700 text-white'
                              : 'border-gray-300 bg-white text-gray-900'
                          } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                          required
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-2 transition-colors duration-300`}
                        >
                          End Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          name="eventEndTime"
                          value={formData.eventEndTime}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border ${
                            isDark
                              ? 'border-gray-600 bg-gray-700 text-white'
                              : 'border-gray-300 bg-white text-gray-900'
                          } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div
                    className={`${
                      isDark ? 'bg-gray-800' : 'bg-gray-50'
                    } p-6 rounded-2xl transition-colors duration-300`}
                  >
                    <h3
                      className={`text-lg font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      } mb-6 transition-colors duration-300`}
                    >
                      Location
                    </h3>

                    {/* Venue */}
                    <div className="mb-4">
                      <label
                        className={`block text-sm font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        } mb-2 transition-colors duration-300`}
                      >
                        Venue Name *
                      </label>
                      <input
                        type="text"
                        name="venue"
                        value={formData.venue}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border ${
                          isDark
                            ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                            : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                        } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                        placeholder="Madison Square Garden"
                        required
                      />
                    </div>

                    {/* Country, State, City */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label
                          className={`block text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-2 transition-colors duration-300`}
                        >
                          Country *
                        </label>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border ${
                            isDark
                              ? 'border-gray-600 bg-gray-700 text-white'
                              : 'border-gray-300 bg-white text-gray-900'
                          } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                          required
                        >
                          <option value="">Select Country</option>
                          {locationData.map((country) => (
                            <option key={country.id} value={country.id}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className={`block text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-2 transition-colors duration-300`}
                        >
                          State/Province *
                        </label>
                        <select
                          name="state"
                          value={formData.state}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border ${
                            isDark
                              ? 'border-gray-600 bg-gray-700 text-white'
                              : 'border-gray-300 bg-white text-gray-900'
                          } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                          required
                          disabled={!formData.country}
                        >
                          <option value="">Select State</option>
                          {availableStates.map((state) => (
                            <option key={state.id} value={state.id}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className={`block text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-2 transition-colors duration-300`}
                        >
                          City *
                        </label>
                        <select
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border ${
                            isDark
                              ? 'border-gray-600 bg-gray-700 text-white'
                              : 'border-gray-300 bg-white text-gray-900'
                          } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                          required
                          disabled={!formData.state}
                        >
                          <option value="">Select City</option>
                          {availableCities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  {/* Event Images */}
                  <div
                    className={`${
                      isDark ? 'bg-gray-800' : 'bg-gray-50'
                    } p-6 rounded-2xl transition-colors duration-300`}
                  >
                    <h3
                      className={`text-lg font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      } mb-6 transition-colors duration-300`}
                    >
                      Event Images *
                    </h3>

                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                        isDragActive
                          ? 'border-red-500 bg-red-50'
                          : isDark
                            ? 'border-gray-600 hover:border-red-400 hover:bg-gray-700'
                            : 'border-gray-300 hover:border-red-400 hover:bg-gray-50'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="space-y-4">
                        <div
                          className={`mx-auto w-16 h-16 ${
                            isDark ? 'bg-gray-700' : 'bg-gray-200'
                          } rounded-full flex items-center justify-center transition-colors duration-300`}
                        >
                          <svg
                            className={`w-8 h-8 ${
                              isDark ? 'text-gray-400' : 'text-gray-400'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                        </div>
                        <div>
                          <p
                            className={`text-lg font-medium ${
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            } transition-colors duration-300`}
                          >
                            {isDragActive
                              ? 'Drop images here'
                              : 'Drag & drop images here'}
                          </p>
                          <p
                            className={`text-sm ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            } transition-colors duration-300`}
                          >
                            or click to browse (Max 5MB per image)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Image Preview */}
                    {formData.eventImages.length > 0 && (
                      <div className="mt-6">
                        <h4
                          className={`text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-3 transition-colors duration-300`}
                        >
                          Uploaded Images
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {formData.eventImages.map((file, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Event ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ×
                              </button>
                              <p
                                className={`text-xs ${
                                  isDark ? 'text-gray-400' : 'text-gray-500'
                                } mt-1 truncate transition-colors duration-300`}
                              >
                                {file.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* NFT Configuration */}
                  <div
                    className={`${
                      isDark ? 'bg-gray-800' : 'bg-gray-50'
                    } p-6 rounded-2xl transition-colors duration-300`}
                  >
                    <h3
                      className={`text-lg font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      } mb-6 transition-colors duration-300`}
                    >
                      NFT Configuration
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label
                          className={`block text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-2 transition-colors duration-300`}
                        >
                          NFT Collection Name *
                        </label>
                        <input
                          type="text"
                          name="nftName"
                          value={formData.nftName}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border ${
                            isDark
                              ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                              : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                          } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200`}
                          placeholder="Summer Music Festival 2024 Tickets"
                          required
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-sm font-medium ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          } mb-2 transition-colors duration-300`}
                        >
                          NFT Symbol *
                        </label>
                        <input
                          type="text"
                          name="nftSymbol"
                          value={formData.nftSymbol}
                          onChange={handleChange}
                          maxLength={10}
                          className={`w-full px-4 py-3 border ${
                            isDark
                              ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                              : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                          } rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 uppercase`}
                          placeholder="MUSIC"
                          required
                        />
                        <p
                          className={`text-xs ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          } mt-1 transition-colors duration-300`}
                        >
                          2-10 uppercase letters (automatically converted)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div
                className={`mt-12 pt-8 border-t ${
                  isDark ? 'border-gray-700' : 'border-gray-200'
                } flex justify-end transition-colors duration-300`}
              >
                <button
                  type="submit"
                  disabled={isPending || isLoadingModalOpen}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-8 rounded-xl font-semibold hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {isPending || isLoadingModalOpen ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                      Processing...
                    </div>
                  ) : (
                    'Create Event'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
      
      {/* Loading Modal */}
      <LoadingModal
        isOpen={isLoadingModalOpen}
        action={loadingAction}
        customMessage={loadingMessage}
        progress={loadingProgress}
        onClose={modalOnClose}
        actionButton={modalActionButton}
      />
    </div>
  );
};

export default NewEventPage;
