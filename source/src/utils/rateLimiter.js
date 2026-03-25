'use strict';

const config = require('../config');

/**
 * In-memory per-user rate limiter.
 * Tracks message timestamps per userId within a sliding 60-second window.
 */
class RateLimiter {
  constructor() {
    /** @type {Map<number, number[]>} userId → array of message timestamps (ms) */
    this._map = new Map();
    this._limit = config.app.rateLimitPerUserPerMin;
    this._windowMs = 60 * 1000;

    // Cleanup stale entries every 5 minutes to prevent memory leaks
    setInterval(() => this._cleanup(), 5 * 60 * 1000).unref();
  }

  /**
   * Returns true if the user is within the allowed rate limit.
   * @param {number} userId
   * @returns {boolean}
   */
  isAllowed(userId) {
    const now = Date.now();
    const windowStart = now - this._windowMs;
    const timestamps = this._map.get(userId) || [];

    // Keep only timestamps within the current window
    const recent = timestamps.filter(ts => ts > windowStart);
    recent.push(now);
    this._map.set(userId, recent);

    return recent.length <= this._limit;
  }

  /**
   * Returns how many seconds until the user's oldest message falls outside the window.
   * @param {number} userId
   * @returns {number} seconds to wait
   */
  getRetryAfterSeconds(userId) {
    const timestamps = this._map.get(userId) || [];
    if (timestamps.length === 0) { return 0; }

    const oldest = Math.min(...timestamps);
    const retryAt = oldest + this._windowMs;
    return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  }

  _cleanup() {
    const windowStart = Date.now() - this._windowMs;
    for (const [userId, timestamps] of this._map.entries()) {
      const recent = timestamps.filter(ts => ts > windowStart);
      if (recent.length === 0) {
        this._map.delete(userId);
      } else {
        this._map.set(userId, recent);
      }
    }
  }
}

module.exports = new RateLimiter();
