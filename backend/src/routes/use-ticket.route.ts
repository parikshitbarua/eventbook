import { Router } from "express";
import verifyNftOwnerMiddleware from "../middleware/verify-nft-owner.middleware";
import { generateQRDataController, verifyQRDataController } from "../controllers/use-ticket.controller";

const router = Router();

// Example route that requires NFT ownership verification
router.post("/generate-qr-data", verifyNftOwnerMiddleware, generateQRDataController);
router.post("/verify-qr-data", verifyQRDataController);

export default router;
