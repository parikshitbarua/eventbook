const API_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  BASE: API_BASE_URL,
  HEALTH: `${API_BASE_URL}/api/health`,
  GENERATE_QR: `${API_BASE_URL}/api/use-ticket/generate-qr-data`,
  VERIFY_QR: `${API_BASE_URL}/api/use-ticket/verify-qr-data`,
} as const;

export default API_ENDPOINTS; 