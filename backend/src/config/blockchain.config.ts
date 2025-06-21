import dotenv from "dotenv";

dotenv.config();

interface BlockchainConfig {
  networkUrl: string;
  factoryAddress: string;
  chainId: number;
}

const blockchainConfig: BlockchainConfig = {
  networkUrl: process.env.NETWORK_URL || "http://127.0.0.1:8545",
  factoryAddress: process.env.FACTORY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  chainId: Number(process.env.CHAIN_ID) || 31337
};

export default blockchainConfig;
