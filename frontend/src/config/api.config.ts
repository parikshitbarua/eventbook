const API_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  BASE: API_SERVER_URL,
  HEALTH: `${API_SERVER_URL}/api/health`,
  GENERATE_QR: `${API_SERVER_URL}/api/use-ticket/generate-qr-data`,
  VERIFY_QR: `${API_SERVER_URL}/api/use-ticket/verify-qr-data`,
  ADD_USER: `${API_SERVER_URL}/api/track-events/upsert-user`,
  ADD_EVENT: `${API_SERVER_URL}/api/track-events/new-event`
} as const;

export default API_ENDPOINTS; 