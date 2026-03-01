import { Command } from "commander";
import { clearToken, getToken, setToken } from "../config/store.js";

export const authCommand = new Command("auth")
	.description("Manage GitHub authentication")
	.argument("[token]", "GitHub personal access token")
	.option("--status", "Check authentication status")
	.option("--clear", "Remove stored token")
	.action((token?: string, opts?: { status?: boolean; clear?: boolean }) => {
		if (opts?.status) {
			const stored = getToken();
			if (stored) {
				const masked = `${stored.slice(0, 4)}..${stored.slice(-4)}`;
				console.log(`Authenticated: ${masked}`);
			} else {
				console.log("Not authenticated. Run: gitbaz auth <token>");
			}
			return;
		}

		if (opts?.clear) {
			clearToken();
			console.log("Token cleared.");
			return;
		}

		if (!token) {
			console.error("Usage: gitbaz auth <token> | --status | --clear");
			process.exit(1);
		}

		setToken(token as string);
		console.log("Token saved.");
	});
