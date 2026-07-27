// Centralized API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const API_CONFIG = {
  BASE_URL: API_URL,
  AUTH: `${API_URL}/api/auth`,
  QUESTIONS: `${API_URL}/api/questions`,
  SUBJECTS: `${API_URL}/api/subjects`,
  TOPICS: `${API_URL}/api/topics`,
  BOOKMARKS: `${API_URL}/api/bookmarks`,
  UPLOADS: `${API_URL}/uploads`,
  ANALYTICS: `${API_URL}/api/analytics`,
  ACTUATOR: `${API_URL}/actuator`
};

export default API_CONFIG;
