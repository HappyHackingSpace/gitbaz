import {
	AuthenticationError,
	BotAccountError,
	RateLimitError,
	type RepoContext,
	UserNotFoundError,
	createGitBazClient,
	detectBot,
} from "@happyhackingspace/gitbaz";
import { Command } from "commander";
import { FileCacheAdapter } from "../config/cache-adapter.js";
import { getToken } from "../config/store.js";
import { formatJson, formatMinimal, formatTable } from "../output/formatters.js";

const parseRepo = (repoStr: string): RepoContext | undefined => {
	const parts = repoStr.split("/");
	if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined;
	return { owner: parts[0], repo: parts[1] };
};

export const scoreCommand = new Command("score")
	.description("Show Contributor context for a GitHub user")
	.argument("<username>", "GitHub username to evaluate")
	.option("--repo <owner/repo>", "Evaluate within a specific repository context")
	.option("--format <type>", "Output format: table, json, minimal", "table")
	.option("--no-cache", "Bypass cached results")
	.action(async (username: string, opts: { repo?: string; format: string; cache: boolean }) => {
		const token = getToken();
		if (!token) {
			console.error("No token found. Run: gitbaz auth <token>");
			process.exit(1);
		}

		let repo: RepoContext | undefined;
		if (opts.repo) {
			repo = parseRepo(opts.repo);
			if (!repo) {
				console.error("Invalid repo format. Use: owner/repo");
				process.exit(1);
			}
		}

		const botCheck = detectBot(username);
		if (botCheck.confidence === "definitive") {
			console.log(
				`🤖 "${username}" is a bot account. Scoring is not available for GitHub App bots.`,
			);
			return;
		}

		try {
			const client = createGitBazClient({
				token,
				cache: opts.cache ? new FileCacheAdapter() : undefined,
			});

			const result = await client.getScore(username, repo);

			const formatters: Record<string, (r: typeof result) => string> = {
				table: formatTable,
				json: formatJson,
				minimal: formatMinimal,
			};

			const formatter = formatters[opts.format] ?? formatTable;
			console.log(formatter(result));
		} catch (error) {
			if (error instanceof BotAccountError) {
				console.log(
					`🤖 "${username}" is a bot account. Scoring is not available for GitHub App bots.`,
				);
			} else if (error instanceof AuthenticationError) {
				console.error("Authentication failed. Check your token: gitbaz auth --status");
				process.exit(1);
			} else if (error instanceof UserNotFoundError) {
				console.error(`User "${username}" not found on GitHub.`);
				process.exit(1);
			} else if (error instanceof RateLimitError) {
				console.error(`Rate limited. Resets at ${error.resetAt.toLocaleTimeString()}`);
				process.exit(1);
			} else {
				console.error("Unexpected error:", (error as Error).message);
				process.exit(1);
			}
		}
	});
