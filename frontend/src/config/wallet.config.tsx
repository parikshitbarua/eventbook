import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { defineChain } from '@reown/appkit/networks';

// Get projectId from https://cloud.reown.com
export const projectId = import.meta.env.VITE_PROJECT_ID;

if (!projectId) {
  throw new Error('Project ID is not defined');
}

export const metadata = {
  name: 'eventbook',
  description: 'AppKit Example',
  url: 'https://localhost', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

export const hardhatNetwork = defineChain({
  id: 31337,
  name: 'Hardhat',
  caipNetworkId: 'eip155:31337',
  chainNamespace: 'eip155',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
      webSocket: ['ws://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Hardhat Explorer',
      url: 'http://localhost:8545',
    },
  },
});

export const networks = [hardhatNetwork] as [AppKitNetwork, ...AppKitNetwork[]];

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

// Create modal
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
  },
  themeVariables: {
    '--w3m-accent': '#e43635',
  },
});

export const config = wagmiAdapter.wagmiConfig;
