import type { DiscussionContext, DiscussionSummary, EngagementLevel } from "../types.js";

const getEngagementLevel = (comments: number, reactions: number): EngagementLevel => {
	const score = comments + reactions;
	if (score <= 3) return "low";
	if (score <= 15) return "medium";
	return "high";
};

export const summarizeDiscussion = (ctx: DiscussionContext): DiscussionSummary => ({
	engagementLevel: getEngagementLevel(ctx.commentCount, ctx.reactionCount),
	isAnswered: ctx.isAnswered,
});
