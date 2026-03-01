import { BADGE_DEFINITIONS } from "../constants.js";
import type { Badge, UserStats } from "../types.js";
import { detectBot } from "./bot-detect.js";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export const detectBadges = (stats: UserStats): Badge[] => {
	const badges: Badge[] = [];

	const botResult = detectBot(stats.username);
	if (botResult.isBot) {
		badges.push(BADGE_DEFINITIONS["bot-account"]);
	}

	const now = new Date();
	const createdAt = new Date(stats.accountCreatedAt);
	const accountAgeMs = now.getTime() - createdAt.getTime();

	if (stats.repoPRsMerged === 1) {
		badges.push(BADGE_DEFINITIONS["first-time-contributor"]);
	}

	if (stats.globalPRsTotal === 0 && stats.publicRepos === 0) {
		badges.push(BADGE_DEFINITIONS["issue-only"]);
	}

	const mergeRate = stats.globalPRsTotal > 0 ? stats.globalPRsMerged / stats.globalPRsTotal : 0;
	if (mergeRate > 0.8 && stats.globalPRsTotal >= 5) {
		badges.push(BADGE_DEFINITIONS["high-merge-rate"]);
	}

	if (stats.globalPRsMerged > 100) {
		badges.push(BADGE_DEFINITIONS.prolific);
	}

	if (accountAgeMs > FIVE_YEARS_MS) {
		badges.push(BADGE_DEFINITIONS.veteran);
	}

	if (stats.followers > 100) {
		badges.push(BADGE_DEFINITIONS.popular);
	}

	if (accountAgeMs < NINETY_DAYS_MS) {
		badges.push(BADGE_DEFINITIONS["new-account"]);
	}

	if (stats.automatedCommits) {
		badges.push(BADGE_DEFINITIONS["automated-activity"]);
	}

	return badges;
};
