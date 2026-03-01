import { describe, expect, it } from "vitest";
import { calculateStreaks } from "../../src/activity/streaks.js";
import type { ContributionWeek } from "../../src/types.js";

const makeDay = (date: string, count: number) => ({
	date,
	count,
	level: (count === 0 ? 0 : count <= 3 ? 1 : count <= 6 ? 2 : count <= 9 ? 3 : 4) as
		| 0
		| 1
		| 2
		| 3
		| 4,
});

const makeWeek = (
	...days: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[]
): ContributionWeek => ({
	days,
});

describe("calculateStreaks", () => {
	it("returns all zeros for empty weeks", () => {
		const result = calculateStreaks([]);
		expect(result).toEqual({
			current: 0,
			longest: 0,
			currentStart: null,
			longestStart: null,
			longestEnd: null,
		});
	});

	it("returns all zeros when all days have zero contributions", () => {
		const weeks: ContributionWeek[] = [
			makeWeek(makeDay("2024-01-01", 0), makeDay("2024-01-02", 0), makeDay("2024-01-03", 0)),
		];
		const result = calculateStreaks(weeks);
		expect(result.current).toBe(0);
		expect(result.longest).toBe(0);
		expect(result.currentStart).toBeNull();
		expect(result.longestStart).toBeNull();
	});

	it("handles a single day with contributions", () => {
		const weeks: ContributionWeek[] = [makeWeek(makeDay("2024-06-15", 5))];
		const result = calculateStreaks(weeks);
		expect(result.current).toBe(1);
		expect(result.longest).toBe(1);
		expect(result.currentStart).toBe("2024-06-15");
		expect(result.longestStart).toBe("2024-06-15");
		expect(result.longestEnd).toBe("2024-06-15");
	});

	it("calculates multiple consecutive days correctly", () => {
		const weeks: ContributionWeek[] = [
			makeWeek(makeDay("2024-01-01", 3), makeDay("2024-01-02", 1), makeDay("2024-01-03", 7)),
		];
		const result = calculateStreaks(weeks);
		expect(result.current).toBe(3);
		expect(result.longest).toBe(3);
		expect(result.currentStart).toBe("2024-01-01");
		expect(result.longestStart).toBe("2024-01-01");
		expect(result.longestEnd).toBe("2024-01-03");
	});

	it("handles gap in middle — longest captures earlier run, current captures latest", () => {
		const weeks: ContributionWeek[] = [
			makeWeek(
				makeDay("2024-01-01", 1),
				makeDay("2024-01-02", 2),
				makeDay("2024-01-03", 3),
				makeDay("2024-01-04", 4),
				makeDay("2024-01-05", 0),
				makeDay("2024-01-06", 1),
				makeDay("2024-01-07", 2),
			),
		];
		const result = calculateStreaks(weeks);
		expect(result.current).toBe(2);
		expect(result.longest).toBe(4);
		expect(result.currentStart).toBe("2024-01-06");
		expect(result.longestStart).toBe("2024-01-01");
		expect(result.longestEnd).toBe("2024-01-04");
	});

	it("handles full week of contributions", () => {
		const weeks: ContributionWeek[] = [
			makeWeek(
				makeDay("2024-03-04", 1),
				makeDay("2024-03-05", 2),
				makeDay("2024-03-06", 3),
				makeDay("2024-03-07", 4),
				makeDay("2024-03-08", 5),
				makeDay("2024-03-09", 6),
				makeDay("2024-03-10", 7),
			),
		];
		const result = calculateStreaks(weeks);
		expect(result.current).toBe(7);
		expect(result.longest).toBe(7);
	});

	it("current streak is zero when last day has zero contributions", () => {
		const weeks: ContributionWeek[] = [
			makeWeek(makeDay("2024-01-01", 5), makeDay("2024-01-02", 3), makeDay("2024-01-03", 0)),
		];
		const result = calculateStreaks(weeks);
		expect(result.current).toBe(0);
		expect(result.longest).toBe(2);
		expect(result.currentStart).toBeNull();
		expect(result.longestStart).toBe("2024-01-01");
		expect(result.longestEnd).toBe("2024-01-02");
	});

	it("tracks start/end dates correctly across multiple weeks", () => {
		const weeks: ContributionWeek[] = [
			makeWeek(makeDay("2024-01-06", 1), makeDay("2024-01-07", 2)),
			makeWeek(makeDay("2024-01-08", 3), makeDay("2024-01-09", 0)),
		];
		const result = calculateStreaks(weeks);
		expect(result.longest).toBe(3);
		expect(result.longestStart).toBe("2024-01-06");
		expect(result.longestEnd).toBe("2024-01-08");
		expect(result.current).toBe(0);
	});

	it("updates longest when current surpasses it", () => {
		const weeks: ContributionWeek[] = [
			makeWeek(makeDay("2024-01-01", 1), makeDay("2024-01-02", 0)),
			makeWeek(makeDay("2024-01-03", 1), makeDay("2024-01-04", 1), makeDay("2024-01-05", 1)),
		];
		const result = calculateStreaks(weeks);
		expect(result.longest).toBe(3);
		expect(result.current).toBe(3);
		expect(result.longestStart).toBe("2024-01-03");
		expect(result.longestEnd).toBe("2024-01-05");
	});
});
