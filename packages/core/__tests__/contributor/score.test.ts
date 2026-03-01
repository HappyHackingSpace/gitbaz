import { describe, expect, it } from "vitest";
import { calculateScore } from "../../src/contributor/score.js";
import type { UserStats } from "../../src/types.js";

const baseStats = (overrides: Partial<UserStats> = {}): UserStats => ({
	username: "testuser",
	accountCreatedAt: "2020-01-01T00:00:00Z",
	followers: 10,
	publicRepos: 5,
	totalCommitsLastYear: 100,
	globalPRsMerged: 20,
	globalPRsTotal: 25,
	organizations: [],
	...overrides,
});

describe("calculateScore", () => {
	it("returns a score between 0 and 100", () => {
		const result = calculateScore(baseStats());
		expect(result.score).toBeGreaterThanOrEqual(0);
		expect(result.score).toBeLessThanOrEqual(100);
	});

	it("includes the username in the result", () => {
		const result = calculateScore(baseStats({ username: "octocat" }));
		expect(result.username).toBe("octocat");
	});

	it("assigns newcomer tier for minimal stats", () => {
		const result = calculateScore(
			baseStats({
				accountCreatedAt: new Date().toISOString(),
				followers: 0,
				totalCommitsLastYear: 0,
				globalPRsMerged: 0,
				globalPRsTotal: 0,
			}),
		);
		expect(result.tier.id).toBe("newcomer");
		expect(result.score).toBeLessThanOrEqual(15);
	});

	it("assigns higher tier for impressive stats", () => {
		const fiveYearsAgo = new Date();
		fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
		const result = calculateScore(
			baseStats({
				accountCreatedAt: fiveYearsAgo.toISOString(),
				followers: 500,
				totalCommitsLastYear: 1000,
				globalPRsMerged: 200,
				globalPRsTotal: 220,
			}),
		);
		expect(result.score).toBeGreaterThan(60);
	});

	it("includes repo PR component when repo context is present", () => {
		const result = calculateScore(
			baseStats({
				repoPRsMerged: 3,
				repoPRsTotal: 5,
			}),
		);
		const repoComponent = result.breakdown.components.find((c) => c.name === "In-repo PRs");
		expect(repoComponent).toBeDefined();
		expect(repoComponent?.maxPoints).toBe(25);
	});

	it("excludes repo PR component when no repo context", () => {
		const result = calculateScore(baseStats());
		const repoComponent = result.breakdown.components.find((c) => c.name === "In-repo PRs");
		expect(repoComponent).toBeUndefined();
	});

	it("redistributes repo points when no repo context", () => {
		const result = calculateScore(baseStats());
		const globalComponent = result.breakdown.components.find((c) => c.name === "Global PRs");
		const commitsComponent = result.breakdown.components.find((c) => c.name === "Commits (yr)");
		const mergeRateComponent = result.breakdown.components.find((c) => c.name === "Merge rate");

		// Redistributed: global gets +10, commits gets +10, mergeRate gets +5
		expect(globalComponent?.maxPoints).toBe(30);
		expect(commitsComponent?.maxPoints).toBe(25);
		expect(mergeRateComponent?.maxPoints).toBe(25);
	});

	it("total always sums to max 100 points across all components", () => {
		const withRepo = calculateScore(baseStats({ repoPRsMerged: 5, repoPRsTotal: 10 }));
		const maxPointsWithRepo = withRepo.breakdown.components.reduce(
			(sum, c) => sum + c.maxPoints,
			0,
		);
		expect(maxPointsWithRepo).toBe(100);

		const withoutRepo = calculateScore(baseStats());
		const maxPointsWithoutRepo = withoutRepo.breakdown.components.reduce(
			(sum, c) => sum + c.maxPoints,
			0,
		);
		expect(maxPointsWithoutRepo).toBe(100);
	});

	it("includes badges in the result", () => {
		const result = calculateScore(baseStats({ repoPRsMerged: 1 }));
		expect(result.badges.map((b) => b.id)).toContain("first-time-contributor");
	});

	it("includes computedAt timestamp", () => {
		const before = Date.now();
		const result = calculateScore(baseStats());
		const after = Date.now();
		const computedMs = new Date(result.computedAt).getTime();
		expect(computedMs).toBeGreaterThanOrEqual(before);
		expect(computedMs).toBeLessThanOrEqual(after);
	});

	it("gives zero merge rate when no PRs exist", () => {
		const result = calculateScore(baseStats({ globalPRsMerged: 0, globalPRsTotal: 0 }));
		const mergeRateComponent = result.breakdown.components.find((c) => c.name === "Merge rate");
		expect(mergeRateComponent?.points).toBe(0);
	});

	it("includes globalPRsTotal in result", () => {
		const result = calculateScore(baseStats({ globalPRsTotal: 25 }));
		expect(result.globalPRsTotal).toBe(25);
	});

	it("includes repoPRsTotal when repo context is present", () => {
		const result = calculateScore(baseStats({ repoPRsMerged: 3, repoPRsTotal: 5 }));
		expect(result.repoPRsTotal).toBe(5);
	});

	it("excludes repoPRsTotal when no repo context", () => {
		const result = calculateScore(baseStats());
		expect(result.repoPRsTotal).toBeUndefined();
	});

	it("passes through organizations from stats", () => {
		const orgs = [
			{
				login: "google",
				name: "Google",
				avatarUrl: "https://avatars.githubusercontent.com/u/1342004",
			},
			{
				login: "kubernetes",
				name: null,
				avatarUrl: "https://avatars.githubusercontent.com/u/13629408",
			},
		];
		const result = calculateScore(baseStats({ organizations: orgs }));
		expect(result.organizations).toEqual(orgs);
	});

	it("passes through empty organizations", () => {
		const result = calculateScore(baseStats());
		expect(result.organizations).toEqual([]);
	});
});
