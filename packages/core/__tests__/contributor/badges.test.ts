import { describe, expect, it } from "vitest";
import { detectBadges } from "../../src/contributor/badges.js";
import type { UserStats } from "../../src/types.js";

const baseStats = (overrides: Partial<UserStats> = {}): UserStats => ({
	username: "testuser",
	accountCreatedAt: "2020-01-01T00:00:00Z",
	followers: 10,
	publicRepos: 5,
	totalCommitsLastYear: 100,
	globalPRsMerged: 20,
	globalPRsTotal: 25,
	...overrides,
});

describe("detectBadges", () => {
	it("returns empty array for average user", () => {
		const badges = detectBadges(baseStats());
		const ids = badges.map((b) => b.id);
		expect(ids).not.toContain("first-time-contributor");
		expect(ids).not.toContain("issue-only");
		expect(ids).not.toContain("prolific");
		expect(ids).not.toContain("popular");
		expect(ids).not.toContain("new-account");
	});

	it("detects first-time-contributor when repoPRsMerged is 1", () => {
		const badges = detectBadges(baseStats({ repoPRsMerged: 1 }));
		expect(badges.map((b) => b.id)).toContain("first-time-contributor");
	});

	it("does not detect first-time-contributor when repoPRsMerged is 2", () => {
		const badges = detectBadges(baseStats({ repoPRsMerged: 2 }));
		expect(badges.map((b) => b.id)).not.toContain("first-time-contributor");
	});

	it("detects issue-only when no PRs and no repos", () => {
		const badges = detectBadges(
			baseStats({ globalPRsTotal: 0, globalPRsMerged: 0, publicRepos: 0 }),
		);
		expect(badges.map((b) => b.id)).toContain("issue-only");
	});

	it("detects high-merge-rate for >80% with >=5 PRs", () => {
		const badges = detectBadges(baseStats({ globalPRsMerged: 9, globalPRsTotal: 10 }));
		expect(badges.map((b) => b.id)).toContain("high-merge-rate");
	});

	it("does not detect high-merge-rate with fewer than 5 PRs", () => {
		const badges = detectBadges(baseStats({ globalPRsMerged: 4, globalPRsTotal: 4 }));
		expect(badges.map((b) => b.id)).not.toContain("high-merge-rate");
	});

	it("detects prolific for >100 merged PRs", () => {
		const badges = detectBadges(baseStats({ globalPRsMerged: 101, globalPRsTotal: 120 }));
		expect(badges.map((b) => b.id)).toContain("prolific");
	});

	it("detects veteran for accounts older than 5 years", () => {
		const sixYearsAgo = new Date();
		sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);
		const badges = detectBadges(baseStats({ accountCreatedAt: sixYearsAgo.toISOString() }));
		expect(badges.map((b) => b.id)).toContain("veteran");
	});

	it("detects popular for >100 followers", () => {
		const badges = detectBadges(baseStats({ followers: 150 }));
		expect(badges.map((b) => b.id)).toContain("popular");
	});

	it("detects new-account for accounts under 90 days old", () => {
		const recentDate = new Date();
		recentDate.setDate(recentDate.getDate() - 30);
		const badges = detectBadges(baseStats({ accountCreatedAt: recentDate.toISOString() }));
		expect(badges.map((b) => b.id)).toContain("new-account");
	});

	it("detects bot-account badge for likely bot username", () => {
		const badges = detectBadges(baseStats({ username: "snyk-bot" }));
		expect(badges.map((b) => b.id)).toContain("bot-account");
	});

	it("detects bot-account badge for definitive bot username", () => {
		const badges = detectBadges(baseStats({ username: "dependabot[bot]" }));
		expect(badges.map((b) => b.id)).toContain("bot-account");
	});

	it("does not detect bot-account badge for regular user", () => {
		const badges = detectBadges(baseStats({ username: "testuser" }));
		expect(badges.map((b) => b.id)).not.toContain("bot-account");
	});

	it("can detect multiple badges simultaneously", () => {
		const sixYearsAgo = new Date();
		sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);
		const badges = detectBadges(
			baseStats({
				accountCreatedAt: sixYearsAgo.toISOString(),
				followers: 200,
				globalPRsMerged: 150,
				globalPRsTotal: 160,
			}),
		);
		const ids = badges.map((b) => b.id);
		expect(ids).toContain("veteran");
		expect(ids).toContain("popular");
		expect(ids).toContain("prolific");
		expect(ids).toContain("high-merge-rate");
	});
});
