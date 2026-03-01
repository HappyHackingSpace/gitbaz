export interface CacheEntry<T> {
	readonly value: T;
	readonly expiresAt: number;
}
