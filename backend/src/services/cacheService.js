const { createClient } = require('redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URI || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: false
        }
      });

      this.client.on('error', (err) => {
        logger.warn(`Redis Client Error: ${err.message}. Caching will be disabled.`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully for cache service.');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.warn(`Failed to connect to Redis: ${error.message}. Caching will be disabled.`);
      this.isConnected = false;
    }
  }

  /**
   * Get or set a cached value
   * @param {string} key Cache key
   * @param {Function} fetchFn Function to execute if cache miss
   * @param {number} ttlSeconds Time to live in seconds (default 300 = 5 mins)
   */
  async getOrSet(key, fetchFn, ttlSeconds = 300) {
    if (!this.isConnected || !this.client) {
      return await fetchFn();
    }

    try {
      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      const data = await fetchFn();
      
      // Don't cache null/undefined
      if (data) {
        await this.client.set(key, JSON.stringify(data), {
          EX: ttlSeconds
        });
      }
      
      return data;
    } catch (error) {
      logger.warn(`Redis cache error on key ${key}: ${error.message}`);
      // Fallback to fetching directly
      return await fetchFn();
    }
  }

  async clear(keyPattern) {
    if (!this.isConnected || !this.client) return;
    
    try {
      const keys = await this.client.keys(keyPattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.warn(`Redis clear error on pattern ${keyPattern}: ${error.message}`);
    }
  }
}

module.exports = new CacheService();
