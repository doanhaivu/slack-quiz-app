import NodeCache from 'node-cache';

// Initialize cache with standard TTL of 30 minutes
export const apiResponseCache = new NodeCache({ stdTTL: 1800 });

// Default setting for caching (can be toggled for testing)
export const isCachingEnabled = false;

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  apiResponseCache.flushAll();
}

/**
 * Get a cached value
 * 
 * @param key The cache key
 * @returns The cached value or undefined if not found
 */
export function getCachedResponse<T>(key: string): T | undefined {
  if (!isCachingEnabled) return undefined;
  return apiResponseCache.get<T>(key);
}

/**
 * Set a value in the cache
 * 
 * @param key The cache key
 * @param value The value to cache
 * @param ttl Optional TTL in seconds
 */
export function setCachedResponse<T>(key: string, value: T, ttl?: number): void {
  if (!isCachingEnabled) return;
  
  // Only include ttl if it's defined
  if (ttl !== undefined) {
    apiResponseCache.set(key, value, ttl);
  } else {
    apiResponseCache.set(key, value);
  }
} 