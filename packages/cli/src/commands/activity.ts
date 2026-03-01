import {
	AuthenticationError,
	BotAccountError,
	RateLimitError,
	UserNotFoundError,
	createGitBazClient,
	detectBot,
} from "@happyhackingspace/gitbaz";
import { Command } from "commander";
import { FileCacheAdapter } from "../config/cache-adapter.js";
import { getToken } from "../config/store.js";
import { formatActivity, formatActivityJson, formatActivityMinimal } from "../output/formatters.js";

export const activityCommand = new Command("activity")
	.description("Show contribution activity heatmap and streaks for a GitHub user")
	.argument("<username>", "GitHub username")
	.option("--format <type>", "Output format: table, json, minimal", "table")
	.option("--no-cache", "Bypass cached results")
	.action(async (username: string, opts: { format: string; cache: boolean }) => {
		const token = getToken();
		if (!token) {
			console.error("No token found. Run: gitbaz auth <token>");
			process.exit(1);
		}

		const botCheck = detectBot(username);
		if (botCheck.confidence === "definitive") {
			console.log(
				`\u{1F916} "${username}" is a bot account. Activity is not available for GitHub App bots.`,
			);
			return;
		}

		try {
			const client = createGitBazClient({
				token,
				cache: opts.cache ? new FileCacheAdapter() : undefined,
			});

			const result = await client.getActivity(username);

			const formatters: Record<string, (r: typeof result) => string> = {
				table: formatActivity,
				json: formatActivityJson,
				minimal: formatActivityMinimal,
			};

			const formatter = formatters[opts.format] ?? formatActivity;
			console.log(formatter(result));
		} catch (error) {
			if (error instanceof BotAccountError) {
				console.log(
					`\u{1F916} "${username}" is a bot account. Activity is not available for GitHub App bots.`,
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
