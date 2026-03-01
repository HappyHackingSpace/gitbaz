import type { Octokit } from "@octokit/core";
import type { RepoContext } from "../types.js";

interface SearchResult {
	readonly total_count: number;
}

/** Counts merged PRs by a user in a specific repo via REST Search API */
export const countRepoPRsMerged = async (
	octokit: Octokit,
	username: string,
	repo: RepoContext,
): Promise<number> => {
	try {
		const response = await octokit.request("GET /search/issues", {
			q: `repo:${repo.owner}/${repo.repo} type:pr author:${username} is:merged`,
			per_page: 1,
		});
		return (response.data as SearchResult).total_count;
	} catch {
		return 0;
	}
};

/** Counts total PRs (all states) by a user in a specific repo */
export const countRepoPRsTotal = async (
	octokit: Octokit,
	username: string,
	repo: RepoContext,
): Promise<number> => {
	try {
		const response = await octokit.request("GET /search/issues", {
			q: `repo:${repo.owner}/${repo.repo} type:pr author:${username}`,
			per_page: 1,
		});
		return (response.data as SearchResult).total_count;
	} catch {
		return 0;
	}
};

/** Fetches the VOUCHED.td file content from a repo, trying .github/ first then root */
export const fetchVouchFile = async (
	octokit: Octokit,
	repo: RepoContext,
): Promise<string | null> => {
	const paths = [".github/VOUCHED.td", "VOUCHED.td"];
	for (const path of paths) {
		try {
			const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
				owner: repo.owner,
				repo: repo.repo,
				path,
				headers: { accept: "application/vnd.github.raw+json" },
			});
			return response.data as unknown as string;
		} catch {
			// Try next path
		}
	}
	return null;
};

/** Checks if the authenticated user has push (write) permission on a repo */
export const checkCollaboratorPermission = async (
	octokit: Octokit,
	repo: RepoContext,
): Promise<boolean> => {
	try {
		const response = await octokit.request("GET /repos/{owner}/{repo}", {
			owner: repo.owner,
			repo: repo.repo,
		});
		const permissions = (response.data as { permissions?: { push?: boolean } }).permissions;
		return permissions?.push === true;
	} catch {
		return false;
	}
};

/** Posts a comment on an issue/PR (used for vouch trigger commands) */
export const postVouchComment = async (
	octokit: Octokit,
	repo: RepoContext,
	issueNumber: number,
	body: string,
): Promise<{ id: number; html_url: string }> => {
	const response = await octokit.request(
		"POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
		{
			owner: repo.owner,
			repo: repo.repo,
			issue_number: issueNumber,
			body,
		},
	);
	return response.data as { id: number; html_url: string };
};
