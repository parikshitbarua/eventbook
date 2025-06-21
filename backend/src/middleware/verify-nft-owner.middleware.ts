import { Request, Response } from "express";
import { ethers } from "ethers";
import blockchainConfig from "../config/blockchain.config";
import EventFactoryABI from "../contracts/EventFactory.json";
import EventTicketNFTABI from "../contracts/EventTicketNFT.json";

interface VerifyNFTRequestBody {
  tokenId: string;
  eventId: string;
  walletAddress: string;
  userSignature: string;
  message?: string; // The message that was signed
  verifiedData?: {
    eventDetails: any;
    nftContractAddress: string;
    tokenOwner: string;
    isVerified: boolean;
  };
}

const verifyNftOwnerMiddleware = async (req: Request, res: Response, next: () => void) => {
  const { tokenId, eventId, walletAddress, userSignature, message } =
    req.body as VerifyNFTRequestBody;
  console.log(tokenId, eventId, walletAddress, userSignature);
  // Validate required fields
  if (!tokenId || !eventId || !walletAddress || !userSignature) {
    res.status(400).json({
      data: null,
      message: "Missing required fields: tokenId, eventId, walletAddress, userSignature"
    });
    return;
  }

  try {
    // Step 1: Verify the signature
    const messageToVerify =
      message || `Verify NFT ownership for token ${tokenId} in event ${eventId}`;

    console.log("Message to verify:", messageToVerify);
    console.log("User signature:", userSignature);

    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(messageToVerify, userSignature);
    } catch (_error) {
      res.status(401).json({
        data: null,
        message: "Invalid signature format"
      });
      return;
    }

    // Check if the recovered address matches the provided wallet address
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      res.status(401).json({
        data: null,
        message: "Signature verification failed: signature does not match wallet address"
      });
      return;
    }

    // Step 2: Get event details from EventFactory
    const provider = new ethers.JsonRpcProvider(blockchainConfig.networkUrl);
    const factoryContract = new ethers.Contract(
      blockchainConfig.factoryAddress,
      EventFactoryABI.abi,
      provider
    );

    let eventDetails;
    try {
      eventDetails = await factoryContract.getEventDetails(BigInt(eventId));
    } catch (_error) {
      res.status(404).json({
        data: null,
        message: `Event with ID ${eventId} not found`
      });
      return;
    }

    // Extract NFT contract address from event details
    const nftContractAddress = eventDetails.eventInfo.nftContract;

    if (!nftContractAddress || nftContractAddress === ethers.ZeroAddress) {
      res.status(400).json({
        data: null,
        message: "Event does not have an associated NFT contract"
      });
      return;
    }

    // Step 3: Verify NFT ownership
    const nftContract = new ethers.Contract(nftContractAddress, EventTicketNFTABI.abi, provider);

    let tokenOwner: string;
    try {
      tokenOwner = await nftContract.ownerOf(BigInt(tokenId));
    } catch (_error) {
      res.status(404).json({
        data: null,
        message: `Token ${tokenId} does not exist or contract error`
      });
      return;
    }

    // Verify that the wallet address is the owner of the token
    if (tokenOwner.toLowerCase() !== walletAddress.toLowerCase()) {
      res.status(403).json({
        data: null,
        message: `Wallet ${walletAddress} is not the owner of token ${tokenId}`
      });
      return;
    }

    // If all validations pass, attach the verified data to the request
    (req.body as VerifyNFTRequestBody).verifiedData = {
      eventDetails,
      nftContractAddress,
      tokenOwner,
      isVerified: true
    };

    next();
  } catch (error) {
    console.error("Error in verifyNftOwner middleware:", error);
    res.status(500).json({
      data: null,
      message: "Internal server error during verification"
    });
    return;
  }
};

export default verifyNftOwnerMiddleware;
