export const appURL = {
  DEV: "http://localhost",
  QA: "",
  UAT: "",
  PROD: ""
} as const;

export type Environment = keyof typeof appURL;
