import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId,
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

const NewEventPage = () => {
  const {
    writeContractAsync,
    isPending,
    error: writeError,
  } = useWriteContract();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [buttonText, setButtonText] = useState('Create Event');
  const [availableStates, setAvailableStates] = useState<State[]>([]);
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  const [txHash, setTxHash] = useState<`0x${string}`>('0x');
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

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
      // Calculate the correct EventCreated event topic hash
      // EventCreated(uint256 eventId, address organizer, address eventContract, address nftContract, string title)
      const eventCreatedSignature =
        'EventCreated(uint256,address,address,address,string)';
      const eventCreatedTopic = keccak256(toUtf8Bytes(eventCreatedSignature));

      console.log('Looking for EventCreated topic:', eventCreatedTopic);

      // Look for EventCreated event in logs
      const eventCreatedLog = receipt.logs.find(
        (log) =>
          log.topics &&
          log.topics.length > 0 &&
          log.topics[0] === eventCreatedTopic,
      );

      if (eventCreatedLog) {
        console.log('🎉 Event Created Successfully!');
        console.log('Event Created Log:', eventCreatedLog);

        try {
          // Try different event signature variations to match your contract
          const eventSignatures = [
            'event EventCreated(uint256 indexed eventId, address indexed organizer, address eventContract, address nftContract, string title)',
            'event EventCreated(uint256 eventId, address organizer, address eventContract, address nftContract, string title)',
            'event EventCreated(uint256 indexed eventId, address organizer, address eventContract, address nftContract, string title)',
          ];

          let parsedLog = null;

          for (const signature of eventSignatures) {
            try {
              const eventInterface = new Interface([signature]);
              parsedLog = eventInterface.parseLog({
                topics: eventCreatedLog.topics,
                data: eventCreatedLog.data,
              });
              console.log('Successfully parsed with signature:', signature);
              break;
            } catch (error) {
              console.log('Failed with signature:', error);
              continue;
            }
          }

          if (parsedLog) {
            const { eventId, organizer, eventContract, nftContract, title } =
              parsedLog.args;

            console.log('Decoded Event Data:');
            console.log('Event ID:', eventId.toString());
            console.log('Organizer:', organizer);
            console.log('Event Contract:', eventContract);
            console.log('NFT Contract:', nftContract);
            console.log('Title:', title);

            // Navigate to add-tickets with contract addresses
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
          } else {
            throw new Error(
              'Failed to parse EventCreated log with any known signature',
            );
          }
        } catch (decodeError) {
          console.error('Error decoding EventCreated log:', decodeError);
          console.log('Raw log data:', eventCreatedLog.data);

          // Fallback navigation without decoded data
          navigate('/add-tickets', {
            state: {
              transactionHash: receipt.transactionHash,
              eventTitle: formData.title,
              eventDescription: formData.description,
              receipt: receipt,
              eventCreatedLog: eventCreatedLog,
              error: 'Could not decode contract addresses',
            },
          });
        }
      } else {
        console.log('EventCreated event not found in logs');
        console.log(
          'Available topics:',
          receipt.logs.map((log) => log.topics?.[0]).filter(Boolean),
        );
      }
    }
  }, [receipt, navigate, formData.title, formData.description]);

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

    if (isPending || isUploading) return;

    // Check wallet connection first
    if (!isConnected || !address) {
      alert('Please connect your wallet before creating an event');
      return;
    }

    console.log('Wallet connected:', { address, chainId, isConnected });

    setIsUploading(true);
    setButtonText('Uploading Images');

    // Validate form data
    const validation = validateEventForm(formData);
    if (!validation.isValid) {
      setIsUploading(false);
      setButtonText('Create Event');
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
        imageDirectoryCID = await uploadImagesToIPFSHelperUtil(
          formData.eventImages,
        );
        if (!imageDirectoryCID) {
          alert('Failed to upload images. Please try again.');
          return;
        }
      }
      setButtonText('Uploading Event Data');
      const eventURI = await createEventURIHelper(
        title,
        description,
        country,
        city,
        state,
        venue,
        imageDirectoryCID || '',
      );
      // Convert dates to Unix timestamps
      const startTimestamp = Math.floor(
        new Date(eventStartTime).getTime() / 1000,
      );
      const endTimestamp = Math.floor(new Date(eventEndTime).getTime() / 1000);

      console.log('Contract Config:', CONTRACT_CONFIG);
      console.log('Transaction Args:', {
        title,
        description,
        ticketPrice: parseEther(ticketPrice).toString(),
        maxTickets,
        eventURI: eventURI || '',
        startTimestamp,
        endTimestamp,
        venue,
        nftName,
        nftSymbol,
      });

      setButtonText('Creating Event');
      console.log('Calling writeContractAsync...');
      const tx = writeContractAsync({
        address: CONTRACT_CONFIG.address,
        abi: CONTRACT_CONFIG.abi,
        functionName: 'createEvent',
        args: [
          title,
          description,
          parseEther(ticketPrice),
          BigInt(maxTickets),
          eventURI || '', // Empty eventURI
          BigInt(startTimestamp),
          BigInt(endTimestamp),
          venue,
          nftName,
          nftSymbol,
        ],
      });
      console.log('Transaction successful:', tx);
      setTxHash(tx as `0x${string}`);
      alert('Event created successfully!');
    } catch (err) {
      console.error('Contract call failed:', err);
      console.error('Error details:', err);
    } finally {
      setIsUploading(false);
      setButtonText('Create Event');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Create New Event
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Fill in the details to create your blockchain-powered event
          </p>

          {/* Wallet Connection Status (Debug) */}
          <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm text-left max-w-md mx-auto">
            <h3 className="font-medium mb-2">Wallet Status:</h3>
            <p>
              <strong>Connected:</strong> {isConnected ? '✅ Yes' : '❌ No'}
            </p>
            <p>
              <strong>Address:</strong> {address || 'Not connected'}
            </p>
            <p>
              <strong>Chain ID:</strong> {chainId}
            </p>
            <p>
              <strong>Contract Address:</strong> {CONTRACT_CONFIG.address}
            </p>
            {writeError && (
              <p className="text-red-600">
                <strong>Error:</strong> {writeError.message}
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-2xl rounded-3xl overflow-hidden"
        >
          <div className="px-8 py-10 sm:px-12 sm:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-8">
                <div className="bg-gray-50 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Event Information
                  </h3>

                  {/* Title */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                      placeholder="Summer Music Festival 2024"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                      placeholder="Describe your event in detail..."
                      required
                    />
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ticket Price (ETH) *
                      </label>
                      <input
                        type="number"
                        name="ticketPrice"
                        value={formData.ticketPrice}
                        onChange={handleChange}
                        step="0.001"
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                        placeholder="0.1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Tickets *
                      </label>
                      <input
                        type="number"
                        name="maxTickets"
                        value={formData.maxTickets}
                        onChange={handleChange}
                        min="1"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                        placeholder="1000"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="bg-gray-50 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Schedule
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        name="eventStartTime"
                        value={formData.eventStartTime}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        name="eventEndTime"
                        value={formData.eventEndTime}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-gray-50 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Location
                  </h3>

                  {/* Venue */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Venue Name *
                    </label>
                    <input
                      type="text"
                      name="venue"
                      value={formData.venue}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                      placeholder="Madison Square Garden"
                      required
                    />
                  </div>

                  {/* Country, State, City */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Country *
                      </label>
                      <select
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State/Province *
                      </label>
                      <select
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <select
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
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
                <div className="bg-gray-50 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Event Images *
                  </h3>

                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      isDragActive
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300 hover:border-red-400 hover:bg-gray-50'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="space-y-4">
                      <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-400"
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
                        <p className="text-lg font-medium text-gray-700">
                          {isDragActive
                            ? 'Drop images here'
                            : 'Drag & drop images here'}
                        </p>
                        <p className="text-sm text-gray-500">
                          or click to browse (Max 5MB per image)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Image Preview */}
                  {formData.eventImages.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
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
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {file.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* NFT Configuration */}
                <div className="bg-gray-50 p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    NFT Configuration
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        NFT Collection Name *
                      </label>
                      <input
                        type="text"
                        name="nftName"
                        value={formData.nftName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                        placeholder="Summer Music Festival 2024 Tickets"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        NFT Symbol *
                      </label>
                      <input
                        type="text"
                        name="nftSymbol"
                        value={formData.nftSymbol}
                        onChange={handleChange}
                        maxLength={10}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 uppercase"
                        placeholder="MUSIC"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        2-10 uppercase letters (automatically converted)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-end">
              <button
                type="submit"
                disabled={isPending || isUploading}
                className="bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-8 rounded-xl font-semibold hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {isPending || isUploading ? (
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
                    {buttonText}
                  </div>
                ) : (
                  'Create Event'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewEventPage;
