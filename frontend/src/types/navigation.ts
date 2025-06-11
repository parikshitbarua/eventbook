export interface AddTicketsNavigationState {
  transactionHash: string;
  eventTitle: string;
  eventDescription: string;
  receipt?: `0x${string}`;
  eventId?: string;
  organizer?: string;
  eventContract?: string;
  nftContract?: string;
  eventCreatedLog?: `0x${string}`;
  error?: string;
}
