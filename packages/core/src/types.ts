export type TierId = "newcomer" | "regular" | "contributor" | "trusted" | "maintainer";

export interface Tier {
	readonly id: TierId;
	readonly label: string;
	readonly minScore: number;
	readonly maxScore: number;
}

export type BadgeId =
	| "first-time-contributor"
	| "issue-only"
	| "high-merge-rate"
	| "prolific"
	| "veteran"
	| "popular"
	| "new-account"
	| "bot-account"
	| "automated-activity";

export interface Badge {
	readonly id: BadgeId;
	readonly label: string;
	readonly description: string;
}

export interface RepoContext {
	readonly owner: string;
	readonly repo: string;
}

export interface ContributionRef {
	readonly owner: string;
	readonly repo: string;
	readonly number: number;
}

// Pull Request types
export type PullRequestState = "OPEN" | "CLOSED" | "MERGED";
export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;

export interface CommitAuthorInfo {
	readonly name: string;
	readonly email: string;
	readonly messageHeadline: string;
	readonly messageBody: string;
}

export type AIConfidence = "definitive" | "high" | "low" | "none";

export interface AISignal {
	readonly tier: 1 | 2 | 3;
	readonly tool: string;
	readonly reason: string;
}

export interface AIDetectionResult {
	readonly isAIGenerated: boolean;
	readonly confidence: AIConfidence;
	readonly signals: readonly AISignal[];
	readonly tools: readonly string[];
}

export interface PullRequestContext {
	readonly ref: ContributionRef;
	readonly title: string;
	readonly state: PullRequestState;
	readonly author: string;
	readonly createdAt: string;
	readonly mergedAt: string | null;
	readonly closedAt: string | null;
	readonly isDraft: boolean;
	readonly reviewDecision: ReviewDecision;
	readonly additions: number;
	readonly deletions: number;
	readonly changedFiles: number;
	readonly commits: number;
	readonly reviewCount: number;
	readonly commentCount: number;
	readonly labels: readonly string[];
	readonly linkedIssueCount: number;
	readonly timeToMergeMs: number | null;
	readonly fetchedAt: string;
	readonly authorTypename?: string;
	readonly headRefName?: string;
	readonly body?: string;
	readonly commitAuthors?: readonly CommitAuthorInfo[];
}

// Issue types
export type IssueState = "OPEN" | "CLOSED";
export type IssueStateReason = "COMPLETED" | "NOT_PLANNED" | "REOPENED" | null;

export interface IssueContext {
	readonly ref: ContributionRef;
	readonly title: string;
	readonly state: IssueState;
	readonly stateReason: IssueStateReason;
	readonly author: string;
	readonly createdAt: string;
	readonly closedAt: string | null;
	readonly commentCount: number;
	readonly labels: readonly string[];
	readonly linkedPRCount: number;
	readonly reactionCount: number;
	readonly participantCount: number;
	readonly fetchedAt: string;
}

// Discussion types
export interface DiscussionContext {
	readonly ref: ContributionRef;
	readonly title: string;
	readonly isOpen: boolean;
	readonly author: string;
	readonly createdAt: string;
	readonly closedAt: string | null;
	readonly category: string;
	readonly isAnswered: boolean;
	readonly commentCount: number;
	readonly reactionCount: number;
	readonly upvoteCount: number;
	readonly labels: readonly string[];
	readonly fetchedAt: string;
}

export interface Organization {
	readonly login: string;
	readonly name: string | null;
	readonly avatarUrl: string;
}

export interface UserStats {
	readonly username: string;
	readonly accountCreatedAt: string;
	readonly followers: number;
	readonly publicRepos: number;
	readonly totalCommitsLastYear: number;
	readonly globalPRsMerged: number;
	readonly globalPRsTotal: number;
	readonly repoPRsMerged?: number;
	readonly repoPRsTotal?: number;
	readonly organizations: readonly Organization[];
	readonly automatedCommits?: boolean;
	readonly automationReason?: string;
}

export interface ScoreComponent {
	readonly name: string;
	readonly rawValue: number;
	readonly normalizedValue: number;
	readonly maxPoints: number;
	readonly points: number;
}

export interface ScoreBreakdown {
	readonly components: readonly ScoreComponent[];
	readonly total: number;
}

export interface ScoreResult {
	readonly username: string;
	readonly score: number;
	readonly tier: Tier;
	readonly breakdown: ScoreBreakdown;
	readonly badges: readonly Badge[];
	readonly organizations: readonly Organization[];
	readonly repoContext?: RepoContext;
	readonly globalPRsTotal: number;
	readonly repoPRsTotal?: number;
	readonly computedAt: string;
}

export interface ContributorProfile {
	readonly stats: UserStats;
	readonly score: ScoreResult;
}

export interface CacheAdapter {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, value: T, ttlMs: number): Promise<void>;
	delete(key: string): Promise<boolean>;
	clear(): Promise<void>;
	size(): Promise<number>;
}

// Summary types for context domain
export type SizeCategory = "xs" | "s" | "m" | "l" | "xl";
export type EngagementLevel = "low" | "medium" | "high";

export interface PullRequestSummary {
	readonly sizeCategory: SizeCategory;
	readonly isStale: boolean;
	readonly timeToMergeLabel: string | null;
}

export interface IssueSummary {
	readonly hasLinkedPRs: boolean;
	readonly engagementLevel: EngagementLevel;
	readonly resolutionLabel: string | null;
}

export interface DiscussionSummary {
	readonly engagementLevel: EngagementLevel;
	readonly isAnswered: boolean;
}

export type VouchStatus = "vouched" | "denounced" | "none";

export interface VouchEntry {
	readonly platform: string | null;
	readonly username: string;
	readonly isDenounced: boolean;
	readonly reason: string | null;
}

export interface VouchLookupResult {
	readonly status: VouchStatus;
	readonly reason: string | null;
	readonly hasVouchFile: boolean;
}

export type VouchAction = "vouch" | "denounce" | "unvouch";

export interface VouchActionResult {
	readonly success: boolean;
	readonly commentUrl: string | null;
	readonly error: string | null;
}

// Activity types
export interface ContributionDay {
	readonly date: string;
	readonly count: number;
	readonly level: 0 | 1 | 2 | 3 | 4;
}

export interface ContributionWeek {
	readonly days: readonly ContributionDay[];
}

export interface ContributionStreak {
	readonly current: number;
	readonly longest: number;
	readonly currentStart: string | null;
	readonly longestStart: string | null;
	readonly longestEnd: string | null;
}

export interface ContributorActivity {
	readonly username: string;
	readonly totalContributions: number;
	readonly weeks: readonly ContributionWeek[];
	readonly streak: ContributionStreak;
	readonly fetchedAt: string;
}

// Repository types
export interface RepositoryContext {
	readonly owner: string;
	readonly repo: string;
	readonly description: string | null;
	readonly url: string;
	readonly stars: number;
	readonly forks: number;
	readonly watchers: number;
	readonly openIssues: number;
	readonly openPRs: number;
	readonly language: string | null;
	readonly license: string | null;
	readonly isArchived: boolean;
	readonly isFork: boolean;
	readonly createdAt: string;
	readonly pushedAt: string | null;
	readonly defaultBranchCommits: number;
	readonly scorecard: ScorecardResult | null;
	readonly fetchedAt: string;
}

export interface ScorecardResult {
	readonly score: number;
	readonly date: string;
	readonly checks: readonly ScorecardCheck[];
}

export interface ScorecardCheck {
	readonly name: string;
	readonly score: number;
	readonly reason: string;
}

export interface GitBazClientOptions {
	readonly token?: string;
	readonly cache?: CacheAdapter;
	readonly cacheTtlMs?: number;
}

export interface GitBazClient {
	getScore(username: string, repo?: RepoContext): Promise<ScoreResult>;
	getStats(username: string, repo?: RepoContext): Promise<UserStats>;
	getProfile(username: string, repo?: RepoContext): Promise<ContributorProfile>;
	getActivity(username: string): Promise<ContributorActivity>;
	getPullRequest(ref: ContributionRef): Promise<PullRequestContext>;
	getIssue(ref: ContributionRef): Promise<IssueContext>;
	getDiscussion(ref: ContributionRef): Promise<DiscussionContext>;
	getRepositoryContext(repo: RepoContext): Promise<RepositoryContext>;
	getVouchStatus(username: string, repo: RepoContext): Promise<VouchLookupResult>;
	isCollaborator(repo: RepoContext): Promise<boolean>;
	postVouchAction(
		repo: RepoContext,
		issueNumber: number,
		action: VouchAction,
		targetUsername: string,
		reason?: string,
	): Promise<VouchActionResult>;
}
