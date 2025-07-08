import { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Contract, JsonRpcProvider, formatEther } from 'ethers';
import { useAccount, useBalance } from 'wagmi';
import type { EventData } from '../types/event.types.ts';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import {
  createTicketURIHelperUtil,
  fetchFirstImageFromIPFS,
  TicketPurchaseInput,
} from '../utils/ipfs-helper.util.ts';
import {
  purchaseSingleTicket,
  purchaseCategoryTickets,
} from '../utils/contractInteractions';
import { TicketCategory } from '../types/ticket.types.ts';
import { APP_DOMAIN } from '../config/app.config.ts';
import { useTheme } from '../hooks/theme.hook.ts';
import LoadingModal from './LoadingModal';
import { useLoadingModal } from '../hooks/useLoadingModal.hook';
import { v4 as uuidv4 } from 'uuid';
import API_ENDPOINTS from '../config/api.config.ts';

interface CategorySelection {
  categoryIndex: number;
  quantity: number;
}

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventData;
  onSuccess?: () => void;
}

const TicketPurchaseModal = ({
  isOpen,
  onClose,
  event,
  onSuccess,
}: TicketPurchaseModalProps) => {
  console.log('event', event);
  const { isDark } = useTheme();
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });
  
  // Loading modal state
  const {
    isOpen: isLoadingModalOpen,
    action: loadingAction,
    customMessage: loadingMessage,
    progress: loadingProgress,
    onClose: modalOnClose,
    actionButton: modalActionButton,
    showTicketPurchaseModal,
    showTransactionPendingModal,
    showMetadataUploadModal,
    showSuccessModal,
    showErrorModal,
    hideLoadingModal,
    updateMessage,
    updateProgress,
  } = useLoadingModal();
  
  const [quantity, setQuantity] = useState(0);
  const [quantityInput, setQuantityInput] = useState('0'); // String state for input display
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [categorySelections, setCategorySelections] = useState<
    CategorySelection[]
  >([]);
  const [categoryInputs, setCategoryInputs] = useState<string[]>([]); // String states for category inputs
  const [hasCategories, setHasCategories] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [maxTicketsPerWallet, setMaxTicketsPerWallet] = useState<number>(0);
  const [currentUserTickets, setCurrentUserTickets] = useState<number>(0);
  const [walletLimitError, setWalletLimitError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const NETWORK_URL =
        import.meta.env.VITE_NETWORK_URL || 'http://127.0.0.1:8545';
      const provider = new JsonRpcProvider(NETWORK_URL);
      const contract = new Contract(
        event.eventContract,
        EventContractABI.abi,
        provider,
      );

      // Fetch maxTicketsPerWallet and current user balance in parallel
      const [categoriesData, maxTicketsLimit] = await Promise.all([
        contract.getAllCategories(),
        contract.maxTicketsPerWallet(),
      ]);

      setMaxTicketsPerWallet(Number(maxTicketsLimit));

      // Fetch current user ticket balance if wallet is connected and NFT contract exists
      if (address && event.nftContract) {
        try {
          const nftContract = new Contract(
            event.nftContract,
            [
              {
                inputs: [{ name: 'owner', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function',
              },
            ],
            provider,
          );
          const userBalance = await nftContract.balanceOf(address);
          setCurrentUserTickets(Number(userBalance));
        } catch (error) {
          console.error('Failed to fetch user ticket balance:', error);
          setCurrentUserTickets(0);
        }
      } else {
        setCurrentUserTickets(0);
      }

      if (categoriesData.length > 0) {
        setHasCategories(true);

        // Fetch images for each category
        const categoriesWithImages = await Promise.all(
          categoriesData.map(
            async (category: TicketCategory, index: number) => {
              let image = '';
              try {
                // Fetch metadata from IPFS
                const response = await fetch(category.categoryURI);
                const metadata = await response.json();
                image = metadata.image || '';
              } catch (error) {
                console.error(
                  `Failed to fetch image for category ${index}:`,
                  error,
                );
                // Use fallback image
                image =
                  'https://static.vecteezy.com/system/resources/previews/002/779/812/non_2x/cartoon-illustration-of-ticket-free-vector.jpg';
              }

              return {
                name: category.name,
                price: category.price,
                maxSupply: category.maxSupply,
                sold: category.sold,
                isActive: category.isActive,
                categoryURI: category.categoryURI,
                image,
              };
            },
          ),
        );

        setCategories(categoriesWithImages);

        // Initialize selections for each category
        setCategorySelections(
          categoriesWithImages.map((_, index) => ({
            categoryIndex: index,
            quantity: 0,
          })),
        );

        // Initialize input strings for each category
        setCategoryInputs(categoriesWithImages.map(() => '0'));
      } else {
        setHasCategories(false);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setHasCategories(false);
    } finally {
      setLoadingCategories(false);
    }
  }, [event.eventContract]);

  // Fetch categories when modal opens
  useEffect(() => {
    if (isOpen && event.eventContract) {
      fetchCategories();
    }
  }, [isOpen, event.eventContract, fetchCategories]);

  const updateCategoryQuantity = (
    categoryIndex: number,
    newQuantity: number,
  ) => {
    const finalQuantity = validateQuantity(Math.max(0, newQuantity), categoryIndex);
    
    setCategorySelections((prev) =>
      prev.map((selection) =>
        selection.categoryIndex === categoryIndex
          ? { ...selection, quantity: finalQuantity }
          : selection,
      ),
    );
    
    // Update the input string to match the new quantity
    setCategoryInputs(prev => {
      const newInputs = [...prev];
      newInputs[categoryIndex] = finalQuantity.toString();
      return newInputs;
    });
  };

  const getTotalPrice = () => {
    if (!hasCategories) {
      return (Number(event.ticketPrice) * quantity) / 1e18;
    }

    return categorySelections.reduce((total, selection) => {
      if (selection.quantity > 0) {
        const category = categories[selection.categoryIndex];
        // Use BigInt for precise calculation
        const priceInWei = category.price * BigInt(selection.quantity);
        return total + Number(priceInWei) / 1e18;
      }
      return total;
    }, 0);
  };

  const getTotalTickets = () => {
    if (!hasCategories) return quantity;
    return categorySelections.reduce(
      (total, selection) => total + selection.quantity,
      0,
    );
  };

  const getMaxAllowedQuantity = () => {
    if (maxTicketsPerWallet === 0) return Infinity; // No limit
    return Math.max(0, maxTicketsPerWallet - currentUserTickets);
  };

  const validateQuantity = (newQuantity: number, categoryIndex?: number) => {
    const maxAllowed = getMaxAllowedQuantity();
    
    if (!hasCategories) {
      // Single ticket mode
      return Math.min(newQuantity, maxAllowed);
    } else {
      // Category mode - check total across all categories
      const currentSelections = [...categorySelections];
      if (categoryIndex !== undefined) {
        currentSelections[categoryIndex] = { categoryIndex, quantity: newQuantity };
      }
      
      const totalSelected = currentSelections.reduce((sum, sel) => sum + sel.quantity, 0);
      
      if (totalSelected <= maxAllowed) {
        return newQuantity;
      } else {
        // Calculate how many we can add to this category
        const otherTickets = currentSelections
          .filter((_, idx) => idx !== categoryIndex)
          .reduce((sum, sel) => sum + sel.quantity, 0);
        return Math.max(0, maxAllowed - otherTickets);
      }
    }
  };

  const checkWalletLimit = () => {
    if (maxTicketsPerWallet === 0) {
      setWalletLimitError(null);
      return true; // No limit set
    }

    const totalTicketsRequested = getTotalTickets();
    const newTotalTickets = currentUserTickets + totalTicketsRequested;

    if (newTotalTickets > maxTicketsPerWallet) {
      const availableSlots = maxTicketsPerWallet - currentUserTickets;
      setWalletLimitError(
        availableSlots <= 0
          ? `Wallet limit reached. Maximum ${maxTicketsPerWallet} tickets per wallet allowed.`
          : `Wallet limit exceeded. You can only purchase ${availableSlots} more ticket${availableSlots === 1 ? '' : 's'} (${currentUserTickets}/${maxTicketsPerWallet} currently owned).`
      );
      return false;
    }

    setWalletLimitError(null);
    return true;
  };

  const checkSufficientBalance = () => {
    if (!balance || !isConnected) {
      setBalanceError('Wallet not connected');
      return false;
    }

    const totalPriceEth = getTotalPrice();
    const userBalanceEth = parseFloat(formatEther(balance.value));
    
    // Add some buffer for gas fees (estimate ~0.01 ETH)
    const gasBuffer = 0.00001;
    const requiredBalance = totalPriceEth + gasBuffer;

    if (userBalanceEth < requiredBalance) {
      setBalanceError(
        `Insufficient balance. You need ${requiredBalance.toFixed(4)} ETH (including gas fees) but only have ${userBalanceEth.toFixed(4)} ETH`
      );
      return false;
    }

    setBalanceError(null);
    return true;
  };

  const trackTicketPurchase = () => {
    // Get or generate user_id from localStorage
    let userId = localStorage.getItem('eventchain_user_id');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('eventchain_user_id', userId);
    }

    const payload = JSON.stringify({
      user_id: userId,
      event_type: 'button_click',
      event_name: 'ticket_purchased_button_click',
      event_data: {
        button_location: 'ticket_purchase_modal',
        timestamp: new Date().toISOString(),
        event_id: event.eventId,
        event_title: event.title,
        event_organizer: event.organizer,
        total_price: getTotalPrice(),
        total_tickets: getTotalTickets(),
        has_categories: hasCategories,
        ticket_details: hasCategories 
          ? categorySelections.filter(selection => selection.quantity > 0).map(selection => ({
              category_index: selection.categoryIndex,
              category_name: categories[selection.categoryIndex]?.name,
              quantity: selection.quantity,
              price_per_ticket: Number(categories[selection.categoryIndex]?.price || 0) / 1e18
            }))
          : [{ 
              category_name: 'single_ticket',
              quantity: quantity,
              price_per_ticket: Number(event.ticketPrice || 0) / 1e18
            }]
      },
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    });

    // Use sendBeacon for reliable tracking
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon(API_ENDPOINTS.ADD_EVENT, blob);
      if (success) {
        console.log('Ticket purchase tracked successfully');
      } else {
        console.error('Failed to track ticket purchase');
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
        console.error('Error tracking ticket purchase:', error);
      });
    }
  };

  const handlePurchase = async () => {
    try {
      // Show initial loading modal
      showTicketPurchaseModal('Preparing your ticket purchase...');

      // First check if user has sufficient balance and wallet limits
      if (!checkSufficientBalance() || !checkWalletLimit()) {
        hideLoadingModal();
        return;
      }

      // Track the ticket purchase attempt
      trackTicketPurchase();

      if (!hasCategories) {
        // Single ticket purchase
        updateMessage('Fetching event images...');
        const eventPrimaryImage = await fetchFirstImageFromIPFS(
          event.eventImages,
        );
        console.log('eventPrimaryImage', eventPrimaryImage);

        const defaultImage =
          'https://static.vecteezy.com/system/resources/previews/002/779/812/non_2x/cartoon-illustration-of-ticket-free-vector.jpg';
        const finalImage = eventPrimaryImage || defaultImage;

        // Show metadata upload progress
        showMetadataUploadModal('Creating ticket metadata...', 0);
        
        const ticketMetadata: TicketPurchaseInput = {
          description: event.title || 'eventbook',
          external_url: `${APP_DOMAIN}/event/${event.eventId}`,
          image: finalImage,
          name: event.title || 'eventbook',
          attributes: [
            {
              trait_type: 'Ticket Type',
              value: 'General Admission',
            },
            {
              trait_type: 'Admits',
              value: '1',
            },
          ],
        };
        console.log('Ticket metadata being uploaded:', ticketMetadata);
        
        updateProgress(50);
        updateMessage('Uploading ticket metadata to IPFS...');
        
        const ticketURI = await createTicketURIHelperUtil(ticketMetadata);
        if (!ticketURI) {
          throw new Error('Failed to create ticket URI');
        }

        updateProgress(100);

        // Switch to transaction pending
        showTransactionPendingModal('Initiating purchase transaction...');

        // Calculate total price in wei
        if (!event.ticketPrice) {
          throw new Error('Event ticket price not found');
        }
        if (!event.nftContract) {
          throw new Error('NFT contract address not found');
        }

        // Log the contract address and price for verification
        console.log('Using NFT Contract:', event.nftContract);
        console.log('Ticket Price:', event.ticketPrice);
        console.log('Quantity:', quantity);

        const totalPriceInWei = BigInt(event.ticketPrice) * BigInt(quantity);
        console.log('Total Price in Wei:', totalPriceInWei.toString());

        updateMessage('Waiting for wallet confirmation...');

        // Call purchaseSingleTicket directly
        const hash = await purchaseSingleTicket({
          nftContractAddress: event.nftContract,
          quantity,
          tokenURI: ticketURI,
          totalPrice: totalPriceInWei.toString(),
        });

        updateMessage('Transaction submitted to blockchain...');
        console.log('Single ticket purchase hash:', hash);
        
        // Simulate transaction confirmation wait
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } else {
        // Category-based purchase
        const selectedCategories = categorySelections.filter(
          (s) => s.quantity > 0,
        );
        if (selectedCategories.length === 0) {
          throw new Error('No tickets selected');
        }

        showMetadataUploadModal('Processing ticket categories...', 0);

        console.log('Starting ticket purchase process...');
        console.log('Selected categories:', selectedCategories);

        const quantities: number[] = [];
        const categoryIds: number[] = [];
        const tokenURIs: string[] = [];
        let totalPriceInWei = 0n;

        const totalCategories = selectedCategories.length;

        for (let i = 0; i < selectedCategories.length; i++) {
          const selection = selectedCategories[i];
          console.log('Processing category selection:', selection);
          const category = categories[selection.categoryIndex];
          console.log('Category details:', category);

          updateProgress((i / totalCategories) * 80); // 80% for metadata creation
          updateMessage(`Processing ${category.name} tickets...`);

          const eventPrimaryImage = category.image;
          const defaultImage =
            'https://static.vecteezy.com/system/resources/previews/002/779/812/non_2x/cartoon-illustration-of-ticket-free-vector.jpg';
          const finalImage = eventPrimaryImage || defaultImage;
          console.log(
            'Category image:',
            eventPrimaryImage,
            'Final image:',
            finalImage,
          );

          const ticketMetadata: TicketPurchaseInput = {
            description: `${event.title} - ${category.name}`,
            external_url: `${APP_DOMAIN}/event/${event.eventId}`,
            image: finalImage,
            name: `${event.title} - ${category.name}`,
            attributes: [
              {
                trait_type: 'Ticket Type',
                value: category.name,
              },
              {
                trait_type: 'Admits',
                value: '1',
              },
            ],
          };
          console.log('Created ticket metadata:', ticketMetadata);

          const ticketURI = await createTicketURIHelperUtil(ticketMetadata);
          console.log('Generated ticket URI:', ticketURI);

          if (!ticketURI) {
            throw new Error('Failed to create ticket URI');
          }

          quantities.push(selection.quantity);
          categoryIds.push(selection.categoryIndex + 1); // Categories are 1-indexed in contract
          tokenURIs.push(ticketURI);
          totalPriceInWei += category.price * BigInt(selection.quantity);

          console.log('Updated purchase arrays:', {
            quantities,
            categoryIds,
            tokenURIs,
            totalPriceInWei: totalPriceInWei.toString(),
          });
        }

        updateProgress(90);
        updateMessage('Uploading all metadata to IPFS...');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateProgress(100);

        console.log('Final purchase parameters:', {
          nftContractAddress: event.nftContract,
          quantities,
          categoryIds,
          tokenURIs,
          totalPrice: totalPriceInWei.toString(),
        });

        // Switch to transaction pending
        showTransactionPendingModal('Initiating purchase transaction...');

        updateMessage('Waiting for wallet confirmation...');

        // Call purchaseCategoryTickets directly
        try {
          console.log('Calling purchaseCategoryTickets...');
          const hash = await purchaseCategoryTickets({
            nftContractAddress: event.nftContract,
            quantities,
            categoryIds,
            tokenURIs,
            totalPrice: totalPriceInWei.toString(),
          });
          
          updateMessage('Transaction submitted to blockchain...');
          console.log('Category tickets purchase successful! Hash:', hash);
          
          // Simulate transaction confirmation wait
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error('Error in purchaseCategoryTickets:', error);
          throw error;
        }
      }

      // Show success modal
      showSuccessModal(
        'Ticket purchase completed successfully! 🎉',
        undefined,
        () => {
          hideLoadingModal();
          onClose();
          if (onSuccess) {
            onSuccess();
          }
        }
      );
    } catch (error) {
      console.error('Purchase failed:', error);
      
      // Show error modal
      showErrorModal(
        `Purchase failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          text: 'Try Again',
          onClick: () => {
            hideLoadingModal();
            // Don't close the modal, let user try again
          }
        },
        () => {
          hideLoadingModal();
        }
      );
    }
  };

  const renderSingleTicketMode = () => (
    <>
      <div className="mt-2">
        {renderDescriptionSection()}

        <div className="mb-6">
          <label
            htmlFor="quantity"
            className={`block text-sm font-medium mb-3 transition-colors ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Number of Tickets
          </label>
          
          {/* Wallet Status Info */}
          {maxTicketsPerWallet > 0 && isConnected && (
            <div className={`mb-4 p-3 rounded-lg border transition-colors ${
              isDark 
                ? 'bg-blue-900/20 border-blue-800/50' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center">
                <svg
                  className={`h-4 w-4 ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className={`ml-2 text-xs font-medium ${
                  isDark ? 'text-blue-300' : 'text-blue-800'
                }`}>
                  Wallet Status: You currently own {currentUserTickets} tickets. You can purchase up to a maximum of {maxTicketsPerWallet} tickets for this event
                  {maxTicketsPerWallet - currentUserTickets > 0 && (
                    <span className={`ml-1 ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      ({maxTicketsPerWallet - currentUserTickets} remaining)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Custom Quantity Selector */}
          <div className="flex items-center justify-center space-x-4">
            <button
              type="button"
              onClick={() => {
                const newQuantity = Math.max(0, quantity - 1);
                setQuantity(newQuantity);
                setQuantityInput(newQuantity.toString());
              }}
              disabled={quantity <= 0}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                isDark
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              } ${quantity <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-500'}`}
            >
              -
            </button>
            
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantityInput}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setQuantityInput(value);
                  // Allow any number including 0, but cap at wallet limit
                  if (value === '') {
                    setQuantity(0); // Use 0 for calculations when empty
                  } else {
                    const parsedValue = parseInt(value);
                    const validatedQuantity = validateQuantity(parsedValue);
                    setQuantity(validatedQuantity);
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  // Ensure input shows a valid value when leaving field
                  const numValue = parseInt(quantityInput);
                  if (quantityInput === '' || isNaN(numValue) || numValue < 0) {
                    setQuantityInput('0');
                    setQuantity(0);
                  }
                }}
                className={`w-20 sm:w-24 px-3 py-3 text-center text-lg font-semibold border-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
            
            <button
              type="button"
              onClick={() => {
                const newQuantity = validateQuantity(quantity + 1);
                setQuantity(newQuantity);
                setQuantityInput(newQuantity.toString());
              }}
              disabled={maxTicketsPerWallet > 0 && currentUserTickets + quantity >= maxTicketsPerWallet}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                isDark
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              +
            </button>
          </div>
          
          <p className={`text-xs text-center mt-2 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Tap the buttons or enter a number
          </p>
        </div>

        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 p-4 rounded-lg ${
          isDark ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <span
            className={`text-base sm:text-lg font-semibold mb-2 sm:mb-0 transition-colors ${
              isDark ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            Total Price:
          </span>
          <span className="text-xl sm:text-2xl font-bold text-red-600">
            {getTotalPrice().toFixed(6)} ETH
          </span>
        </div>
      </div>
    </>
  );

  const renderCategoriesMode = () => (
    <>
      <div className="mt-2">
        {renderDescriptionSection()}

        <div className="space-y-4 mb-6 max-h-64 sm:max-h-96 overflow-y-auto">
          {categories.map((category, index) => {
            const available = Number(category.maxSupply - category.sold);
            const selection = categorySelections[index];

            return (
              <div
                key={index}
                className={`border rounded-lg p-3 sm:p-4 transition-colors ${
                  isDark
                    ? 'border-gray-600 bg-gray-800'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4">
                  {/* Category Image and Details */}
                  <div className="flex items-start space-x-3 sm:space-x-4 flex-1 w-full sm:w-auto">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://static.vecteezy.com/system/resources/previews/002/779/812/non_2x/cartoon-illustration-of-ticket-free-vector.jpg';
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-base sm:text-lg font-semibold truncate transition-colors ${
                          isDark ? 'text-gray-100' : 'text-gray-900'
                        }`}
                      >
                        {category.name}
                      </h4>
                      <p
                        className={`text-sm mb-1 sm:mb-2 transition-colors ${
                          isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}
                      >
                        {formatEther(category.price)} ETH per ticket
                      </p>
                      <p
                        className={`text-xs sm:text-sm transition-colors ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {available > 0
                          ? `${available} tickets available`
                          : 'Sold out'}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between sm:justify-center w-full sm:w-auto">
                    <label
                      className={`text-xs sm:text-sm font-medium mr-3 sm:hidden transition-colors ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Quantity:
                    </label>
                    
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateCategoryQuantity(
                            index,
                            Math.max(0, (selection?.quantity || 0) - 1)
                          )
                        }
                        disabled={available === 0 || (selection?.quantity || 0) <= 0}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-200 ${
                          isDark
                            ? 'border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                        } ${available === 0 || (selection?.quantity || 0) <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-500'}`}
                      >
                        -
                      </button>
                      
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={categoryInputs[index] || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setCategoryInputs(prev => {
                              const newInputs = [...prev];
                              newInputs[index] = value;
                              return newInputs;
                            });
                            updateCategoryQuantity(index, Math.min(available, parseInt(value) || 0));
                          }}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            // Ensure input shows the actual quantity when leaving field
                            const currentSelection = categorySelections[index];
                            if (!categoryInputs[index] || parseInt(categoryInputs[index]) !== currentSelection?.quantity) {
                              setCategoryInputs(prev => {
                                const newInputs = [...prev];
                                newInputs[index] = (currentSelection?.quantity || 0).toString();
                                return newInputs;
                              });
                            }
                          }}
                          disabled={available === 0}
                          className={`w-12 sm:w-16 px-2 py-2 text-center text-sm sm:text-base font-semibold border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 disabled:bg-gray-800 disabled:text-gray-500'
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 disabled:bg-gray-100 disabled:text-gray-500'
                          }`}
                        />
                      </div>
                      
                      <button
                        type="button"
                        onClick={() =>
                          updateCategoryQuantity(
                            index,
                            Math.min(available, (selection?.quantity || 0) + 1)
                          )
                        }
                        disabled={available === 0 || (selection?.quantity || 0) >= available}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-200 ${
                          isDark
                            ? 'border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                        } ${available === 0 || (selection?.quantity || 0) >= available ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-500'}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Summary */}
        <div
          className={`rounded-lg p-4 mb-6 transition-colors ${
            isDark ? 'bg-gray-800' : 'bg-gray-50'
          }`}
        >
          {/* Wallet Status Info for Categories */}
          {maxTicketsPerWallet > 0 && isConnected && (
            <div className={`mb-3 pb-3 border-b transition-colors ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center">
                <svg
                  className={`h-4 w-4 ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className={`ml-2 text-xs font-medium ${
                  isDark ? 'text-blue-300' : 'text-blue-800'
                }`}>
                  Wallet Status: You currently own {currentUserTickets} tickets. You can purchase up to a maximum of {maxTicketsPerWallet} tickets for this event
                  {maxTicketsPerWallet - currentUserTickets > 0 && (
                    <span className={`ml-1 ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      ({maxTicketsPerWallet - currentUserTickets} remaining)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
              <div className="flex justify-between items-center sm:block mb-2 sm:mb-0">
                <span
                  className={`text-sm font-medium transition-colors ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Total Tickets:
                </span>
                <span
                  className={`text-sm font-semibold ml-2 sm:ml-0 transition-colors ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  {getTotalTickets()}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center w-full sm:w-auto">
              <span
                className={`text-base sm:text-lg font-semibold transition-colors ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                Total Price:
              </span>
              <span className="text-lg sm:text-xl font-bold text-red-600 ml-4">
                {getTotalPrice().toFixed(6)} ETH
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderLoadingState = () => (
    <div className="mt-2">
      <div className="flex items-center justify-center py-12">
        <svg
          className="animate-spin h-8 w-8 text-red-600"
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
        <span
          className={`ml-3 transition-colors ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Loading ticket categories...
        </span>
      </div>
    </div>
  );

  const canPurchase = () => {
    if (isLoadingModalOpen) return false;
    if (balanceError || walletLimitError) return false;
    if (!hasCategories) return quantity > 0;
    return getTotalTickets() > 0;
  };

  // Check balance and wallet limits whenever quantities change
  useEffect(() => {
    if (isOpen && balance) {
      checkSufficientBalance();
    }
    if (isOpen && maxTicketsPerWallet > 0) {
      checkWalletLimit();
    }
  }, [quantity, categorySelections, balance, isOpen, maxTicketsPerWallet, currentUserTickets]);

  // Clear errors when modal closes
  useEffect(() => {
    if (!isOpen) {
      setBalanceError(null);
      setWalletLimitError(null);
    }
  }, [isOpen]);

  const truncateDescription = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const renderDescriptionSection = () => {
    const description = event.description || '';
    return (
      <div className="mb-6">
        <p
          className={`text-sm mb-2 transition-colors ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          {truncateDescription(description)}
        </p>
        {description.length > 150 && (
          <button
            onClick={() => (window.location.href = `/event/${event.eventId}`)}
            className="text-red-600 hover:text-red-700 text-sm font-medium underline transition-colors"
          >
            View More Details
          </button>
        )}
      </div>
    );
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 pt-16 sm:pt-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`w-full max-w-xs sm:max-w-lg lg:max-w-2xl max-h-[90vh] mx-4 transform overflow-hidden rounded-xl sm:rounded-2xl ${
                  isDark ? 'bg-gray-900' : 'bg-white'
                } text-left align-middle shadow-xl transition-all flex flex-col`}
              >
                {/* Fixed Header */}
                <div
                  className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  } flex-shrink-0`}
                >
                  <Dialog.Title
                    as="h3"
                    className={`text-lg sm:text-xl lg:text-2xl font-bold leading-6 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    } transition-colors duration-300 truncate`}
                  >
                    {event.title}
                  </Dialog.Title>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
                  {loadingCategories
                    ? renderLoadingState()
                    : hasCategories
                      ? renderCategoriesMode()
                      : renderSingleTicketMode()}
                </div>

                {/* Fixed Footer */}
                <div
                  className={`px-4 sm:px-6 py-3 sm:py-4 border-t ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  } flex-shrink-0`}
                >
                  {/* Balance Error Display */}
                  {balanceError && (
                    <div className={`mb-4 p-3 rounded-md border ${
                      isDark 
                        ? 'bg-red-900/20 border-red-800/50' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg
                            className={`h-5 w-5 ${
                              isDark ? 'text-red-400' : 'text-red-400'
                            }`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className={`text-sm font-medium ${
                            isDark ? 'text-red-300' : 'text-red-800'
                          }`}>
                            {balanceError}
                          </p>
                          {balance && (
                            <p className={`text-xs mt-1 ${
                              isDark ? 'text-red-400' : 'text-red-600'
                            }`}>
                              Current balance: {parseFloat(formatEther(balance.value)).toFixed(4)} ETH
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wallet Limit Error Display */}
                  {walletLimitError && (
                    <div className={`mb-4 p-3 rounded-md border ${
                      isDark 
                        ? 'bg-orange-900/20 border-orange-800/50' 
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg
                            className={`h-5 w-5 ${
                              isDark ? 'text-orange-400' : 'text-orange-400'
                            }`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className={`text-sm font-medium ${
                            isDark ? 'text-orange-300' : 'text-orange-800'
                          }`}>
                            {walletLimitError}
                          </p>
                          {maxTicketsPerWallet > 0 && (
                            <p className={`text-xs mt-1 ${
                              isDark ? 'text-orange-400' : 'text-orange-600'
                            }`}>
                              Wallet limit: {maxTicketsPerWallet} tickets maximum
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-end gap-4 sm:gap-3">
                    <button
                      type="button"
                      className={`inline-flex justify-center rounded-lg border border-transparent ${
                        isDark
                          ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } px-4 py-3 sm:py-2 text-sm sm:text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 transition-colors duration-200 order-2 sm:order-1`}
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-transparent bg-red-600 px-4 py-3 sm:py-2 text-sm sm:text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 order-1 sm:order-2"
                      onClick={handlePurchase}
                      disabled={!canPurchase()}
                    >
                      {isLoadingModalOpen ? 'Processing...' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
      
      {/* Loading Modal */}
      <LoadingModal
        isOpen={isLoadingModalOpen}
        action={loadingAction}
        customMessage={loadingMessage}
        progress={loadingProgress}
        onClose={modalOnClose}
        actionButton={modalActionButton}
      />
    </Transition>
  );
};

export default TicketPurchaseModal;
