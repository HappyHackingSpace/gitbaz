import type { EngagementLevel, IssueContext, IssueSummary } from "../types.js";

const getEngagementLevel = (comments: number, participants: number): EngagementLevel => {
	const score = comments + participants;
	if (score <= 3) return "low";
	if (score <= 15) return "medium";
	return "high";
};

const getResolutionLabel = (ctx: IssueContext): string | null => {
	if (ctx.state === "OPEN") return null;
	if (ctx.stateReason === "COMPLETED") return "Completed";
	if (ctx.stateReason === "NOT_PLANNED") return "Not planned";
	return null;
};

export const summarizeIssue = (ctx: IssueContext): IssueSummary => ({
	hasLinkedPRs: ctx.linkedPRCount > 0,
	engagementLevel: getEngagementLevel(ctx.commentCount, ctx.participantCount),
	resolutionLabel: getResolutionLabel(ctx),
});
