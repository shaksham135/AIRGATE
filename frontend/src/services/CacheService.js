class CacheService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get value from cache if it exists and hasn't expired.
   * @param {string} key 
   * @returns {*} cached value or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Store a value in the cache with a Time-To-Live.
   * @param {string} key 
   * @param {*} value 
   * @param {number} ttlMs Time to live in milliseconds (default 1 minute)
   */
  set(key, value, ttlMs = 60000) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  /**
   * Manually invalidate a key in the cache.
   * @param {string} key 
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    this.cache.clear();
  }
}

export default new CacheService();
