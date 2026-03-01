import {
	AuthenticationError,
	ContributionNotFoundError,
	RateLimitError,
	createGitBazClient,
	detectAIGenerated,
	summarizePullRequest,
} from "@happyhackingspace/gitbaz";
import type { ContributionRef, VouchLookupResult } from "@happyhackingspace/gitbaz";
import { Command } from "commander";
import { FileCacheAdapter } from "../config/cache-adapter.js";
import { getToken } from "../config/store.js";
import {
	formatPullRequest,
	formatPullRequestJson,
	formatPullRequestMinimal,
} from "../output/formatters.js";

const parseRef = (refStr: string): ContributionRef | undefined => {
	const match = refStr.match(/^([^/]+)\/([^#]+)#(\d+)$/);
	if (!match) return undefined;
	return { owner: match[1], repo: match[2], number: Number.parseInt(match[3], 10) };
};

export const prCommand = new Command("pr")
	.description("Show Pull Request context")
	.argument("<ref>", "Pull request reference (owner/repo#number)")
	.option("--format <type>", "Output format: table, json, minimal", "table")
	.option("--no-cache", "Bypass cached results")
	.action(async (refStr: string, opts: { format: string; cache: boolean }) => {
		const token = getToken();
		if (!token) {
			console.error("No token found. Run: gitbaz auth <token>");
			process.exit(1);
		}

		const ref = parseRef(refStr);
		if (!ref) {
			console.error("Invalid reference format. Use: owner/repo#number");
			process.exit(1);
			return;
		}

		try {
			const client = createGitBazClient({
				token,
				cache: opts.cache ? new FileCacheAdapter() : undefined,
			});

			const ctx = await client.getPullRequest(ref);
			const summary = summarizePullRequest(ctx);
			const aiDetection = detectAIGenerated(ctx);

			const repo = { owner: ref.owner, repo: ref.repo };
			let vouch: VouchLookupResult | undefined;
			try {
				vouch = await client.getVouchStatus(ctx.author, repo);
			} catch {
				// Vouch lookup is best-effort
			}

			const formatters: Record<string, () => string> = {
				table: () => formatPullRequest(ctx, summary, aiDetection, vouch),
				json: () => formatPullRequestJson(ctx, aiDetection, vouch),
				minimal: () => formatPullRequestMinimal(ctx),
			};

			const formatter = formatters[opts.format] ?? (() => formatPullRequest(ctx, summary));
			console.log(formatter());
		} catch (error) {
			if (error instanceof AuthenticationError) {
				console.error("Authentication failed. Check your token: gitbaz auth --status");
			} else if (error instanceof ContributionNotFoundError) {
				console.error(`Pull request ${refStr} not found.`);
			} else if (error instanceof RateLimitError) {
				console.error(`Rate limited. Resets at ${error.resetAt.toLocaleTimeString()}`);
			} else {
				console.error("Unexpected error:", (error as Error).message);
			}
			process.exit(1);
		}
	});
