import type { Badge, BadgeId, Tier, TierId } from "./types.js";

export const COMPONENT_WEIGHTS = {
	repoPRsMerged: 25,
	mergeRate: 20,
	globalPRsMerged: 20,
	commitsLastYear: 15,
	accountAge: 10,
	followers: 10,
} as const;

/** When no repo context, redistribute repo PR points to other components */
export const NO_REPO_REDISTRIBUTION = {
	globalPRsMerged: 10,
	commitsLastYear: 10,
	mergeRate: 5,
} as const;

/** Raw value at which a component reaches ~50% of its max points */
export const HALF_POINTS = {
	repoPRsMerged: 5,
	globalPRsMerged: 50,
	commitsLastYear: 200,
	accountAgeYears: 3,
	followers: 50,
} as const;

export const TIER_THRESHOLDS: readonly Tier[] = [
	{ id: "newcomer", label: "Newcomer", minScore: 0, maxScore: 15 },
	{ id: "regular", label: "Regular", minScore: 16, maxScore: 35 },
	{ id: "contributor", label: "Contributor", minScore: 36, maxScore: 60 },
	{ id: "trusted", label: "Trusted", minScore: 61, maxScore: 80 },
	{ id: "maintainer", label: "Maintainer", minScore: 81, maxScore: 100 },
] as const;

export const BADGE_DEFINITIONS: Readonly<Record<BadgeId, Badge>> = {
	"first-time-contributor": {
		id: "first-time-contributor",
		label: "First-Timer",
		description: "Making their first contribution to this repo",
	},
	"issue-only": {
		id: "issue-only",
		label: "Issue Reporter",
		description: "Contributes through issues rather than PRs",
	},
	"high-merge-rate": {
		id: "high-merge-rate",
		label: "Sharp Eye",
		description: "Merge rate above 80%",
	},
	prolific: {
		id: "prolific",
		label: "Prolific",
		description: "Over 100 merged PRs globally",
	},
	veteran: {
		id: "veteran",
		label: "Veteran",
		description: "Account older than 5 years",
	},
	popular: {
		id: "popular",
		label: "Popular",
		description: "Over 100 followers",
	},
	"new-account": {
		id: "new-account",
		label: "New Account",
		description: "Account created within the last 90 days",
	},
	"bot-account": {
		id: "bot-account",
		label: "Bot Account",
		description: "Automated account (not a human contributor)",
	},
	"automated-activity": {
		id: "automated-activity",
		label: "Automated Activity",
		description: "Commit pattern suggests CI/CD automation",
	},
} as const;

export const DEFAULT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
export const VOUCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes — vouch files change when commands are issued

export function getTierForScore(score: number): Tier {
	const clamped = Math.max(0, Math.min(100, Math.round(score)));
	const tier = TIER_THRESHOLDS.find((t) => clamped >= t.minScore && clamped <= t.maxScore);
	return tier ?? TIER_THRESHOLDS[0];
}
