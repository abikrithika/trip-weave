// services/cache.service.js

const cache = new Map();

export const getCache = (key) => {
  const entry = cache.get(key);

  if (!entry) return null;

  const isExpired = Date.now() > entry.expiry;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.value;
};

export const setCache = (key, value, ttl = 60 * 1000) => {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl,
  });
};
