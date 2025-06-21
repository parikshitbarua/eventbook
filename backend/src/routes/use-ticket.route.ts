import { Router } from "express";
import verifyNftOwnerMiddleware from "../middleware/verify-nft-owner.middleware";
import { generateQRDataController } from "../controllers/use-ticket.controller";

const router = Router();

// Example route that requires NFT ownership verification
router.post("/generate-qr-data", verifyNftOwnerMiddleware, generateQRDataController);

export default router;
