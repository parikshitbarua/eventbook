export interface EventData {
  eventId: number;
  title?: string;
  description?: string;
  organizer?: `0x${string}`;
  ticketPrice?: bigint;
  maxTickets?: bigint;
  ticketsSold?: bigint;
  ticketsLeft?: bigint;
  isActive?: boolean;
  eventURI?: string;
  createdAt?: bigint;
  eventStartTime: bigint;
  eventEndTime: bigint;
  venue: string;
  eventContract: `0x${string}`;
  nftContract: `0x${string}`;
  totalRevenue: bigint;
}
