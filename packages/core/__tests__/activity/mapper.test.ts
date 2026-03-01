import { describe, expect, it } from "vitest";
import {
	type GraphQLActivityResponse,
	contributionLevelToNumber,
	mapGraphQLToActivity,
} from "../../src/github/mappers.js";
import type { ContributionStreak } from "../../src/types.js";

describe("contributionLevelToNumber", () => {
	it.each([
		["NONE", 0],
		["FIRST_QUARTILE", 1],
		["SECOND_QUARTILE", 2],
		["THIRD_QUARTILE", 3],
		["FOURTH_QUARTILE", 4],
	] as const)("maps %s to %d", (level, expected) => {
		expect(contributionLevelToNumber(level)).toBe(expected);
	});

	it("defaults to 0 for unknown string", () => {
		expect(contributionLevelToNumber("UNKNOWN")).toBe(0);
		expect(contributionLevelToNumber("")).toBe(0);
	});
});

describe("mapGraphQLToActivity", () => {
	const mockStreak: ContributionStreak = {
		current: 5,
		longest: 10,
		currentStart: "2024-06-10",
		longestStart: "2024-03-01",
		longestEnd: "2024-03-10",
	};

	const mockResponse: GraphQLActivityResponse = {
		user: {
			contributionsCollection: {
				contributionCalendar: {
					totalContributions: 742,
					weeks: [
						{
							contributionDays: [
								{ date: "2024-01-01", contributionCount: 0, contributionLevel: "NONE" },
								{
									date: "2024-01-02",
									contributionCount: 3,
									contributionLevel: "FIRST_QUARTILE",
								},
								{
									date: "2024-01-03",
									contributionCount: 8,
									contributionLevel: "THIRD_QUARTILE",
								},
							],
						},
						{
							contributionDays: [
								{
									date: "2024-01-07",
									contributionCount: 15,
									contributionLevel: "FOURTH_QUARTILE",
								},
							],
						},
					],
				},
			},
		},
	};

	it("maps totalContributions correctly", () => {
		const result = mapGraphQLToActivity(mockResponse, "octocat", mockStreak);
		expect(result.totalContributions).toBe(742);
	});

	it("maps username correctly", () => {
		const result = mapGraphQLToActivity(mockResponse, "octocat", mockStreak);
		expect(result.username).toBe("octocat");
	});

	it("maps weeks and days with proper structure", () => {
		const result = mapGraphQLToActivity(mockResponse, "octocat", mockStreak);
		expect(result.weeks).toHaveLength(2);
		expect(result.weeks[0].days).toHaveLength(3);
		expect(result.weeks[1].days).toHaveLength(1);
	});

	it("maps day properties correctly", () => {
		const result = mapGraphQLToActivity(mockResponse, "octocat", mockStreak);
		const firstDay = result.weeks[0].days[0];
		expect(firstDay).toEqual({ date: "2024-01-01", count: 0, level: 0 });

		const secondDay = result.weeks[0].days[1];
		expect(secondDay).toEqual({ date: "2024-01-02", count: 3, level: 1 });

		const thirdDay = result.weeks[0].days[2];
		expect(thirdDay).toEqual({ date: "2024-01-03", count: 8, level: 3 });
	});

	it("passes streak through unchanged", () => {
		const result = mapGraphQLToActivity(mockResponse, "octocat", mockStreak);
		expect(result.streak).toEqual(mockStreak);
	});

	it("sets fetchedAt to a valid ISO date string", () => {
		const result = mapGraphQLToActivity(mockResponse, "octocat", mockStreak);
		expect(new Date(result.fetchedAt).toISOString()).toBe(result.fetchedAt);
	});
});
