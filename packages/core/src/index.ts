export type {
	AIConfidence,
	AIDetectionResult,
	AISignal,
	Badge,
	BadgeId,
	BusFactor,
	BusFactorRisk,
	CacheAdapter,
	CommitAuthorInfo,
	ContributionDay,
	ContributionRef,
	ContributionStreak,
	ContributionWeek,
	ContributorActivity,
	ContributorProfile,
	DiscussionContext,
	DiscussionSummary,
	EngagementLevel,
	FileSilo,
	GitBazClient,
	GitBazClientOptions,
	IssueContext,
	IssueState,
	IssueStateReason,
	IssueSummary,
	KnowledgeSiloResult,
	Organization,
	PRClassification,
	PullRequestContext,
	PullRequestState,
	PullRequestSummary,
	RepoContext,
	RepositoryContext,
	ReviewDecision,
	ScoreBreakdown,
	ScoreComponent,
	ScoreResult,
	ScorecardCheck,
	ScorecardResult,
	SiloRisk,
	SizeCategory,
	Tier,
	TierId,
	UserStats,
	VouchAction,
	VouchActionResult,
	VouchEntry,
	VouchLookupResult,
	VouchStatus,
} from "./types.js";

export {
	BADGE_DEFINITIONS,
	COMPONENT_WEIGHTS,
	DEFAULT_CACHE_TTL,
	HALF_POINTS,
	TIER_THRESHOLDS,
	VOUCH_CACHE_TTL,
} from "./constants.js";

export { calculateScore } from "./contributor/score.js";
export { detectBadges } from "./contributor/badges.js";
export { normalize } from "./contributor/normalize.js";
export type { BotConfidence, BotDetectionResult } from "./contributor/bot-detect.js";
export { detectBot } from "./contributor/bot-detect.js";
export type { AutomationResult } from "./contributor/automation-detect.js";
export { detectAutomation } from "./contributor/automation-detect.js";

export { summarizePullRequest } from "./context/pull-request.js";
export { summarizeIssue } from "./context/issue.js";
export { summarizeDiscussion } from "./context/discussion.js";
export { detectAIGenerated } from "./context/ai-detect.js";

export { analyzeKnowledgeSilos, computeBusFactor } from "./context/knowledge-silo.js";

export { calculateStreaks } from "./activity/streaks.js";

export { MemoryCacheAdapter } from "./cache/memory-adapter.js";

export { parseVouchFile, lookupVouchStatus } from "./vouch/parse.js";

export { createGitBazClient } from "./github/client.js";

export {
	AuthenticationError,
	BotAccountError,
	ContributionNotFoundError,
	GitBazError,
	RateLimitError,
	RepositoryNotFoundError,
	UserNotFoundError,
} from "./errors.js";
