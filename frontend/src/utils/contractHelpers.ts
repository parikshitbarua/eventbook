import { JsonRpcProvider, Contract, Signer } from 'ethers';
import type { EventFactoryContract } from '../types/contracts.types.ts';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';

const FACTORY_ADDRESS =
  import.meta.env.VITE_FACTORY_ADDRESS ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const RPC_URL = import.meta.env.VITE_NETWORK_URL || 'http://127.0.0.1:8545';

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
  signer: Signer,
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
  eventStartTime: string; // ISO date string
  eventEndTime: string; // ISO date string
  salesStartTime: string; // ISO date string
  salesEndTime: string; // ISO date string
  venue: string;
  country: string;
  state: string;
  city: string;
  nftName?: string;
  nftSymbol?: string;
  eventImages: File[];
  isEventEditAllowed: boolean;
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
  hasSingleCategory: boolean = false,
): ValidationResult {
  const {
    title,
    description,
    ticketPrice,
    maxTickets,
    eventStartTime,
    eventEndTime,
    salesStartTime,
    salesEndTime,
    venue,
    country,
    state,
    city,
  } = formData;

  // Required field validation
  if (!title.trim()) return { isValid: false, error: 'Title is required' };
  if (!description.trim())
    return { isValid: false, error: 'Description is required' };
  if (!venue.trim()) return { isValid: false, error: 'Venue is required' };
  if (!country.trim()) return { isValid: false, error: 'Country is required' };
  if (!state.trim()) return { isValid: false, error: 'State is required' };
  if (!city.trim()) return { isValid: false, error: 'City is required' };

  // Date validation
  const startDate = new Date(eventStartTime);
  const endDate = new Date(eventEndTime);

  if (isNaN(startDate.getTime()))
    return { isValid: false, error: 'Invalid start date' };
  if (isNaN(endDate.getTime()))
    return { isValid: false, error: 'Invalid end date' };

  if (endDate <= startDate) {
    return { isValid: false, error: 'Event end time must be after start time' };
  }

  // Sales date validation
  if (salesStartTime) {
    const salesStartDate = new Date(salesStartTime);
    if (isNaN(salesStartDate.getTime()))
      return { isValid: false, error: 'Invalid sales start date' };
    
    if (salesStartDate > startDate) {
      return { isValid: false, error: 'Sales start time cannot be after event start time' };
    }
  }

  if (salesEndTime) {
    const salesEndDate = new Date(salesEndTime);
    if (isNaN(salesEndDate.getTime()))
      return { isValid: false, error: 'Invalid sales end date' };
    
    if (salesEndDate > startDate) {
      return { isValid: false, error: 'Sales end time cannot be after event start time' };
    }
    
    if (salesStartTime) {
      const salesStartDate = new Date(salesStartTime);
      if (salesEndDate <= salesStartDate) {
        return { isValid: false, error: 'Sales end time must be after sales start time' };
      }
    }
  }

  // Numeric validation for single category events
  if (hasSingleCategory) {
    const priceNum = parseFloat(ticketPrice);
    const maxTicketsNum = parseInt(maxTickets);

    if (isNaN(priceNum) || priceNum < 0) {
      return {
        isValid: false,
        error: 'Ticket price must be a valid positive number',
      };
    }

    if (isNaN(maxTicketsNum) || maxTicketsNum <= 0) {
      return {
        isValid: false,
        error: 'Max tickets must be a positive integer',
      };
    }
  }

  return { isValid: true };
}
