import { JsonRpcProvider, Contract } from 'ethers';
import type { EventFactoryContract } from '../types/contracts';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';

const FACTORY_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const RPC_URL = 'http://127.0.0.1:8545';

/**
 * Get an instance of the EventFactory contract with full TypeScript support
 */
export function getEventFactoryContract(): EventFactoryContract {
  const provider = new JsonRpcProvider(RPC_URL);
  return new Contract(
    FACTORY_ADDRESS,
    EventFactoryABI.abi,
    provider,
  ) as unknown as EventFactoryContract;
}

/**
 * Get an instance of the EventFactory contract with a signer for transactions
 */
export function getEventFactoryContractWithSigner(
  signer,
): EventFactoryContract {
  return new Contract(
    FACTORY_ADDRESS,
    EventFactoryABI.abi,
    signer,
  ) as unknown as EventFactoryContract;
}

/**
 * Fetch all active events with proper error handling
 */
export async function fetchActiveEvents() {
  try {
    const contract = getEventFactoryContract();

    // Get active event IDs
    const activeEventIds = await contract.getActiveEvents();
    console.log('Active event IDs:', activeEventIds);

    // Fetch details for each event
    const eventPromises = activeEventIds.map(async (eventId) => {
      try {
        const eventDetails = await contract.getEventDetails(eventId);
        return {
          eventId: Number(eventId),
          eventDetails,
        };
      } catch (error) {
        console.error(`Failed to fetch event ${eventId}:`, error);
        return null;
      }
    });

    const events = await Promise.all(eventPromises);
    return events.filter((event) => event !== null);
  } catch (error) {
    console.error('Failed to fetch active events:', error);
    throw error;
  }
}

/**
 * Get factory statistics
 */
export async function getFactoryStats() {
  try {
    const contract = getEventFactoryContract();

    const [
      totalEvents,
      allEventIds,
      activeEventIds,
      platformFee,
      feeRecipient,
    ] = await Promise.all([
      contract.eventCounter(),
      contract.getAllEventIds(),
      contract.getActiveEvents(),
      contract.platformFee(),
      contract.platformFeeRecipient(),
    ]);

    return {
      totalEvents: Number(totalEvents),
      allEventIds: allEventIds.map((id) => Number(id)),
      activeEventIds: activeEventIds.map((id) => Number(id)),
      platformFee: Number(platformFee),
      platformFeePercent: Number(platformFee) / 100,
      feeRecipient,
    };
  } catch (error) {
    console.error('Failed to fetch factory stats:', error);
    throw error;
  }
}

/**
 * Contract constants for wagmi usage
 */
export const CONTRACT_CONFIG = {
  address: FACTORY_ADDRESS as `0x${string}`,
  abi: EventFactoryABI.abi,
};

/**
 * Event creation parameters interface
 */
export interface CreateEventParams {
  title: string;
  description: string;
  ticketPrice: string; // In ETH
  maxTickets: string;
  eventURI: string;
  eventStartTime: string; // ISO date string
  eventEndTime: string; // ISO date string
  venue: string;
  nftName: string;
  nftSymbol: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate event creation form data
 */
export function validateEventForm(
  formData: CreateEventParams,
): ValidationResult {
  const {
    title,
    description,
    ticketPrice,
    maxTickets,
    eventStartTime,
    eventEndTime,
    venue,
    eventURI,
    nftName,
    nftSymbol,
  } = formData;

  // Required field validation
  if (!title.trim()) return { isValid: false, error: 'Title is required' };
  if (!description.trim())
    return { isValid: false, error: 'Description is required' };
  if (!venue.trim()) return { isValid: false, error: 'Venue is required' };
  if (!eventURI.trim())
    return { isValid: false, error: 'Event URI is required' };
  if (!nftName.trim()) return { isValid: false, error: 'NFT name is required' };
  if (!nftSymbol.trim())
    return { isValid: false, error: 'NFT symbol is required' };

  // NFT symbol validation (should be uppercase, 3-5 characters)
  if (!/^[A-Z]{2,10}$/.test(nftSymbol.trim())) {
    return {
      isValid: false,
      error: 'NFT symbol must be 2-10 uppercase letters (e.g., MUSIC, FEST)',
    };
  }

  // Date validation
  const startDate = new Date(eventStartTime);
  const endDate = new Date(eventEndTime);
  const now = new Date();

  if (isNaN(startDate.getTime()))
    return { isValid: false, error: 'Invalid start date' };
  if (isNaN(endDate.getTime()))
    return { isValid: false, error: 'Invalid end date' };

  if (startDate <= now) {
    return { isValid: false, error: 'Event start time must be in the future' };
  }

  if (endDate <= startDate) {
    return { isValid: false, error: 'Event end time must be after start time' };
  }

  // Numeric validation
  const priceNum = parseFloat(ticketPrice);
  const maxTicketsNum = parseInt(maxTickets);

  if (isNaN(priceNum) || priceNum < 0) {
    return {
      isValid: false,
      error: 'Ticket price must be a valid positive number',
    };
  }

  if (isNaN(maxTicketsNum) || maxTicketsNum <= 0) {
    return { isValid: false, error: 'Max tickets must be a positive integer' };
  }

  // URL validation for eventURI
  try {
    new URL(eventURI);
  } catch {
    return { isValid: false, error: 'Event URI must be a valid URL' };
  }

  return { isValid: true };
}
