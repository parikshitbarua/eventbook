import { type Address } from 'viem';

export interface TicketCategory {
  name: string;
  price: bigint;
  maxSupply: bigint;
  sold: bigint;
  isActive: boolean;
  categoryURI: string;
}

export interface EventData {
  eventId: number;
  title: string;
  description: string;
  organizer: Address;
  ticketPrice: bigint;
  maxTickets: bigint;
  ticketsSold: bigint;
  ticketsLeft: bigint;
  isActive: boolean;
  eventURI: string;
  createdAt: bigint;
  eventStartTime: bigint;
  eventEndTime: bigint;
  venue: string;
  eventContract: Address;
  nftContract: Address;
  totalRevenue: bigint;
  eventImages: string;
  categories?: TicketCategory[];
}
