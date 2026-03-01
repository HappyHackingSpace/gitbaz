import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCacheAdapter } from "../../src/cache/memory-adapter.js";

describe("MemoryCacheAdapter", () => {
	let cache: MemoryCacheAdapter;

	beforeEach(() => {
		cache = new MemoryCacheAdapter();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns undefined for missing keys", async () => {
		expect(await cache.get("nonexistent")).toBeUndefined();
	});

	it("stores and retrieves values", async () => {
		await cache.set("key1", { score: 42 }, 60000);
		expect(await cache.get("key1")).toEqual({ score: 42 });
	});

	it("returns undefined for expired entries", async () => {
		await cache.set("key1", "value", 1000);
		vi.advanceTimersByTime(1001);
		expect(await cache.get("key1")).toBeUndefined();
	});

	it("returns value before TTL expires", async () => {
		await cache.set("key1", "value", 1000);
		vi.advanceTimersByTime(999);
		expect(await cache.get("key1")).toBe("value");
	});

	it("deletes entries", async () => {
		await cache.set("key1", "value", 60000);
		const deleted = await cache.delete("key1");
		expect(deleted).toBe(true);
		expect(await cache.get("key1")).toBeUndefined();
	});

	it("returns false when deleting nonexistent keys", async () => {
		expect(await cache.delete("nonexistent")).toBe(false);
	});

	it("clears all entries", async () => {
		await cache.set("key1", "a", 60000);
		await cache.set("key2", "b", 60000);
		await cache.clear();
		expect(await cache.size()).toBe(0);
	});

	it("reports correct size excluding expired entries", async () => {
		await cache.set("key1", "a", 1000);
		await cache.set("key2", "b", 5000);
		expect(await cache.size()).toBe(2);

		vi.advanceTimersByTime(2000);
		expect(await cache.size()).toBe(1);
	});

	it("overwrites existing keys", async () => {
		await cache.set("key1", "old", 60000);
		await cache.set("key1", "new", 60000);
		expect(await cache.get("key1")).toBe("new");
	});
});
