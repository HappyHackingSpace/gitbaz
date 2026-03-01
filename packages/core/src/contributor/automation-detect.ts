export interface AutomationResult {
	readonly isAutomated: boolean;
	readonly reason: string;
}

/**
 * Detects automated commit patterns from contribution calendar data.
 *
 * Signals:
 * - Active >90% of days with low variance → bot-like consistency
 * - Weekend activity matches weekday activity → no human work pattern
 * - Very high commit count with few PRs → CI/CD automation
 */
export const detectAutomation = (
	dailyCounts: number[],
	totalCommits: number,
	totalPRs: number,
): AutomationResult => {
	if (dailyCounts.length === 0 || totalCommits < 100) {
		return { isAutomated: false, reason: "" };
	}

	const activeDays = dailyCounts.filter((c) => c > 0);
	const activeRatio = activeDays.length / dailyCounts.length;

	// Signal 1: commit-to-PR ratio — lots of commits but almost no PRs
	if (totalCommits > 500 && totalPRs < 5) {
		return {
			isAutomated: true,
			reason: `${totalCommits} commits but only ${totalPRs} PRs — likely CI/CD automation`,
		};
	}

	// Signal 2: active nearly every day — no human commits 365 days straight
	if (activeRatio > 0.95 && totalCommits > 500) {
		return {
			isAutomated: true,
			reason: `Active ${Math.round(activeRatio * 100)}% of days with ${totalCommits} commits — likely automated`,
		};
	}

	// Need enough active days to detect subtler patterns
	if (activeDays.length < 30) {
		return { isAutomated: false, reason: "" };
	}

	// Signal 3: low variance in daily counts — bots are consistent, humans aren't
	const mean = activeDays.reduce((a, b) => a + b, 0) / activeDays.length;
	const variance = activeDays.reduce((sum, c) => sum + (c - mean) ** 2, 0) / activeDays.length;
	const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

	if (activeRatio > 0.85 && cv < 0.3) {
		return {
			isAutomated: true,
			reason: `Active ${Math.round(activeRatio * 100)}% of days with very consistent counts (CV=${cv.toFixed(2)})`,
		};
	}

	return { isAutomated: false, reason: "" };
};
