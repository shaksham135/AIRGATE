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
    if (!user) return false;
    const r = (user.role || (Array.isArray(user.roles) ? user.roles[0] : user.roles) || '').toUpperCase();
    return r === 'ADMIN' || r === 'ROLE_ADMIN' || r === 'EDITOR' || r === 'ROLE_EDITOR';
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

  notifyAuthChange() {
    try {
      window.dispatchEvent(new Event('authChange'));
    } catch (e) {}
  }

  // Call after a successful upgrade to refresh localStorage without re-login
  updatePremiumStatus(isPremium, premiumExpiresAt) {
    const user = this.getCurrentUser();
    if (user) {
      const updated = { ...user, isPremium, premiumExpiresAt: premiumExpiresAt || null };
      localStorage.setItem('user', JSON.stringify(updated));
      this.notifyAuthChange();
    }
  }

  hasUsedPdfTrial() {
    const user = this.getCurrentUser();
    return user && user.hasUsedPdfTrial === true;
  }

  updatePdfTrialStatus(hasUsedPdfTrial) {
    const user = this.getCurrentUser();
    if (user) {
      const updated = { ...user, hasUsedPdfTrial };
      localStorage.setItem('user', JSON.stringify(updated));
      this.notifyAuthChange();
    }
  }

  async checkAndRefreshUserStatus(force = false) {
    const user = this.getCurrentUser();
    if (!user || !user.token) return null;

    const now = Date.now();
    // Return cached user if checked within the last 10 seconds (unless forced)
    if (!force && this.lastCheckedTime && (now - this.lastCheckedTime < 10000)) {
      return user;
    }

    // Deduplicate in-flight requests across concurrent component mounts
    if (this.inFlightMePromise) {
      return this.inFlightMePromise;
    }

    this.inFlightMePromise = (async () => {
      try {
        const response = await axios.get(API_CONFIG.BASE_URL + '/api/users/me', {
          headers: this.getAuthHeader()
        });

        this.lastCheckedTime = Date.now();
        const dbUser = response.data;
        
        const updatedUser = {
          ...user,
          role: dbUser.role,
          isPremium: dbUser.isPremium,
          hasUsedPdfTrial: dbUser.hasUsedPdfTrial,
          premiumExpiresAt: dbUser.premiumExpiresAt,
          isBanned: dbUser.isBanned
        };
        
        if (
          user.role !== updatedUser.role ||
          user.isPremium !== updatedUser.isPremium ||
          user.hasUsedPdfTrial !== updatedUser.hasUsedPdfTrial ||
          user.premiumExpiresAt !== updatedUser.premiumExpiresAt ||
          user.isBanned !== updatedUser.isBanned
        ) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
          this.notifyAuthChange();
          return updatedUser;
        }
        return user;
      } catch (e) {
        console.error('Failed to sync user status from server:', e);
        if (e.response && (e.response.status === 401 || e.response.status === 403)) {
          this.logout();
          this.notifyAuthChange();
          window.location.reload();
        }
        throw e;
      } finally {
        this.inFlightMePromise = null;
      }
    })();

    return this.inFlightMePromise;
  }
}

export default new AuthService();
