import { Request, Response } from "express";

import fs from "fs";
import path from "path";
import crypto from "crypto";

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
