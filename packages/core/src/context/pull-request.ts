import type { PullRequestContext, PullRequestSummary, SizeCategory } from "../types.js";

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

export const summarizePullRequest = (ctx: PullRequestContext): PullRequestSummary => {
	const sizeCategory = getSizeCategory(ctx.additions, ctx.deletions);

	const isStale =
		ctx.state === "OPEN" && Date.now() - new Date(ctx.createdAt).getTime() > STALE_THRESHOLD_MS;

	const timeToMergeLabel = ctx.timeToMergeMs !== null ? formatDuration(ctx.timeToMergeMs) : null;

	return { sizeCategory, isStale, timeToMergeLabel };
};
