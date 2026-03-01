import type { ContributionStreak, ContributionWeek } from "../types.js";

export const calculateStreaks = (weeks: readonly ContributionWeek[]): ContributionStreak => {
	const days = weeks.flatMap((w) => w.days);

	if (days.length === 0) {
		return { current: 0, longest: 0, currentStart: null, longestStart: null, longestEnd: null };
	}

	let current = 0;
	let currentStart: string | null = null;
	let longest = 0;
	let longestStart: string | null = null;
	let longestEnd: string | null = null;

	let runLength = 0;
	let runStart: string | null = null;

	for (const day of days) {
		if (day.count > 0) {
			if (runLength === 0) {
				runStart = day.date;
			}
			runLength++;

			if (runLength > longest) {
				longest = runLength;
				longestStart = runStart;
				longestEnd = day.date;
			}
		} else {
			runLength = 0;
			runStart = null;
		}
	}

	// Current streak: the run that includes the last day (or the day before if last day is today with 0)
	// Walk backwards from the end to find current streak
	current = 0;
	currentStart = null;
	for (let i = days.length - 1; i >= 0; i--) {
		if (days[i].count > 0) {
			current++;
			currentStart = days[i].date;
		} else {
			break;
		}
	}

	return { current, longest, currentStart, longestStart, longestEnd };
};
