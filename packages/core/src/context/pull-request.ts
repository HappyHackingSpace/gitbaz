import type {
	PRClassification,
	PullRequestContext,
	PullRequestSummary,
	SizeCategory,
} from "../types.js";

const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const getSizeCategory = (additions: number, deletions: number): SizeCategory => {
	const changed = additions + deletions;
	if (changed <= 10) return "xs";
	if (changed <= 50) return "s";
	if (changed <= 250) return "m";
	if (changed <= 1000) return "l";
	return "xl";
};

const formatDuration = (ms: number): string => {
	const minutes = Math.floor(ms / (1000 * 60));
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;

	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"}`;
};

const REVIEW_MINUTES_PER_LINE = 0.1;
const REVIEW_MINUTES_BASE = 5;
const REVIEW_MINUTES_MAX = 120;

const estimateReviewMinutes = (additions: number, deletions: number): number => {
	const lines = additions + deletions;
	const raw = REVIEW_MINUTES_BASE + lines * REVIEW_MINUTES_PER_LINE;
	return Math.min(Math.round(raw), REVIEW_MINUTES_MAX);
};

const classifyPR = (ctx: PullRequestContext): PRClassification => {
	const title = ctx.title.toLowerCase();
	const labels = ctx.labels.map((l) => l.toLowerCase());
	const branch = ctx.headRefName?.toLowerCase() ?? "";

	const patterns: [PRClassification, RegExp[]][] = [
		["docs", [/\bdocs?\b/, /\bdocumentation\b/, /\breadme\b/]],
		["test", [/\btests?\b/, /\bspec\b/, /\bcoverage\b/]],
		["bugfix", [/\bfix\b/, /\bbug\b/, /\bhotfix\b/, /\bpatch\b/]],
		["dependency", [/\bdep(s|endenc)/, /\bbump\b/, /\brenovate\b/, /\bdependabot\b/]],
		["refactor", [/\brefactor\b/, /\bcleanup\b/, /\brename\b/]],
		["chore", [/\bchore\b/, /\bci\b/, /\bbuild\b/, /\bconfig\b/]],
		["feature", [/\bfeature?\b/, /\bfeat\b/, /\badd\b/, /\bnew\b/, /\bimplement\b/]],
	];

	const text = `${title} ${labels.join(" ")} ${branch}`;

	for (const [classification, regexes] of patterns) {
		if (regexes.some((r) => r.test(text))) return classification;
	}

	return "mixed";
};

export const summarizePullRequest = (ctx: PullRequestContext): PullRequestSummary => {
	const sizeCategory = getSizeCategory(ctx.additions, ctx.deletions);

	const isStale =
		ctx.state === "OPEN" && Date.now() - new Date(ctx.createdAt).getTime() > STALE_THRESHOLD_MS;

	const timeToMergeLabel = ctx.timeToMergeMs !== null ? formatDuration(ctx.timeToMergeMs) : null;

	const estimatedReviewMinutes = estimateReviewMinutes(ctx.additions, ctx.deletions);
	const classification = classifyPR(ctx);

	return { sizeCategory, isStale, timeToMergeLabel, estimatedReviewMinutes, classification };
};
