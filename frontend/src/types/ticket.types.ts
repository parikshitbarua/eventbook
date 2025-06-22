export interface TicketCategory {
  name: string;
  price: bigint;
  maxSupply: bigint;
  sold: bigint;
  isActive: boolean;
  categoryURI: string;
  image?: string;
}
