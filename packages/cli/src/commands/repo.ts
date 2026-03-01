import {
	AuthenticationError,
	RateLimitError,
	RepositoryNotFoundError,
	createGitBazClient,
} from "@happyhackingspace/gitbaz";
import { Command } from "commander";
import { FileCacheAdapter } from "../config/cache-adapter.js";
import { getToken } from "../config/store.js";
import { formatRepo, formatRepoJson, formatRepoMinimal } from "../output/formatters.js";

const parseRepo = (repoStr: string): { owner: string; repo: string } | undefined => {
	const match = repoStr.match(/^([^/]+)\/([^/]+)$/);
	if (!match) return undefined;
	return { owner: match[1], repo: match[2] };
};

export const repoCommand = new Command("repo")
	.description("Show Repository context")
	.argument("<owner/repo>", "Repository (owner/repo)")
	.option("--format <type>", "Output format: table, json, minimal", "table")
	.option("--no-cache", "Bypass cached results")
	.action(async (repoStr: string, opts: { format: string; cache: boolean }) => {
		const token = getToken();
		if (!token) {
			console.error("No token found. Run: gitbaz auth <token>");
			process.exit(1);
		}

		const repo = parseRepo(repoStr);
		if (!repo) {
			console.error("Invalid format. Use: owner/repo");
			process.exit(1);
			return;
		}

		try {
			const client = createGitBazClient({
				token,
				cache: opts.cache ? new FileCacheAdapter() : undefined,
			});

			const ctx = await client.getRepositoryContext(repo);

			const formatters: Record<string, () => string> = {
				table: () => formatRepo(ctx),
				json: () => formatRepoJson(ctx),
				minimal: () => formatRepoMinimal(ctx),
			};

			const formatter = formatters[opts.format] ?? (() => formatRepo(ctx));
			console.log(formatter());
		} catch (error) {
			if (error instanceof AuthenticationError) {
				console.error("Authentication failed. Check your token: gitbaz auth --status");
			} else if (error instanceof RepositoryNotFoundError) {
				console.error(`Repository ${repoStr} not found.`);
			} else if (error instanceof RateLimitError) {
				console.error(`Rate limited. Resets at ${error.resetAt.toLocaleTimeString()}`);
			} else {
				console.error("Unexpected error:", (error as Error).message);
			}
			process.exit(1);
		}
	});
