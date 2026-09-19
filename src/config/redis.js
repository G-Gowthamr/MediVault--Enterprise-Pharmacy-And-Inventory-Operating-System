const { createClient } = require('redis');

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_TTL = Number(process.env.REDIS_CACHE_TTL || 3600);

let client = null;
let isConnected = false;

if (REDIS_ENABLED) {
  try {
    client = createClient({ url: REDIS_URL });

    client.on('connect', () => {
      console.log('[redis] Connected to Redis server at', REDIS_URL);
      isConnected = true;
    });

    client.on('ready', () => {
      isConnected = true;
    });

    let lastErrorLogged = 0;
    client.on('error', (err) => {
      const now = Date.now();
      if (now - lastErrorLogged > 60000) {
        console.warn('[redis warning] Connection error (graceful fallback active):', err.message);
        lastErrorLogged = now;
      }
      isConnected = false;
    });

    client.on('end', () => {
      isConnected = false;
    });

    client.connect().catch(err => {
      console.warn('[redis warning] Initial connection failed (graceful fallback active):', err.message);
      isConnected = false;
    });
  } catch (err) {
    console.warn('[redis warning] Failed to initialize Redis client:', err.message);
    isConnected = false;
  }
}

/**
 * Get cached value (Read-Aside Pattern with Graceful Degradation)
 */
async function getCache(key) {
  if (!REDIS_ENABLED || !client || !isConnected) return null;
  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.warn(`[redis cache miss/error] Key ${key}:`, err.message);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
async function setCache(key, value, ttlSeconds = DEFAULT_TTL) {
  if (!REDIS_ENABLED || !client || !isConnected) return false;
  try {
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await client.set(key, str, { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.warn(`[redis cache set error] Key ${key}:`, err.message);
    return false;
  }
}

/**
 * Delete specific cached key
 */
async function delCache(key) {
  if (!REDIS_ENABLED || !client || !isConnected) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.warn(`[redis cache del error] Key ${key}:`, err.message);
    return false;
  }
}

/**
 * Delete cached keys matching pattern (e.g. 'medicines:*')
 */
async function delCacheByPattern(pattern) {
  if (!REDIS_ENABLED || !client || !isConnected) return false;
  try {
    const keys = await client.keys(pattern);
    if (keys && keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (err) {
    console.warn(`[redis cache pattern del error] Pattern ${pattern}:`, err.message);
    return false;
  }
}

/**
 * Check Redis health status
 */
async function checkRedisHealth() {
  if (!REDIS_ENABLED || !client || !isConnected) return false;
  try {
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (err) {
    return false;
  }
}

module.exports = {
  getCache,
  setCache,
  delCache,
  delCacheByPattern,
  checkRedisHealth
};
