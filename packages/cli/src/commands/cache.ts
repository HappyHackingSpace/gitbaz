import { Command } from "commander";
import { FileCacheAdapter } from "../config/cache-adapter.js";

export const cacheCommand = new Command("cache").description("Manage cached Contributor Scores");

cacheCommand
	.command("clear")
	.description("Clear all cached data")
	.action(async () => {
		const cache = new FileCacheAdapter();
		await cache.clear();
		console.log("Cache cleared.");
	});

cacheCommand
	.command("stats")
	.description("Show cache statistics")
	.action(async () => {
		const cache = new FileCacheAdapter();
		const entries = await cache.size();
		console.log(`Cached entries: ${entries}`);
	});
