import axios from 'axios';
import API_CONFIG from '../config/api';

const API_URL = API_CONFIG.AUTH + '/';

class AuthService {
  async login(username, password) {
    const response = await axios.post(API_URL + 'login', { username, password });
    if (response.data.token) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
  }

  logout() {
    localStorage.removeItem('user');
  }

  async register(username, email, password, role) {
    return axios.post(API_URL + 'register', {
      username,
      email,
      password,
      role
    });
  }

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  }

  getAuthHeader() {
    const user = this.getCurrentUser();
    if (user && user.token) {
      return { Authorization: 'Bearer ' + user.token };
    } else {
      return {};
    }
  }

  isAdminOrEditor() {
    const user = this.getCurrentUser();
    return user && (user.role === 'ADMIN' || user.role === 'EDITOR');
  }

  isPremium() {
    const user = this.getCurrentUser();
    if (!user || user.isPremium !== true) return false;
    // Client-side expiry check — if premiumExpiresAt is stored and has passed, treat as expired
    if (user.premiumExpiresAt) {
      const expiry = new Date(user.premiumExpiresAt);
      if (expiry < new Date()) {
        // Locally mark as expired so UI reflects it immediately
        const updated = { ...user, isPremium: false, premiumExpiresAt: null };
        localStorage.setItem('user', JSON.stringify(updated));
        return false;
      }
    }
    return true;
  }

  // Call after a successful upgrade to refresh localStorage without re-login
  updatePremiumStatus(isPremium, premiumExpiresAt) {
    const user = this.getCurrentUser();
    if (user) {
      const updated = { ...user, isPremium, premiumExpiresAt: premiumExpiresAt || null };
      localStorage.setItem('user', JSON.stringify(updated));
    }
  }

  async checkAndRefreshUserStatus(force = false) {
    const user = this.getCurrentUser();
    if (!user || !user.token) return null;

    const now = Date.now();
    // Refresh instantly if forced or 5 seconds passed
    if (!force && (now - this.lastCheckedTime < 5000)) {
      return user;
    }
    this.lastCheckedTime = now;

    try {
      const response = await axios.get(API_CONFIG.BASE_URL + '/api/users/me', {
        headers: this.getAuthHeader()
      });

      const dbUser = response.data;
      
      const updatedUser = {
        ...user,
        role: dbUser.role,
        isPremium: dbUser.isPremium,
        premiumExpiresAt: dbUser.premiumExpiresAt,
        isBanned: dbUser.isBanned
      };
      
      // Update if any properties changed
      if (
        user.role !== updatedUser.role ||
        user.isPremium !== updatedUser.isPremium ||
        user.premiumExpiresAt !== updatedUser.premiumExpiresAt ||
        user.isBanned !== updatedUser.isBanned
      ) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      }
      return user;
    } catch (e) {
      console.error('Failed to sync user status from server:', e);
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
        this.logout();
        window.location.reload();
      }
      throw e;
    }
  }
}

export default new AuthService();
