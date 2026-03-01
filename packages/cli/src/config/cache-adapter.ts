import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { CacheAdapter } from "@happyhackingspace/gitbaz";
import { getConfigDir } from "./store.js";

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const CACHE_DIR = join(getConfigDir(), "cache");

const ensureCacheDir = (): void => {
	if (!existsSync(CACHE_DIR)) {
		mkdirSync(CACHE_DIR, { recursive: true });
	}
};

const keyToFilename = (key: string): string => `${key.replaceAll(/[^a-zA-Z0-9-_]/g, "_")}.json`;

export class FileCacheAdapter implements CacheAdapter {
	async get<T>(key: string): Promise<T | undefined> {
		const filePath = join(CACHE_DIR, keyToFilename(key));
		if (!existsSync(filePath)) return undefined;

		try {
			const entry = JSON.parse(readFileSync(filePath, "utf-8")) as CacheEntry<T>;
			if (Date.now() >= entry.expiresAt) {
				unlinkSync(filePath);
				return undefined;
			}
			return entry.value;
		} catch {
			return undefined;
		}
	}

	async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
		ensureCacheDir();
		const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
		writeFileSync(join(CACHE_DIR, keyToFilename(key)), JSON.stringify(entry), "utf-8");
	}

	async delete(key: string): Promise<boolean> {
		const filePath = join(CACHE_DIR, keyToFilename(key));
		if (!existsSync(filePath)) return false;
		unlinkSync(filePath);
		return true;
	}

	async clear(): Promise<void> {
		if (!existsSync(CACHE_DIR)) return;
		for (const file of readdirSync(CACHE_DIR)) {
			if (file.endsWith(".json")) {
				unlinkSync(join(CACHE_DIR, file));
			}
		}
	}

	async size(): Promise<number> {
		if (!existsSync(CACHE_DIR)) return 0;
		return readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json")).length;
	}
}
