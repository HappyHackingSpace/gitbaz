import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchScorecard } from "../../src/github/scorecard.js";

vi.mock("@happyhackingspace/scorecard", () => ({
	computeScorecard: vi.fn(),
}));

import { computeScorecard } from "@happyhackingspace/scorecard";

const mockScorecardResult = {
	score: 7.6,
	date: "2024-06-01",
	repo: "github.com/kubernetes/kubernetes",
	checks: [
		{ name: "Maintained", score: 10, reason: "30 commits in 90 days" },
		{ name: "Code-Review", score: 10, reason: "all changesets reviewed" },
		{ name: "Vulnerabilities", score: 9, reason: "no vulnerabilities detected" },
		{ name: "Signed-Releases", score: -1, reason: "No releases found" },
	],
};

describe("fetchScorecard", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns mapped scorecard result on success", async () => {
		vi.mocked(computeScorecard).mockResolvedValueOnce(mockScorecardResult);

		const result = await fetchScorecard("kubernetes", "kubernetes", "ghp_test");

		expect(result).not.toBeNull();
		expect(result?.score).toBe(7.6);
		expect(result?.date).toBe("2024-06-01");
		expect(result?.checks).toHaveLength(3);
		expect(result?.checks[0]).toEqual({
			name: "Maintained",
			score: 10,
			reason: "30 commits in 90 days",
		});
		expect(computeScorecard).toHaveBeenCalledWith("kubernetes", "kubernetes", {
			token: "ghp_test",
			fetch: expect.any(Function),
		});
	});

	it("filters out checks with score -1 (not applicable)", async () => {
		vi.mocked(computeScorecard).mockResolvedValueOnce(mockScorecardResult);

		const result = await fetchScorecard("kubernetes", "kubernetes", "ghp_test");

		expect(result?.checks).toHaveLength(3);
		expect(result?.checks.every((c) => c.score >= 0)).toBe(true);
	});

	it("returns null when no token provided", async () => {
		const result = await fetchScorecard("some", "repo");
		expect(result).toBeNull();
		expect(computeScorecard).not.toHaveBeenCalled();
	});

	it("returns null on error", async () => {
		vi.mocked(computeScorecard).mockRejectedValueOnce(new Error("API error"));

		const result = await fetchScorecard("some", "small-repo", "ghp_test");
		expect(result).toBeNull();
	});
});
