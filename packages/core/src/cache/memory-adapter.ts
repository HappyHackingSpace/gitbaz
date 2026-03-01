import type { CacheAdapter } from "../types.js";
import type { CacheEntry } from "./types.js";
import { isExpired } from "./utils.js";

export class MemoryCacheAdapter implements CacheAdapter {
	private store = new Map<string, CacheEntry<unknown>>();

	async get<T>(key: string): Promise<T | undefined> {
		const entry = this.store.get(key);
		if (!entry) return undefined;

		if (isExpired(entry.expiresAt)) {
			this.store.delete(key);
			return undefined;
		}

		return entry.value as T;
	}

	async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
		this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
	}

	async delete(key: string): Promise<boolean> {
		return this.store.delete(key);
	}

	async clear(): Promise<void> {
		this.store.clear();
	}

	async size(): Promise<number> {
		// Evict expired entries before reporting size
		for (const [key, entry] of this.store) {
			if (isExpired(entry.expiresAt)) {
				this.store.delete(key);
			}
		}
		return this.store.size;
	}
}
