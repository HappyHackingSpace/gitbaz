import {
	COMPONENT_WEIGHTS,
	HALF_POINTS,
	NO_REPO_REDISTRIBUTION,
	getTierForScore,
} from "../constants.js";
import type { ScoreBreakdown, ScoreComponent, ScoreResult, UserStats } from "../types.js";
import { detectBadges } from "./badges.js";
import { normalize } from "./normalize.js";

const toDate = (value: string | Date): Date => {
	const d = typeof value === "string" ? new Date(value) : value;
	return Number.isFinite(d.getTime()) ? d : new Date(0);
};

const yearsFromDate = (date: Date | string): number => {
	const now = new Date();
	return Math.max(0, (now.getTime() - toDate(date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
};

const buildComponent = (
	name: string,
	rawValue: number,
	normalizedValue: number,
	maxPoints: number,
): ScoreComponent => ({
	name,
	rawValue,
	normalizedValue,
	maxPoints,
	points: Math.round(normalizedValue * maxPoints * 100) / 100,
});

export const calculateScore = (stats: UserStats): ScoreResult => {
	const hasRepoContext = stats.repoPRsMerged !== undefined && stats.repoPRsTotal !== undefined;

	const globalWeight = hasRepoContext
		? COMPONENT_WEIGHTS.globalPRsMerged
		: COMPONENT_WEIGHTS.globalPRsMerged + NO_REPO_REDISTRIBUTION.globalPRsMerged;

	const commitsWeight = hasRepoContext
		? COMPONENT_WEIGHTS.commitsLastYear
		: COMPONENT_WEIGHTS.commitsLastYear + NO_REPO_REDISTRIBUTION.commitsLastYear;

	const mergeRateWeight = hasRepoContext
		? COMPONENT_WEIGHTS.mergeRate
		: COMPONENT_WEIGHTS.mergeRate + NO_REPO_REDISTRIBUTION.mergeRate;

	const mergeRate = stats.globalPRsTotal > 0 ? stats.globalPRsMerged / stats.globalPRsTotal : 0;

	const accountAgeYears = yearsFromDate(stats.accountCreatedAt);

	const components: ScoreComponent[] = [];

	if (hasRepoContext) {
		const repoPRsMerged = stats.repoPRsMerged ?? 0;
		components.push(
			buildComponent(
				"In-repo PRs",
				repoPRsMerged,
				normalize(repoPRsMerged, HALF_POINTS.repoPRsMerged),
				COMPONENT_WEIGHTS.repoPRsMerged,
			),
		);
	}

	const effectiveCommits = stats.automatedCommits ? 0 : stats.totalCommitsLastYear;

	components.push(
		buildComponent("Merge rate", mergeRate, mergeRate, mergeRateWeight),
		buildComponent(
			"Global PRs",
			stats.globalPRsMerged,
			normalize(stats.globalPRsMerged, HALF_POINTS.globalPRsMerged),
			globalWeight,
		),
		buildComponent(
			"Commits (yr)",
			effectiveCommits,
			normalize(effectiveCommits, HALF_POINTS.commitsLastYear),
			commitsWeight,
		),
		buildComponent(
			"Account age",
			accountAgeYears,
			normalize(accountAgeYears, HALF_POINTS.accountAgeYears),
			COMPONENT_WEIGHTS.accountAge,
		),
		buildComponent(
			"Followers",
			stats.followers,
			normalize(stats.followers, HALF_POINTS.followers),
			COMPONENT_WEIGHTS.followers,
		),
	);

	const rawTotal = Math.min(
		100,
		components.reduce((sum, c) => sum + c.points, 0),
	);
	const roundedTotal = Number.isFinite(rawTotal) ? Math.round(rawTotal * 100) / 100 : 0;

	const breakdown: ScoreBreakdown = { components, total: roundedTotal };
	const tier = getTierForScore(roundedTotal);
	const badges = detectBadges(stats);

	return {
		username: stats.username,
		score: roundedTotal,
		tier,
		breakdown,
		badges,
		organizations: stats.organizations,
		globalPRsTotal: stats.globalPRsTotal,
		repoPRsTotal: hasRepoContext ? stats.repoPRsTotal : undefined,
		computedAt: new Date().toISOString(),
	};
};
