import { parseEther } from 'ethers';
import { useWriteContract } from 'wagmi';
import { readContract } from '@wagmi/core';
import { config as wagmiConfig } from '../config/wallet.config';
import EventTicketNFTABI from '../contracts/EventTicketNFT.sol/EventTicketNFT.json';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import type { Address } from 'viem';

interface PurchaseTicketsParams {
  nftContractAddress: string;
  quantities: number[];
  categoryIds: number[];
  tokenURIs: string[];
  totalPrice: string; // in ETH
}

interface EventDetails {
  title: string;
  description: string;
  eventOrganizer: string;
  price: bigint;
  maxTicketsCount: bigint;
  ticketsSoldCount: bigint;
  active: boolean;
  uri: string;
  creationTime: bigint;
  startTime: bigint;
  endTime: bigint;
  eventVenue: string;
}

/**
 * Hook to purchase tickets using the EventTicketNFT contract
 * @returns A function to purchase tickets and check event details
 */
export const usePurchaseTickets = () => {
  const { writeContractAsync } = useWriteContract();

  const getEventDetails = async (
    eventContractAddress: string,
  ): Promise<EventDetails> => {
    try {
      const details = (await readContract(wagmiConfig, {
        address: eventContractAddress as Address,
        abi: EventContractABI.abi,
        functionName: 'getEventDetails',
      })) as [
        string, // title
        string, // description
        string, // eventOrganizer
        bigint, // price
        bigint, // maxTicketsCount
        bigint, // ticketsSoldCount
        boolean, // active
        string, // uri
        bigint, // creationTime
        bigint, // startTime
        bigint, // endTime
        string, // eventVenue
      ];

      if (!details) throw new Error('Failed to get event details');

      return {
        title: details[0],
        description: details[1],
        eventOrganizer: details[2],
        price: details[3],
        maxTicketsCount: details[4],
        ticketsSoldCount: details[5],
        active: details[6],
        uri: details[7],
        creationTime: details[8],
        startTime: details[9],
        endTime: details[10],
        eventVenue: details[11],
      };
    } catch (error) {
      console.error('Error getting event details:', error);
      throw error;
    }
  };

  const purchaseTickets = async ({
    nftContractAddress,
    quantities,
    categoryIds,
    tokenURIs,
    totalPrice,
  }: PurchaseTicketsParams): Promise<`0x${string}`> => {
    try {
      // Validate inputs
      if (!nftContractAddress)
        throw new Error('NFT contract address is required');
      if (!quantities.length)
        throw new Error('Quantities array cannot be empty');
      if (!categoryIds.length)
        throw new Error('Category IDs array cannot be empty');
      if (!tokenURIs.length)
        throw new Error('Token URIs array cannot be empty');
      if (
        quantities.length !== categoryIds.length ||
        quantities.length !== tokenURIs.length
      ) {
        throw new Error('Arrays must have the same length');
      }

      // Get event contract address from NFT contract
      const eventContractAddress = (await readContract(wagmiConfig, {
        address: nftContractAddress as Address,
        abi: EventTicketNFTABI.abi,
        functionName: 'eventContract',
      })) as Address;

      if (!eventContractAddress)
        throw new Error('Failed to get event contract address');

      // Get event details
      const eventDetails = await getEventDetails(eventContractAddress);

      // Validate event state
      if (!eventDetails.active) {
        throw new Error('Event is not active');
      }

      // Validate ticket availability for category 0
      if (categoryIds.includes(0)) {
        const index = categoryIds.indexOf(0);
        const quantity = quantities[index];
        if (eventDetails.maxTicketsCount > 0n) {
          const available =
            eventDetails.maxTicketsCount - eventDetails.ticketsSoldCount;
          if (available <= 0n) {
            throw new Error('Event is sold out');
          }
          if (BigInt(quantity) > available) {
            throw new Error(`Only ${available} tickets available`);
          }
        }
      }

      // Convert quantities to BigInt array
      const quantitiesBigInt = quantities.map((q) => BigInt(q));
      // Convert categoryIds to BigInt array
      const categoryIdsBigInt = categoryIds.map((id) => BigInt(id));
      // Convert total price to Wei
      const valueInWei = parseEther(totalPrice);

      // Call the smart contract
      const hash = await writeContractAsync({
        address: nftContractAddress as Address,
        abi: EventTicketNFTABI.abi,
        functionName: 'purchaseTickets',
        args: [quantitiesBigInt, categoryIdsBigInt, tokenURIs],
        value: valueInWei,
      });

      return hash;
    } catch (error) {
      console.error('Error in purchaseTickets:', error);
      throw error;
    }
  };

  return { purchaseTickets, getEventDetails };
};
