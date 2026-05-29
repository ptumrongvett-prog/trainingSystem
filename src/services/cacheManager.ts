/**
 * cacheManager.ts — Data caching in sessionStorage with TTL.
 * Prevents redundant API calls on every render/navigation.
 */

const CACHE_PREFIX = 'tcs_cache_';
const DEFAULT_TTL  = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/** Save data to session cache */
export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — silently fail
    console.warn(`Cache write failed for key: ${key}`);
  }
}

/** Get cached data if still valid */
export function getCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > entry.ttl) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/** Check if cache entry exists and is valid */
export function isCacheValid(key: string): boolean {
  return getCache(key) !== null;
}

/** Get cache timestamp */
export function getCacheTimestamp(key: string): Date | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return new Date(entry.timestamp);
  } catch {
    return null;
  }
}

/** Clear specific cache entry */
export function clearCache(key: string): void {
  sessionStorage.removeItem(CACHE_PREFIX + key);
}

/** Clear all training system cache */
export function clearAllCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
}
