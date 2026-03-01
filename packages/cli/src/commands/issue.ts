import {
	AuthenticationError,
	ContributionNotFoundError,
	RateLimitError,
	createGitBazClient,
	summarizeIssue,
} from "@happyhackingspace/gitbaz";
import type { ContributionRef } from "@happyhackingspace/gitbaz";
import { Command } from "commander";
import { FileCacheAdapter } from "../config/cache-adapter.js";
import { getToken } from "../config/store.js";
import { formatIssue, formatIssueJson, formatIssueMinimal } from "../output/formatters.js";

const parseRef = (refStr: string): ContributionRef | undefined => {
	const match = refStr.match(/^([^/]+)\/([^#]+)#(\d+)$/);
	if (!match) return undefined;
	return { owner: match[1], repo: match[2], number: Number.parseInt(match[3], 10) };
};

export const issueCommand = new Command("issue")
	.description("Show Issue context")
	.argument("<ref>", "Issue reference (owner/repo#number)")
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

			const ctx = await client.getIssue(ref);
			const summary = summarizeIssue(ctx);

			const formatters: Record<string, () => string> = {
				table: () => formatIssue(ctx, summary),
				json: () => formatIssueJson(ctx),
				minimal: () => formatIssueMinimal(ctx),
			};

			const formatter = formatters[opts.format] ?? (() => formatIssue(ctx, summary));
			console.log(formatter());
		} catch (error) {
			if (error instanceof AuthenticationError) {
				console.error("Authentication failed. Check your token: gitbaz auth --status");
			} else if (error instanceof ContributionNotFoundError) {
				console.error(`Issue ${refStr} not found.`);
			} else if (error instanceof RateLimitError) {
				console.error(`Rate limited. Resets at ${error.resetAt.toLocaleTimeString()}`);
			} else {
				console.error("Unexpected error:", (error as Error).message);
			}
			process.exit(1);
		}
	});
