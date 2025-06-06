export interface EventData {
  id: number;
  title?: string;
  description?: string;
  organizer?: `0x${string}`;
  ticketPrice?: bigint;
  maxTickets?: number;
  ticketsSold?: number;
  isActive?: boolean;
  eventURI?: string;
  createdAt?: bigint;
}
