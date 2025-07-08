import express from "express";
import cors from "cors";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";
import useTicketRoutes from "./routes/use-ticket.route";
import trackEventsRoutes from "./routes/track-events.route";
import getCorsOptions from "./config/cors.config";

const app = express();

// CORS middleware - must be before other middleware
app.use(cors(getCorsOptions()));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (_, res) => {
  res.status(200).json({
    message: "EventBook Backend API",
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || "DEV"
  });
});

// Health check endpoint
app.get("/api/health", (_, res) => {
  res.status(200).json({
    status: "OK",
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
});

// Use ticket routes
app.use("/api/use-ticket", useTicketRoutes);

// Track events routes
app.use("/api/track-events", trackEventsRoutes);

// Global error handler (should be after all routes)
app.use(errorHandlerMiddleware);

export default app;
