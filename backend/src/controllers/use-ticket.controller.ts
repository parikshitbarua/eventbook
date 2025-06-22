import { Request, Response } from "express";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { JsonRpcProvider, Contract } from "ethers";
import blockchainConfig from "../config/blockchain.config";
import EventTicketNFTABI from "../contracts/EventTicketNFT.json";

interface VerifyNFTRequestBody {
  verifiedData?: {
    eventDetails: any;
    nftContractAddress: string;
    tokenOwner: string;
    isVerified: boolean;
  };
}

interface QRData {
  tokenId: number;
  eventId: number;
  owner: string;
  expiresAt: number;
  serverSignature: string;
  nftContractAddress?: string;
}

interface TicketData {
    tokenId: bigint;
    originalBuyer: `0x${string}`;
    mintedAt: bigint;
    categoryId: bigint;
    isUsed: boolean;
}

export const generateQRDataController = (req: Request, res: Response) => {
  try {
    // Extract verified data from middleware
    const { verifiedData } = req.body as VerifyNFTRequestBody;

    if (!verifiedData || !verifiedData.isVerified) {
      res.status(400).json({
        data: null,
        message: "NFT ownership verification required"
      });
      return;
    }

    // Extract tokenId and eventId from request body or params
    const { tokenId, eventId } = req.body;

    if (!tokenId || !eventId) {
      res.status(400).json({
        data: null,
        message: "tokenId and eventId are required"
      });
      return;
    }

    // Create expiration time (10 minutes from now)
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes in seconds

    // Create the data to be signed
    const qrData = {
      tokenId: parseInt(tokenId),
      eventId: parseInt(eventId),
      owner: verifiedData.tokenOwner,
      expiresAt
    };

    // Read the private key
    const privateKeyPath = path.join(process.cwd(), "src/keys/private.pem");
    const privateKeyPem = fs.readFileSync(privateKeyPath, "utf8");

    // Create the message to sign (JSON string of the data)
    const messageToSign = JSON.stringify(qrData);

    // Sign using Node.js crypto (since we're using PEM format keys)
    const sign = crypto.createSign("SHA256");
    sign.update(messageToSign);
    sign.end();
    const serverSignature = sign.sign(privateKeyPem, "hex");

    // Create the final response
    const response: QRData = {
      ...qrData,
      serverSignature: `0x${serverSignature}`
    };

    res.status(200).json({
      data: response,
      message: "QR data generated successfully"
    });
  } catch (error) {
    console.error("Error generating QR data:", error);
    res.status(500).json({
      data: null,
      message: "Internal server error while generating QR data"
    });
  }
};

export const verifyQRDataController = async (req: Request, res: Response) => {
    try {
        // Destructure QR code data from request body
        const { tokenId, eventId, owner, expiresAt, serverSignature, nftContractAddress } = req.body as QRData;

        // Validate required fields
        if (tokenId == null || eventId == null || !owner || !expiresAt || !serverSignature || !nftContractAddress) {
            res.status(400).json({
                data: null,
                message: "Missing required QR code data fields"
            });
            return;
        }

        // Check if the QR code has expired (cheap check)
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime > expiresAt) {
            res.status(400).json({
                data: null,
                message: "QR code has expired"
            });
            return;
        }

        // FIRST: Verify server signature (inexpensive local operation)
        try {
            // Create the original data object (without signature) for verification
            const originalData = {
                tokenId,
                eventId,
                owner,
                expiresAt
            };

            // Create the message that was originally signed
            const messageToVerify = JSON.stringify(originalData);

            // Read the public key
            const publicKeyPath = path.join(process.cwd(), "src/keys/public.pem");
            const publicKeyPem = fs.readFileSync(publicKeyPath, "utf8");

            // Remove '0x' prefix from signature if present
            const signatureHex = serverSignature.startsWith('0x') 
                ? serverSignature.slice(2) 
                : serverSignature;

            // Verify the signature using Node.js crypto
            const verify = crypto.createVerify("SHA256");
            verify.update(messageToVerify);
            verify.end();

            const isSignatureValid = verify.verify(publicKeyPem, signatureHex, "hex");

            if (!isSignatureValid) {
                res.status(401).json({
                    data: null,
                    message: "Invalid server signature - QR code verification failed"
                });
                return;
            }
        } catch (signatureError) {
            console.error('Error verifying signature:', signatureError);
            res.status(500).json({
                data: null,
                message: "Failed to verify QR code signature"
            });
            return;
        }

        // SECOND: Only if signature is valid, check blockchain ticket status (expensive operation)
        try {
            const provider = new JsonRpcProvider(blockchainConfig.networkUrl);
            const nftContract = new Contract(nftContractAddress, EventTicketNFTABI.abi, provider);
            
            const ticket: TicketData = await nftContract.getTicket(tokenId);
            
            if (ticket.isUsed) {
                res.status(400).json({
                    data: null,
                    message: "This ticket has already been used"
                });
                return;
            }
        } catch (contractError) {
            console.error('Error checking ticket status:', contractError);
            res.status(500).json({
                data: null,
                message: "Failed to verify ticket status on blockchain"
            });
            return;
        }

        // If both signature and blockchain verification pass, return success
        res.status(200).json({
            data: {
                tokenId,
                eventId,
                owner,
                expiresAt,
                serverSignature,
                verified: true
            },
            message: "QR code verified successfully"
        });

    } catch (error) {
        console.error("Error verifying QR data:", error);
        res.status(500).json({
            data: null,
            message: "Internal server error while verifying QR data"
        });
    }
}
