import dotenv from "dotenv";
import type { Environment } from "./app.config";

dotenv.config();

interface Config {
  port: number;
  environment: "DEV" | "QA" | "UAT" | "PROD";
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  environment: (process.env.ENVIRONMENT as Environment) || "DEV"
};

export default config;
