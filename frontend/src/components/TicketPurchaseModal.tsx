import { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Contract, JsonRpcProvider, formatEther } from 'ethers';
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

interface CategorySelection {
  categoryIndex: number;
  quantity: number;
}

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventData;
}

const TicketPurchaseModal = ({
  isOpen,
  onClose,
  event,
}: TicketPurchaseModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [categorySelections, setCategorySelections] = useState<
    CategorySelection[]
  >([]);
  const [hasCategories, setHasCategories] = useState(false);

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

      const categoriesData = await contract.getAllCategories();

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
    setCategorySelections((prev) =>
      prev.map((selection) =>
        selection.categoryIndex === categoryIndex
          ? { ...selection, quantity: Math.max(0, newQuantity) }
          : selection,
      ),
    );
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

  const handlePurchase = async () => {
    try {
      setIsLoading(true);

      if (!hasCategories) {
        // Single ticket purchase
        const eventPrimaryImage = await fetchFirstImageFromIPFS(
          event.eventImages,
        );
        console.log('eventPrimaryImage', eventPrimaryImage);

        const defaultImage =
          'https://static.vecteezy.com/system/resources/previews/002/779/812/non_2x/cartoon-illustration-of-ticket-free-vector.jpg';
        const finalImage = eventPrimaryImage || defaultImage;

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
        const ticketURI = await createTicketURIHelperUtil(ticketMetadata);
        if (!ticketURI) {
          throw new Error('Failed to create ticket URI');
        }

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

        // Call purchaseSingleTicket directly
        const hash = await purchaseSingleTicket({
          nftContractAddress: event.nftContract,
          quantity,
          tokenURI: ticketURI,
          totalPrice: totalPriceInWei.toString(),
        });

        console.log('Single ticket purchase hash:', hash);
      } else {
        // Category-based purchase
        const selectedCategories = categorySelections.filter(
          (s) => s.quantity > 0,
        );
        if (selectedCategories.length === 0) {
          throw new Error('No tickets selected');
        }

        console.log('Starting ticket purchase process...');
        console.log('Selected categories:', selectedCategories);

        const quantities: number[] = [];
        const categoryIds: number[] = [];
        const tokenURIs: string[] = [];
        let totalPriceInWei = 0n;

        for (const selection of selectedCategories) {
          console.log('Processing category selection:', selection);
          const category = categories[selection.categoryIndex];
          console.log('Category details:', category);

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

        console.log('Final purchase parameters:', {
          nftContractAddress: event.nftContract,
          quantities,
          categoryIds,
          tokenURIs,
          totalPrice: totalPriceInWei.toString(),
        });

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
          console.log('Category tickets purchase successful! Hash:', hash);
        } catch (error) {
          console.error('Error in purchaseCategoryTickets:', error);
          throw error;
        }
      }

      onClose();
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const renderSingleTicketMode = () => (
    <>
      <div className="mt-2">
        {renderDescriptionSection()}

        <div className="mb-6">
          <label
            htmlFor="quantity"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Number of Tickets
          </label>
          <input
            type="number"
            id="quantity"
            min="1"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value) || 1))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
          />
        </div>

        <div className="flex justify-between items-center mb-6">
          <span className="text-lg font-semibold text-gray-900">
            Total Price:
          </span>
          <span className="text-xl font-bold text-red-600">
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

        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
          {categories.map((category, index) => {
            const available = Number(category.maxSupply - category.sold);
            const selection = categorySelections[index];

            return (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start space-x-4">
                  {/* Category Image */}
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://static.vecteezy.com/system/resources/previews/002/779/812/non_2x/cartoon-illustration-of-ticket-free-vector.jpg';
                    }}
                  />

                  {/* Category Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-semibold text-gray-900 truncate">
                      {category.name}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      {formatEther(category.price)} ETH per ticket
                    </p>
                    <p className="text-sm text-gray-500">
                      {available > 0
                        ? `${available} tickets available`
                        : 'Sold out'}
                    </p>
                  </div>

                  {/* Quantity Input */}
                  <div className="flex-shrink-0 w-24">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={available}
                      value={selection?.quantity || 0}
                      onChange={(e) =>
                        updateCategoryQuantity(
                          index,
                          parseInt(e.target.value) || 0,
                        )
                      }
                      disabled={available === 0}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Total Tickets:
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {getTotalTickets()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">
              Total Price:
            </span>
            <span className="text-xl font-bold text-red-600">
              {getTotalPrice().toFixed(6)} ETH
            </span>
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
        <span className="ml-3 text-gray-600">Loading ticket categories...</span>
      </div>
    </div>
  );

  const canPurchase = () => {
    if (isLoading) return false;
    if (!hasCategories) return quantity > 0;
    return getTotalTickets() > 0;
  };

  const truncateDescription = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const renderDescriptionSection = () => {
    const description = event.description || '';
    return (
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-2">
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
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl max-h-[90vh] transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col">
                {/* Fixed Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 text-gray-900"
                  >
                    {event.title}
                  </Dialog.Title>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {loadingCategories
                    ? renderLoadingState()
                    : hasCategories
                      ? renderCategoriesMode()
                      : renderSingleTicketMode()}
                </div>

                {/* Fixed Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handlePurchase}
                      disabled={!canPurchase()}
                    >
                      {isLoading ? 'Processing...' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default TicketPurchaseModal;
