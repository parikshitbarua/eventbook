import { ethers } from 'ethers';
import { EventTicketNFT__factory } from '../typechain-types';
import { type Address } from 'viem';
import { type ContractInterface } from 'ethers';
// import { type EventData } from '../types/event';

// Add type declaration for window.ethereum
// Use the type expected by the linter

declare global {
  interface Window {
    ethereum?: Record<string, unknown>;
  }
}

interface PurchaseSingleTicketParams {
  nftContractAddress: string;
  quantity: number;
  tokenURI: string;
  totalPrice: string;
}

interface PurchaseCategoryTicketsParams {
  nftContractAddress: string;
  quantities: number[];
  categoryIds: number[];
  tokenURIs: string[];
  totalPrice: string;
}

export interface ContractError {
  code: number;
  message: string;
  data?: unknown;
}

export interface ContractResult {
  success: boolean;
  error?: ContractError;
  data?: unknown;
}

export interface ContractCallOptions {
  address: Address;
  abi: ContractInterface;
  functionName: string;
  args?: unknown[];
  value?: bigint;
}

export interface ContractReadOptions {
  address: Address;
  abi: ContractInterface;
  functionName: string;
  args?: unknown[];
}

export const purchaseSingleTicket = async ({
  nftContractAddress,
  quantity,
  tokenURI,
  totalPrice,
}: PurchaseSingleTicketParams): Promise<string> => {
  if (!window.ethereum) throw new Error('No ethereum provider found');
  const provider = new ethers.BrowserProvider(
    window.ethereum as unknown as ethers.Eip1193Provider,
  );
  const signer = await provider.getSigner();

  const nftContract = EventTicketNFT__factory.connect(
    nftContractAddress,
    signer,
  );

  try {
    console.log('Attempting purchase with params:', {
      nftContractAddress,
      quantity,
      tokenURI,
      totalPrice,
      signerAddress: await signer.getAddress(),
    });

    // First try to estimate gas to catch potential reverts
    try {
      const gasEstimate = await nftContract.purchaseSingleTicket.estimateGas(
        tokenURI,
        quantity,
        { value: totalPrice },
      );
      console.log('Gas estimate successful:', gasEstimate.toString());
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('Gas estimation failed:', error);
        if ('data' in error) {
          console.error('Error data:', error.data);
        }
        throw new Error(`Transaction would revert: ${error.message}`);
      } else {
        throw error;
      }
    }

    const tx = await nftContract.purchaseSingleTicket(tokenURI, quantity, {
      value: totalPrice,
    });

    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction failed');
    return receipt.hash;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('Purchase failed:', error);
      if ('data' in error) {
        console.error('Error data:', error.data);
      }
    }
    throw error;
  }
};

export const purchaseCategoryTickets = async ({
  nftContractAddress,
  quantities,
  categoryIds,
  tokenURIs,
  totalPrice,
}: PurchaseCategoryTicketsParams): Promise<string> => {
  if (!window.ethereum) throw new Error('No ethereum provider found');
  const provider = new ethers.BrowserProvider(
    window.ethereum as unknown as ethers.Eip1193Provider,
  );
  const signer = await provider.getSigner();

  const nftContract = EventTicketNFT__factory.connect(
    nftContractAddress,
    signer,
  );

  const tx = await nftContract.purchaseCategoryTickets(
    quantities,
    categoryIds,
    tokenURIs,
    { value: totalPrice },
  );

  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction failed');
  return receipt.hash;
};
