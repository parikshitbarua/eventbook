import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi';
import { parseEther, keccak256, toUtf8Bytes, Interface } from 'ethers';
import { useDropzone } from 'react-dropzone';
import { JsonRpcProvider, Contract } from 'ethers';
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
  fetchFirstImageFromIPFS,
} from '../utils/ipfs-helper.util.ts';
import { useTheme } from '../hooks/theme.hook.ts';
import LoadingModal from '../components/LoadingModal';
import { useLoadingModal } from '../hooks/useLoadingModal.hook';
import { v4 as uuidv4 } from 'uuid';
import API_ENDPOINTS from '../config/api.config.ts';
import { colors } from '../config/global.themes';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import { FACTORY_ADDRESS, NETWORK_URL } from '../config/app.config';

/**
 * Fetch directory listing from IPFS w3.storage
 * @param cid - IPFS directory CID
 * @returns Array of file objects with name and hash
 */
const fetchIPFSDirectoryListing = async (cid: string): Promise<{name: string, hash: string, type: string}[]> => {
  try {
    // Try w3.storage HTML directory listing
    const directoryUrl = `https://${cid}.ipfs.w3s.link/`;
    console.log('🔍 Fetching directory listing from:', directoryUrl);
    
    const response = await fetch(directoryUrl);
    if (!response.ok) {
      console.log('⚠️ Failed to fetch directory listing');
      return [];
    }
    
    const html = await response.text();
    console.log('📄 Got HTML response, parsing...');
    
    // Parse HTML directory listing
    const fileLinks: {name: string, hash: string, type: string}[] = [];
    const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();
      
      // Skip parent directory and empty links
      if (href === '../' || href === './' || !text || text === '..' || !href) continue;
      
      // Extract just the filename from href (remove any leading slashes or paths)
      const rawFilename = href.split('/').pop() || href;
      const filename = decodeURIComponent(rawFilename);
      
      // Skip if filename is empty or just a slash
      if (!filename || filename === '/') continue;
      
      // Check if it's a file (has extension) or directory
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(filename);
      
      fileLinks.push({
        name: filename,
        hash: '', // We don't get hash from HTML listing
        type: hasExtension ? 'file' : 'directory'
      });
    }
    
    if (fileLinks.length > 0) {
      console.log('✅ Parsed HTML directory listing:', fileLinks);
      return fileLinks;
    }
    
    console.log('⚠️ No files found in directory listing');
    return [];
    
  } catch (error) {
    console.error('❌ Error fetching directory listing:', error);
    return [];
  }
};

/**
 * Convert IPFS images to File objects for form handling (w3.storage compatible)
 * @param imageDirectoryOrUrl - IPFS directory CID or direct image URL
 * @returns Array of File objects
 */
const convertIPFSImagesToFiles = async (imageDirectoryOrUrl: string): Promise<File[]> => {
  try {
    if (!imageDirectoryOrUrl) return [];
    
    const files: File[] = [];
    console.log('🔄 Converting IPFS images to File objects from:', imageDirectoryOrUrl);
    
    // Check if it's a direct image URL (w3.storage format)
    if (imageDirectoryOrUrl.includes('.ipfs.w3s.link/') && /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)$/i.test(imageDirectoryOrUrl)) {
      console.log('🖼️ Detected direct image URL');
      try {
        const response = await fetch(imageDirectoryOrUrl);
        if (response.ok) {
          const blob = await response.blob();
          const rawFilename = imageDirectoryOrUrl.split('/').pop() || 'image.jpg';
          const filename = decodeURIComponent(rawFilename);
          const contentType = response.headers.get('content-type') || blob.type || 'image/jpeg';
          
          const file = new File([blob], `existing-${filename}`, {
            type: contentType,
            lastModified: Date.now(),
          });
          
          files.push(file);
          console.log('✅ Successfully converted direct image:', filename, 'Size:', file.size, 'bytes');
        }
      } catch (error) {
        console.error('❌ Failed to fetch direct image:', error);
      }
    } 
    // Handle CID-based directory approach
    else {
      let cid = imageDirectoryOrUrl;
      
      // Extract CID if it's a full w3.storage URL
      if (imageDirectoryOrUrl.includes('.ipfs.w3s.link')) {
        const match = imageDirectoryOrUrl.match(/https:\/\/([^.]+)\.ipfs\.w3s\.link/);
        if (match) {
          cid = match[1];
        }
      }
      
      console.log('📁 Fetching directory listing for CID:', cid);
      
      // Get the actual directory listing
      const directoryFiles = await fetchIPFSDirectoryListing(cid);
      console.log('📋 Directory contains:', directoryFiles);
      
      if (directoryFiles.length === 0) {
        console.log('⚠️ No files found in directory or failed to fetch listing');
        return [];
      }
      
      // Filter for image files
      const imageFiles = directoryFiles.filter(file => 
        file.type === 'file' && 
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)$/i.test(file.name)
      );
      
      console.log('🖼️ Found image files:', imageFiles.map(f => f.name));
      
      // Fetch each image file using w3.storage gateway
      for (const imageFile of imageFiles) {
         try {
           console.log("🖼️ Processing image file:", imageFile);
           
           // Construct the correct w3.storage URL
           const imageUrl = `https://${cid}.ipfs.w3s.link/${imageFile.name}`;
           console.log('🔍 Fetching image from w3.storage:', imageUrl);
           
           const response = await fetch(imageUrl);
           if (response.ok) {
             const blob = await response.blob();
             
             // Verify it's actually an image by checking the blob type
             if (blob.type && blob.type.startsWith('image/')) {
               const cleanFileName = decodeURIComponent(imageFile.name);
               const file = new File([blob], `existing-${cleanFileName}`, {
                 type: blob.type,
                 lastModified: Date.now(),
               });
               
               files.push(file);
               console.log('✅ Successfully converted:', imageFile.name, 'Size:', file.size, 'bytes', 'Type:', blob.type);
             } else {
               console.log('⚠️ File is not a valid image:', imageFile.name, 'Type:', blob.type);
             }
           } else {
             console.log('⚠️ Failed to fetch image:', imageFile.name, 'Status:', response.status);
           }
         } catch (error) {
           console.error('❌ Error fetching image:', imageFile.name, 'Error:', error);
         }
       }
    }
    
    console.log(`🎉 Successfully converted ${files.length} images from IPFS directory`);
    return files;
    
  } catch (error) {
    console.error('❌ Error converting IPFS images to File objects:', error);
    return [];
  }
};

const EditEventPage = () => {
  const { id: eventId } = useParams<{ id: string }>();
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
  const [isLoadingEventData, setIsLoadingEventData] = useState(true);
  const [eventContract, setEventContract] = useState<string>('');
  const [isEventEditAllowed, setIsEventEditAllowed] = useState(false);

  const [formData, setFormData] = useState<CreateEventParams>({
    title: '',
    description: '',
    ticketPrice: '',
    maxTickets: '',
    eventStartTime: '',
    eventEndTime: '',
    salesStartTime: '',
    salesEndTime: '',
    venue: '',
    country: '',
    state: '',
    city: '',
    nftName: '',
    nftSymbol: '',
    eventImages: [],
    isEventEditAllowed: false,
  });

  // Load existing event data
  useEffect(() => {
    const loadEventData = async () => {
      if (!eventId) return;

      try {
        setIsLoadingEventData(true);
        const provider = new JsonRpcProvider(NETWORK_URL);
        
        // Get factory contract to retrieve event contract address
        const factoryContract = new Contract(
          FACTORY_ADDRESS,
          EventFactoryABI.abi,
          provider,
        );

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
        ] = await factoryContract.events(BigInt(eventId));
        
        setEventContract(eventContractAddress);

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
            ticketsSold: ticketsSoldCount,
            eventContract: eventContractAddress,
            nftContract: nftContractAddress,
            createdAt: creationTime,
            totalRevenue: eventTotalRevenue,
          },
          description,
          ticketPrice: price,
          maxTickets: maxTicketsCount,
          eventURI: uri,
          eventStartTime: startTime,
          eventEndTime: endTime,
          venue: eventVenue,
        };

        // Check if event editing is allowed
        const editAllowed = await eventContractInstance.isEventEditAllowed();
        setIsEventEditAllowed(editAllowed);

        if (!editAllowed) {
          showErrorModal(
            'This event cannot be edited. Event editing was disabled when the event was created.',
            {
              text: 'Go Back',
              onClick: () => {
                hideLoadingModal();
                navigate('/profile/my-events');
              }
            },
            () => {
              hideLoadingModal();
              navigate('/profile/my-events');
            }
          );
          return;
        }

        // Convert timestamps to datetime-local format
        const formatTimestamp = (timestamp: bigint): string => {
          const date = new Date(Number(timestamp) * 1000);
          return date.toISOString().slice(0, 16);
        };

        // Get sales times
        const salesStartTime = await eventContractInstance.salesStartTime();
        const salesEndTime = await eventContractInstance.salesEndTime();

        // Load existing images and location data from IPFS metadata
        let existingImages: File[] = [];
        let metadataLocation = {
          venue: '',
          city: '',
          state: '',
          country: '',
        };
        
        if (eventDetails.eventURI) {
          try {
            updateMessage('Loading existing event metadata...');
            const metadataResponse = await fetch(eventDetails.eventURI);
            if (metadataResponse.ok) {
              const metadata = await metadataResponse.json();
              
              // Extract location information from metadata
              if (metadata) {
                metadataLocation = {
                  venue: metadata.venue || '',
                  city: metadata.city || '',
                  state: metadata.state || '',
                  country: metadata.country || '',
                };
                console.log('Location data extracted from metadata:', metadataLocation);
              }
              
              // Extract images
              if (metadata?.image) {
                console.log('Existing images found in w3storage:', metadata.image);
                updateMessage('Converting w3storage images to editable format...');
                existingImages = await convertIPFSImagesToFiles(metadata.image);
                console.log('Converted to File objects:', existingImages.map(f => ({
                  name: f.name,
                  size: f.size,
                  type: f.type
                })));
                if (existingImages.length > 0) {
                  updateMessage(`Successfully loaded ${existingImages.length} existing images`);
                }
              }
            }
          } catch (err) {
            console.error('Failed to fetch existing metadata:', err);
            updateMessage('Failed to load existing metadata');
          }
        }

        // Check if it's a single category event
        const categories = await eventContractInstance.getAllCategories();
        const isSingleCategory = categories.length === 0 &&
          eventDetails.ticketPrice > 0n && 
          eventDetails.maxTickets > 0n;

        setHasSingleCategory(isSingleCategory);

        // Use location data from metadata, fallback to venue parsing if metadata is not available
        const venueLocation = metadataLocation.country ? metadataLocation : (() => {
          // Fallback: Parse location from venue (assuming format: "Venue Name, City, State, Country")
          const venueParts = eventDetails.venue.split(', ');
          return venueParts.length >= 4 ? {
            venue: venueParts.slice(0, -3).join(', '),
            city: venueParts[venueParts.length - 3],
            state: venueParts[venueParts.length - 2],
            country: venueParts[venueParts.length - 1],
          } : {
            venue: eventDetails.venue,
            city: '',
            state: '',
            country: '',
          };
        })();

        console.log('📋 EditEventPage - Loading Event Data:');
        console.log('🎫 Event ID:', eventId);
        console.log('🏭 Event Contract Address:', eventContractAddress);
        console.log('📝 Event Details (from EventContract):', eventDetails);
        console.log('🔧 Edit Allowed:', editAllowed);
        console.log('🎯 Is Single Category:', isSingleCategory);
        console.log('📍 Metadata Location:', metadataLocation);
        console.log('📍 Final Venue Location (metadata or parsed):', venueLocation);
        console.log('💡 Using location from:', metadataLocation.country ? 'metadata' : 'venue parsing fallback');
        console.log('⏰ Sales Start Time (bigint):', salesStartTime);
        console.log('⏰ Sales End Time (bigint):', salesEndTime);
        console.log('🖼️ Existing Images:', existingImages);
        
        const formDataToSet = {
          title: eventDetails.eventInfo.title,
          description: eventDetails.description,
          ticketPrice: isSingleCategory ? (Number(eventDetails.ticketPrice) / 1e18).toString() : '',
          maxTickets: isSingleCategory ? eventDetails.maxTickets.toString() : '',
          eventStartTime: formatTimestamp(eventDetails.eventStartTime),
          eventEndTime: formatTimestamp(eventDetails.eventEndTime),
          salesStartTime: salesStartTime > 0n ? formatTimestamp(salesStartTime) : '',
          salesEndTime: salesEndTime > 0n ? formatTimestamp(salesEndTime) : '',
          venue: venueLocation.venue,
          country: venueLocation.country,
          state: venueLocation.state,
          city: venueLocation.city,
          nftName: '', // Will be fetched from NFT contract
          nftSymbol: '', // Will be fetched from NFT contract
          eventImages: existingImages,
          isEventEditAllowed: editAllowed,
        };
        
        console.log('💾 Form Data Being Set:', formDataToSet);
        console.log('📅 Formatted Timestamps:');
        console.log('  - Event Start:', formatTimestamp(eventDetails.eventStartTime));
        console.log('  - Event End:', formatTimestamp(eventDetails.eventEndTime));
        console.log('  - Sales Start:', salesStartTime > 0n ? formatTimestamp(salesStartTime) : 'Not set');
        console.log('  - Sales End:', salesEndTime > 0n ? formatTimestamp(salesEndTime) : 'Not set');
        
        // Set form data with existing event details
        setFormData(formDataToSet);

        // Set up location dropdowns
        if (venueLocation.country) {
          const states = getStatesForCountry(venueLocation.country);
          setAvailableStates(states);
          
          if (venueLocation.state) {
            const cities = getCitiesForState(venueLocation.country, venueLocation.state);
            setAvailableCities(cities);
          }
        }

      } catch (error) {
        console.error('Error loading event data from contract:', error);
        showErrorModal(
          'Failed to load event data from the contract. The event may not exist or there was a network error.',
          {
            text: 'Try Again',
            onClick: () => {
              hideLoadingModal();
              loadEventData();
            }
          },
          () => {
            hideLoadingModal();
            navigate('/profile/my-events');
          }
        );
      } finally {
        setIsLoadingEventData(false);
      }
    };

    loadEventData();
  }, [eventId, navigate, showErrorModal, hideLoadingModal]);

  // Log write errors from wagmi
  useEffect(() => {
    if (writeError) {
      console.error('Wagmi write error:', writeError);
    }
  }, [writeError]);

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

  const handleSingleCategoryToggle = (checked: boolean) => {
    setHasSingleCategory(checked);
    if (!checked) {
      // Clear pricing data when unchecking
      setFormData({
        ...formData,
        ticketPrice: '',
        maxTickets: '',
      });
    }
    console.log('🎯 Single Category Toggled:', checked);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Clean file names to remove URL encoding
    const cleanedFiles = acceptedFiles.map(file => {
      const cleanName = decodeURIComponent(file.name);
      // Only create a new File object if the name actually changed
      if (cleanName !== file.name) {
        return new File([file], cleanName, {
          type: file.type,
          lastModified: file.lastModified,
        });
      }
      return file;
    });

    setFormData((prev) => ({
      ...prev,
      eventImages: [...prev.eventImages, ...cleanedFiles],
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

  const trackUpdateEventSubmit = () => {
    // Get or generate user_id from localStorage
    let userId = localStorage.getItem('eventchain_user_id');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('eventchain_user_id', userId);
    }

    const payload = JSON.stringify({
      user_id: userId,
      event_type: 'button_click',
      event_name: 'update_event_button_click',
      event_data: {
        button_location: 'edit_event_page',
        timestamp: new Date().toISOString(),
        event_id: eventId,
        event_title: formData.title,
        event_venue: formData.venue,
        ticket_price: formData.ticketPrice,
        max_tickets: formData.maxTickets,
        has_single_category: hasSingleCategory,
      },
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    });

    // Use sendBeacon for reliable tracking
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon(API_ENDPOINTS.ADD_EVENT, blob);
      if (success) {
        console.log('Update event submission tracked successfully');
      } else {
        console.error('Failed to track update event submission');
      }
    } else {
      // Fallback for browsers that don't support sendBeacon
      fetch(API_ENDPOINTS.ADD_EVENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
        keepalive: true,
      }).catch(error => {
        console.error('Error tracking update event submission:', error);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPending || isLoadingModalOpen) return;

    // Check wallet connection first
    if (!isConnected || !address) {
      showErrorModal(
        'Please connect your wallet before updating the event',
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
      return;
    }

    // Show initial loading modal
    showEventCreationModal('Preparing to update your event...');

    // Validate form data
    const validation = validateEventForm(formData, hasSingleCategory);
    if (!validation.isValid) {
      showErrorModal(
        validation.error,
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
      return;
    }

    // Track the update event submission
    trackUpdateEventSubmit();

    const {
      title,
      description,
      eventStartTime,
      eventEndTime,
      venue,
    } = formData;

    try {
      let imageDirectoryCID: string | undefined;
      if (formData.eventImages && formData.eventImages.length > 0) {
        // Show metadata upload with progress
        showMetadataUploadModal('Uploading updated event images to IPFS...', 0);
        
        // Simulate progress during image upload
        updateProgress(20);
        imageDirectoryCID = await uploadImagesToIPFSHelperUtil(
          formData.eventImages,
        );
        
        if (!imageDirectoryCID) {
          showErrorModal(
            'Failed to upload images. Please try again.',
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
          return;
        }
        
        updateProgress(60);
      }
      
      updateMessage('Creating updated event metadata...');
      updateProgress(80);
      
      const eventURI = await createEventURIHelper(
        title,
        description,
        formData.country,
        formData.city,
        formData.state,
        venue,
        imageDirectoryCID || '',
      );
      
      updateProgress(100);
      
      // Convert dates to Unix timestamps
      const eventStartTimestamp = Math.floor(
        new Date(eventStartTime).getTime() / 1000,
      );
      const eventEndTimestamp = Math.floor(new Date(eventEndTime).getTime() / 1000);

      // Show contract deployment modal
      showContractDeploymentModal('Updating your event on the blockchain...');
      updateMessage('Waiting for wallet confirmation...');
      
      console.log('Calling updateEventDetails on EventContract...');
      console.log('📊 Update Parameters:');
      console.log('  - Title:', title);
      console.log('  - Description:', description);
      console.log('  - Has Single Category:', hasSingleCategory);
      console.log('  - Ticket Price (ETH):', formData.ticketPrice);
      console.log('  - Ticket Price (Wei):', hasSingleCategory ? parseEther(formData.ticketPrice).toString() : '0');
      console.log('  - Max Tickets:', formData.maxTickets);
      console.log('  - Event URI:', eventURI || '');
      console.log('  - Venue:', venue);
      console.log('  - Event Start Timestamp:', eventStartTimestamp);
      console.log('  - Event End Timestamp:', eventEndTimestamp);

      // Call updateEventDetails on the EventContract
      const tx = await writeContractAsync({
        address: eventContract as `0x${string}`,
        abi: EventContractABI.abi,
        functionName: 'updateEventDetails',
        args: [
          title,
          description,
          hasSingleCategory ? parseEther(formData.ticketPrice) : BigInt(0),
          hasSingleCategory ? BigInt(formData.maxTickets) : BigInt(0),
          eventURI || '',
          BigInt(eventStartTimestamp),
          BigInt(eventEndTimestamp),
          venue,
        ],
      });
      
      console.log('Transaction successful:', tx);
      setTxHash(tx as `0x${string}`);

      // Show transaction pending
      showTransactionPendingModal('Event update transaction submitted to blockchain...');
      updateMessage('Waiting for blockchain confirmation...');

      // Show success modal after a delay
      setTimeout(() => {
        showSuccessModal(
          'Event has been successfully updated! 🎉',
          {
            text: 'View Event',
            onClick: () => {
              hideLoadingModal();
              navigate(`/event/${eventId}`);
            }
          },
          () => {
            hideLoadingModal();
            navigate(`/event/${eventId}`);
          }
        );
      }, 2000);

    } catch (err) {
      console.error('Contract call failed:', err);
      console.error('Error details:', err);
      
      showErrorModal(
        `Failed to update event: ${err instanceof Error ? err.message : 'Unknown error'}`,
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

  // Show loading screen while fetching event data
  if (isLoadingEventData) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'bg-zinc-900' : 'bg-slate-50'
        } flex items-center justify-center transition-colors duration-300`}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4" 
               style={{ borderColor: colors.primary }}></div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
            Loading Event Data
          </h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Fetching event details and converting images from w3.storage...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? 'bg-zinc-900'
          : 'bg-slate-50'
      } py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1
            className={`text-4xl font-extrabold ${
              isDark ? 'text-white' : 'text-zinc-800'
            } sm:text-5xl transition-colors duration-300`}
          >
            Edit Event
          </h1>
          <p
            className={`mt-4 text-xl ${
              isDark ? 'text-zinc-300' : 'text-zinc-600'
            } transition-colors duration-300`}
          >
            Update your event details
          </p>
        </div>

        {/* Event Edit Form */}
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
                          : 'border-gray-300 bg-white text-gray-900 placeholder-gray-700'
                      } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                      style={{ 
                        '--tw-ring-color': colors.primary,
                      } as React.CSSProperties}
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
                          : 'border-gray-300 bg-white text-gray-900 placeholder-gray-700'
                      } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                      style={{ 
                        '--tw-ring-color': colors.primary,
                      } as React.CSSProperties}
                      placeholder="Describe your event in detail..."
                      required
                    />
                  </div>

                  {/* Pricing section - editable for single category events */}
                  <div className="mb-6">
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="singleCategory"
                        checked={hasSingleCategory}
                        onChange={(e) => handleSingleCategoryToggle(e.target.checked)}
                        className="h-4 w-4 border-gray-300 rounded focus:ring-2"
                        style={{ 
                          color: colors.primary,
                          '--tw-ring-color': colors.primary,
                        } as React.CSSProperties}
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
                    
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'} mb-4`}>
                      <h4 className={`font-semibold ${isDark ? 'text-blue-300' : 'text-blue-800'} mb-2`}>
                        💡 Ticket Pricing Information
                      </h4>
                      <p className={`text-sm ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
                        {hasSingleCategory 
                          ? "Single category events allow you to set one price and quantity for all tickets. You can modify these values here."
                          : "Multi-category events use separate ticket categories with individual pricing. You can set your ticket categories in the next page after saving your event details"
                        }
                      </p>
                    </div>
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
                              : 'border-gray-300 bg-white text-gray-900 placeholder-gray-700'
                          } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                          style={{ 
                            '--tw-ring-color': colors.primary,
                          } as React.CSSProperties}
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
                              : 'border-gray-300 bg-white text-gray-900 placeholder-gray-700'
                          } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                          style={{ 
                            '--tw-ring-color': colors.primary,
                          } as React.CSSProperties}
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
                        Event Start Date & Time *
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
                        } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                        style={{ 
                          '--tw-ring-color': colors.primary,
                        } as React.CSSProperties}
                        required
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        } mb-2 transition-colors duration-300`}
                      >
                        Event End Date & Time *
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
                        } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                        style={{ 
                          '--tw-ring-color': colors.primary,
                        } as React.CSSProperties}
                        required
                      />
                    </div>
                  </div>

                  {/* Sales Schedule (read-only info) */}
                  {(formData.salesStartTime || formData.salesEndTime) && (
                    <div className="mt-6">
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-100 border border-gray-300'}`}>
                        <h4 className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                          📅 Sales Schedule (Go to "Manage Event" to update sales schedule)
                        </h4>
                        {formData.salesStartTime && (
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Sales Start: {new Date(formData.salesStartTime).toLocaleString()}
                          </p>
                        )}
                        {formData.salesEndTime && (
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Sales End: {new Date(formData.salesEndTime).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
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
                    Event Images
                  </h3>

                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      isDragActive
                        ? 'bg-opacity-10'
                        : isDark
                          ? 'border-gray-600 hover:bg-gray-700'
                          : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    style={{
                      borderColor: isDragActive ? colors.primary : undefined,
                      backgroundColor: isDragActive 
                        ? `${colors.primary}20` 
                        : undefined,
                      '--hover-border-color': colors.primary,
                    } as React.CSSProperties}
                    onMouseEnter={(e) => {
                      if (!isDragActive) {
                        e.currentTarget.style.borderColor = `${colors.primary}66`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDragActive) {
                        e.currentTarget.style.borderColor = isDark ? '#4B5563' : '#D1D5DB';
                      }
                    }}
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
                            ? 'Drop new images here'
                            : 'Drag & drop new images here'}
                        </p>
                        <p
                          className={`text-sm ${
                            isDark ? 'text-gray-400' : 'text-gray-700'
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
                        Event Images ({formData.eventImages.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {formData.eventImages.map((file, index) => {
                          const isExistingImage = file.name.startsWith('existing-');
                          return (
                            <div key={`${file.name}-${index}`} className="relative group">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Event ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                                onError={(e) => {
                                  console.error('Failed to load image:', file.name);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              {/* Image type indicator */}
                              <div className={`absolute top-1 left-1 px-2 py-1 rounded text-xs font-medium ${
                                isExistingImage 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-green-500 text-white'
                              }`}>
                                {isExistingImage ? 'Current' : 'New'}
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-2 -right-2 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all duration-200"
                                style={{
                                  backgroundColor: colors.error,
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.errorHover}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.error}
                                title={isExistingImage ? 'Remove current image' : 'Remove new image'}
                              >
                                ×
                              </button>
                              <p
                                className={`text-xs ${
                                  isDark ? 'text-gray-400' : 'text-gray-700'
                                } mt-1 truncate transition-colors duration-300`}
                                title={file.name}
                              >
                                {isExistingImage 
                                  ? file.name.replace('existing-', '') 
                                  : file.name
                                }
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Image management info */}
                      <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          💡 <strong>Current images</strong> are loaded from W3Storage.
                          <strong> New images</strong> will be uploaded when you save. 
                          You can remove any image and add new ones.
                        </p>
                      </div>
                    </div>
                  )}
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
                          : 'border-gray-300 bg-white text-gray-900 placeholder-gray-700'
                      } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                      style={{ 
                        '--tw-ring-color': colors.primary,
                      } as React.CSSProperties}
                      placeholder="Madison Square Garden"
                      required
                    />
                  </div>

                  {/* Country, State, City */}
                  <div className="grid grid-cols-1 gap-4">
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
                        } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                        style={{ 
                          '--tw-ring-color': colors.primary,
                        } as React.CSSProperties}
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
                        } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                        style={{ 
                          '--tw-ring-color': colors.primary,
                        } as React.CSSProperties}
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
                        } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                        style={{ 
                          '--tw-ring-color': colors.primary,
                        } as React.CSSProperties}
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
                className="text-white py-3 px-8 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                style={{
                  background: `linear-gradient(to right, ${colors.primary}, ${colors.primaryHover})`,
                  '--tw-ring-color': colors.primary,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (!isPending && !isLoadingModalOpen) {
                    e.currentTarget.style.background = `linear-gradient(to right, ${colors.primaryHover}, #3A1F6B)`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPending && !isLoadingModalOpen) {
                    e.currentTarget.style.background = `linear-gradient(to right, ${colors.primary}, ${colors.primaryHover})`;
                  }
                }}
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
                    Updating...
                  </div>
                ) : (
                  'Update Event'
                )}
              </button>
            </div>
          </div>
        </form>
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

export default EditEventPage; 