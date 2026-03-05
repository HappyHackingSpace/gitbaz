import type { ContributionRef, RepoContext } from "@happyhackingspace/gitbaz";

interface ParsedGitHubUrl {
	owner: string;
	repo: string;
	type: "issue" | "pull" | "discussion" | "repo" | "unknown";
	number?: number;
}

/** Extracts repo context and page type from a GitHub URL */
export const parseGitHubUrl = (url: string): ParsedGitHubUrl | undefined => {
	try {
		const parsed = new URL(url);
		if (parsed.hostname !== "github.com") return undefined;

		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments.length < 2) return undefined;

		// Skip GitHub global/non-repo paths
		const NON_REPO_PREFIXES = [
			"settings",
			"marketplace",
			"explore",
			"topics",
			"sponsors",
			"issues",
			"pulls",
			"notifications",
			"new",
			"codespaces",
			"features",
			"trending",
			"collections",
			"events",
			"about",
			"pricing",
			"login",
			"signup",
			"organizations",
			"stars",
		];
		if (NON_REPO_PREFIXES.includes(segments[0])) return undefined;

		// Org discussions: /orgs/X/discussions/N
		if (segments[0] === "orgs" && segments[2] === "discussions" && segments[3]) {
			return {
				owner: segments[1],
				repo: "",
				type: "discussion",
				number: Number.parseInt(segments[3], 10),
			};
		}

		// Other org pages (/orgs/X/...) — no repo context
		if (segments[0] === "orgs" && segments.length >= 2) {
			return { owner: segments[1], repo: "", type: "unknown" };
		}

		const [owner, repo] = segments;

		let type: "issue" | "pull" | "discussion" | "repo" | "unknown" = "unknown";
		let number: number | undefined;

		if (segments[2] === "issues" && segments[3]) {
			type = "issue";
			number = Number.parseInt(segments[3], 10);
		} else if (segments[2] === "pull" && segments[3]) {
			type = "pull";
			number = Number.parseInt(segments[3], 10);
		} else if (segments[2] === "discussions" && segments[3]) {
			type = "discussion";
			number = Number.parseInt(segments[3], 10);
		} else if (!segments[2]) {
			type = "repo";
		}

		return { owner, repo, type, number };
	} catch {
		return undefined;
	}
};

/** Resolves the real repo for org discussions from sidebar data-url */
const resolveOrgDiscussionRepo = (owner: string): string => {
	const sidebar = document.querySelector<HTMLElement>("#partial-discussion-sidebar[data-url]");
	const dataUrl = sidebar?.dataset.url;
	if (dataUrl) {
		const parts = dataUrl.split("/").filter(Boolean);
		if (parts.length >= 3 && parts[0] === owner) return parts[1];
	}
	return "";
};

export const toRepoContext = (parsed: ParsedGitHubUrl): RepoContext => {
	let { repo } = parsed;
	if (!repo && parsed.type === "discussion") {
		repo = resolveOrgDiscussionRepo(parsed.owner);
	}
	return { owner: parsed.owner, repo };
};

export const toContributionRef = (parsed: ParsedGitHubUrl): ContributionRef | undefined => {
	if (parsed.number === undefined) return undefined;
	const { repo } = toRepoContext(parsed);
	if (!repo) return undefined;
	return { owner: parsed.owner, repo, number: parsed.number };
};
