import { BigNumberish, ContractTransaction } from 'ethers';

// Event data structure returned by the contract
export interface EventInfo {
  eventContract: string;
  nftContract: string;
  organizer: string;
  title: string;
  createdAt: bigint;
  isActive: boolean;
  ticketsSold: bigint;
  totalRevenue: bigint;
}

export interface EventDetails {
  eventInfo: EventInfo;
  description: string;
  ticketPrice: bigint;
  maxTickets: bigint;
  eventURI: string;
  eventStartTime: bigint;
  eventEndTime: bigint;
  venue: string;
}

// EventFactory contract interface for TypeScript autocompletion
export interface EventFactoryContract {
  // View functions
  getActiveEvents(): Promise<bigint[]>;
  getAllEventIds(): Promise<bigint[]>;
  getEventDetails(eventId: BigNumberish): Promise<EventDetails>;
  getEventsByOrganizer(organizer: string): Promise<bigint[]>;
  eventCounter(): Promise<bigint>;
  platformFee(): Promise<bigint>;
  platformFeeRecipient(): Promise<string>;

  // State-changing functions
  createEvent(
    title: string,
    description: string,
    ticketPrice: BigNumberish,
    maxTickets: BigNumberish,
    eventURI: string,
    eventStartTime: BigNumberish,
    eventEndTime: BigNumberish,
    venue: string,
    nftName: string,
    nftSymbol: string,
  ): Promise<ContractTransaction>;

  updateEventStatus(
    eventId: BigNumberish,
    isActive: boolean,
  ): Promise<ContractTransaction>;
  updatePlatformFee(newFee: BigNumberish): Promise<ContractTransaction>;
  updatePlatformFeeRecipient(
    newRecipient: string,
  ): Promise<ContractTransaction>;

  // Events (for listening to contract events)
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}
