export const FACTORY_ADDRESS =
  import.meta.env.VITE_FACTORY_ADDRESS ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';
export const NETWORK_URL =
    import.meta.env.MODE === 'development'
        ? 'https://mainnet.base.org'
        : import.meta.env.VITE_NETWORK_URL;

export const APP_DOMAIN =
  import.meta.env.VITE_APP_DOMAIN || 'http://localhost:5173';

export const SECONDARY_MARKET_LINK = 'https://opensea.io/';
