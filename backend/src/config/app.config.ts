export const appURL = {
  DEV: "http://localhost",
  QA: "",
  UAT: "",
  PROD: ""
} as const;

export const allowedOrigins = {
  DEV: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000"
  ],
  QA: [
    // Add QA origins here
  ],
  UAT: [
    // Add UAT origins here
  ],
  PROD: [
    // Add production origins here
  ]
} as const;

export type Environment = keyof typeof appURL;
