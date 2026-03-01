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

		// Skip non-content paths
		const NON_CONTENT_PREFIXES = ["settings", "marketplace", "explore", "topics", "sponsors"];
		if (NON_CONTENT_PREFIXES.includes(segments[0])) return undefined;

		// Org pages (/orgs/X/...) — return as unknown (contributor-only, no repo context)
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

export const toRepoContext = (parsed: ParsedGitHubUrl): RepoContext => ({
	owner: parsed.owner,
	repo: parsed.repo,
});

export const toContributionRef = (parsed: ParsedGitHubUrl): ContributionRef | undefined => {
	if (parsed.number === undefined) return undefined;
	return { owner: parsed.owner, repo: parsed.repo, number: parsed.number };
};
