import express from "express";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";

const app = express();

app.use(express.json());

// Routes
app.get("/", (_, res) => {
  res.status(200).send({
    message: "Boilerplate code for ExpressJS + TS"
  });
});

// Global error handler (should be after all routes)
app.use(errorHandlerMiddleware);

export default app;
