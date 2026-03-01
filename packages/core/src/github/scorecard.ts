import { computeScorecard } from "@happyhackingspace/scorecard";
import type { ScorecardResult } from "../types.js";

export const fetchScorecard = async (
	owner: string,
	repo: string,
	token?: string,
): Promise<ScorecardResult | null> => {
	if (!token) return null;

	try {
		const result = await computeScorecard(owner, repo, {
			token,
			fetch: (url, init) => fetch(url, init),
		});

		return {
			score: result.score,
			date: result.date,
			checks: result.checks
				.filter((c) => c.score >= 0)
				.map((c) => ({
					name: c.name,
					score: c.score,
					reason: c.reason,
				})),
		};
	} catch (error) {
		console.error("[gitbaz] scorecard fetch failed:", error);
		return null;
	}
};
