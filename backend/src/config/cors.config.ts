import cors from "cors";
import { allowedOrigins, type Environment } from "./app.config";
import config from "./config";

const getCorsOptions = (): cors.CorsOptions => {
  const currentEnvironment = config.environment as Environment;
  const origins = allowedOrigins[currentEnvironment] as readonly string[];


  console.log("allowedOrigins", origins);

  return {
    origin: (origin, callback) => {
      console.log(`CORS: Request from origin: ${origin || 'no origin'}`);
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if the origin is in the allowed list
      if (origins.includes(origin)) {
        console.log(`CORS: Allowed origin: ${origin}`);
        return callback(null, true);
      }

      // In development, be more permissive
      if (currentEnvironment === 'DEV') {
        console.warn(`CORS: Allowing non-configured origin in DEV: ${origin}`);
        return callback(null, true);
      }

      // Log the rejected origin for debugging
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true, // Allow cookies and authentication headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "Pragma"
    ],
    exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 200
  };
};

export default getCorsOptions;
