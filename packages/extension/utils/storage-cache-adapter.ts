import type { CacheAdapter } from "@happyhackingspace/gitbaz";

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const CACHE_PREFIX = "gitbaz_cache:";

export class StorageCacheAdapter implements CacheAdapter {
	async get<T>(key: string): Promise<T | undefined> {
		const storageKey = CACHE_PREFIX + key;
		const result = await chrome.storage.local.get(storageKey);
		const entry = result[storageKey] as CacheEntry<T> | undefined;

		if (!entry) return undefined;

		if (Date.now() >= entry.expiresAt) {
			await chrome.storage.local.remove(storageKey);
			return undefined;
		}

		return entry.value;
	}

	async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
		const storageKey = CACHE_PREFIX + key;
		const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
		await chrome.storage.local.set({ [storageKey]: entry });
	}

	async delete(key: string): Promise<boolean> {
		const storageKey = CACHE_PREFIX + key;
		const result = await chrome.storage.local.get(storageKey);
		if (!(storageKey in result)) return false;
		await chrome.storage.local.remove(storageKey);
		return true;
	}

	async clear(): Promise<void> {
		const all = await chrome.storage.local.get(null);
		const cacheKeys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
		if (cacheKeys.length > 0) {
			await chrome.storage.local.remove(cacheKeys);
		}
	}

	async size(): Promise<number> {
		const all = await chrome.storage.local.get(null);
		return Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX)).length;
	}
}
