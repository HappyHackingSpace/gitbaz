import { detectAutomation } from "../contributor/automation-detect.js";
import type {
	BusFactor,
	CommitAuthorInfo,
	ContributionRef,
	ContributionStreak,
	ContributorActivity,
	DiscussionContext,
	IssueContext,
	Organization,
	PullRequestContext,
	PullRequestState,
	RepoContext,
	RepositoryContext,
	ReviewDecision,
	ScorecardResult,
	UserStats,
} from "../types.js";

interface GraphQLUserResponse {
	user: {
		createdAt: string;
		followers: { totalCount: number };
		repositories: { totalCount: number };
		contributionsCollection: {
			totalCommitContributions: number;
			restrictedContributionsCount: number;
			contributionCalendar: {
				weeks: {
					contributionDays: {
						contributionCount: number;
					}[];
				}[];
			};
		};
		pullRequests: { totalCount: number };
		allPullRequests: { totalCount: number };
		organizations: {
			nodes: { login: string; name: string | null; avatarUrl: string }[];
		};
	};
}

interface RepoPRCounts {
	merged: number;
	total: number;
}

export const mapGraphQLToUserStats = (
	data: GraphQLUserResponse,
	username: string,
	repoPRs?: RepoPRCounts,
): UserStats => {
	const { user } = data;
	const contributions = user.contributionsCollection;

	const organizations: Organization[] = user.organizations.nodes.map((org) => ({
		login: org.login,
		name: org.name,
		avatarUrl: org.avatarUrl,
	}));

	const totalCommits =
		contributions.totalCommitContributions + contributions.restrictedContributionsCount;

	const dailyCounts = contributions.contributionCalendar.weeks.flatMap((w) =>
		w.contributionDays.map((d) => d.contributionCount),
	);

	const automation = detectAutomation(dailyCounts, totalCommits, user.allPullRequests.totalCount);

	return {
		username,
		accountCreatedAt: user.createdAt,
		followers: user.followers.totalCount,
		publicRepos: user.repositories.totalCount,
		totalCommitsLastYear: totalCommits,
		globalPRsMerged: user.pullRequests.totalCount,
		globalPRsTotal: user.allPullRequests.totalCount,
		organizations,
		...(repoPRs && {
			repoPRsMerged: repoPRs.merged,
			repoPRsTotal: repoPRs.total,
		}),
		...(automation.isAutomated && {
			automatedCommits: true,
			automationReason: automation.reason,
		}),
	};
};

// Pull Request mapper

export interface GraphQLPullRequestResponse {
	repository: {
		pullRequest: {
			title: string;
			state: string;
			author: { login: string; __typename?: string } | null;
			headRefName?: string;
			body?: string;
			createdAt: string;
			mergedAt: string | null;
			closedAt: string | null;
			isDraft: boolean;
			reviewDecision: string | null;
			additions: number;
			deletions: number;
			changedFiles: number;
			commits: {
				totalCount: number;
				nodes?: {
					commit: {
						messageHeadline: string;
						messageBody: string;
						author: { name: string; email: string };
					};
				}[];
			};
			reviews: { totalCount: number };
			comments: { totalCount: number };
			labels: { nodes: { name: string }[] };
			closingIssuesReferences: { totalCount: number };
			files?: { nodes: { path: string }[] };
		} | null;
	} | null;
}

export const mapGraphQLToPullRequestContext = (
	data: GraphQLPullRequestResponse,
	ref: ContributionRef,
): PullRequestContext | null => {
	const pr = data.repository?.pullRequest;
	if (!pr) return null;

	const timeToMergeMs = pr.mergedAt
		? new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()
		: null;

	const commitAuthors: CommitAuthorInfo[] | undefined = pr.commits.nodes?.map((n) => ({
		name: n.commit.author.name,
		email: n.commit.author.email,
		messageHeadline: n.commit.messageHeadline,
		messageBody: n.commit.messageBody,
	}));

	return {
		ref,
		title: pr.title,
		state: pr.state as PullRequestState,
		author: pr.author?.login ?? "ghost",
		createdAt: pr.createdAt,
		mergedAt: pr.mergedAt,
		closedAt: pr.closedAt,
		isDraft: pr.isDraft,
		reviewDecision: (pr.reviewDecision as ReviewDecision) ?? null,
		additions: pr.additions,
		deletions: pr.deletions,
		changedFiles: pr.changedFiles,
		commits: pr.commits.totalCount,
		reviewCount: pr.reviews.totalCount,
		commentCount: pr.comments.totalCount,
		labels: pr.labels.nodes.map((l) => l.name),
		linkedIssueCount: pr.closingIssuesReferences.totalCount,
		timeToMergeMs,
		fetchedAt: new Date().toISOString(),
		...(pr.author?.__typename && { authorTypename: pr.author.__typename }),
		...(pr.headRefName && { headRefName: pr.headRefName }),
		...(pr.body != null && { body: pr.body }),
		...(commitAuthors && { commitAuthors }),
		...(pr.files?.nodes && { filePaths: pr.files.nodes.map((f) => f.path) }),
	};
};

// Issue mapper

export interface GraphQLIssueResponse {
	repository: {
		issue: {
			title: string;
			state: string;
			stateReason: string | null;
			author: { login: string } | null;
			createdAt: string;
			closedAt: string | null;
			comments: { totalCount: number };
			labels: { nodes: { name: string }[] };
			timelineItems: { totalCount: number };
			reactions: { totalCount: number };
			participants: { totalCount: number };
		} | null;
	} | null;
}

export const mapGraphQLToIssueContext = (
	data: GraphQLIssueResponse,
	ref: ContributionRef,
): IssueContext | null => {
	const issue = data.repository?.issue;
	if (!issue) return null;

	return {
		ref,
		title: issue.title,
		state: issue.state as "OPEN" | "CLOSED",
		stateReason: (issue.stateReason as "COMPLETED" | "NOT_PLANNED" | "REOPENED") ?? null,
		author: issue.author?.login ?? "ghost",
		createdAt: issue.createdAt,
		closedAt: issue.closedAt,
		commentCount: issue.comments.totalCount,
		labels: issue.labels.nodes.map((l) => l.name),
		linkedPRCount: issue.timelineItems.totalCount,
		reactionCount: issue.reactions.totalCount,
		participantCount: issue.participants.totalCount,
		fetchedAt: new Date().toISOString(),
	};
};

// Discussion mapper

export interface GraphQLDiscussionResponse {
	repository: {
		discussion: {
			title: string;
			closed: boolean;
			author: { login: string } | null;
			createdAt: string;
			closedAt: string | null;
			category: { name: string };
			isAnswered: boolean;
			comments: { totalCount: number };
			reactions: { totalCount: number };
			upvoteCount: number;
			labels: { nodes: { name: string }[] };
		} | null;
	} | null;
}

export const mapGraphQLToDiscussionContext = (
	data: GraphQLDiscussionResponse,
	ref: ContributionRef,
): DiscussionContext | null => {
	const disc = data.repository?.discussion;
	if (!disc) return null;

	return {
		ref,
		title: disc.title,
		isOpen: !disc.closed,
		author: disc.author?.login ?? "ghost",
		createdAt: disc.createdAt,
		closedAt: disc.closedAt,
		category: disc.category.name,
		isAnswered: disc.isAnswered,
		commentCount: disc.comments.totalCount,
		reactionCount: disc.reactions.totalCount,
		upvoteCount: disc.upvoteCount,
		labels: disc.labels.nodes.map((l) => l.name),
		fetchedAt: new Date().toISOString(),
	};
};

// Activity mapper

export interface GraphQLActivityResponse {
	user: {
		contributionsCollection: {
			contributionCalendar: {
				totalContributions: number;
				weeks: {
					contributionDays: {
						date: string;
						contributionCount: number;
						contributionLevel: string;
					}[];
				}[];
			};
		};
	};
}

const LEVEL_MAP: Record<string, 0 | 1 | 2 | 3 | 4> = {
	NONE: 0,
	FIRST_QUARTILE: 1,
	SECOND_QUARTILE: 2,
	THIRD_QUARTILE: 3,
	FOURTH_QUARTILE: 4,
};

export const contributionLevelToNumber = (level: string): 0 | 1 | 2 | 3 | 4 =>
	LEVEL_MAP[level] ?? 0;

// Repository mapper

export interface GraphQLRepositoryResponse {
	repository: {
		description: string | null;
		url: string;
		stargazerCount: number;
		forkCount: number;
		watchers: { totalCount: number };
		issues: { totalCount: number };
		pullRequests: { totalCount: number };
		primaryLanguage: { name: string } | null;
		licenseInfo: { spdxId: string } | null;
		isArchived: boolean;
		isFork: boolean;
		createdAt: string;
		pushedAt: string | null;
		defaultBranchRef: {
			target: {
				history: { totalCount: number };
			};
		} | null;
	} | null;
}

// Blame mapper

export interface GraphQLBlameRange {
	commit: { author: { user: { login: string } | null } };
	startingLine: number;
	endingLine: number;
}

export interface GraphQLBlameResponse {
	repository: {
		ref: Record<string, { ranges: GraphQLBlameRange[] } | undefined> | null;
	} | null;
}

export const mapBlameResponse = (
	data: GraphQLBlameResponse,
	filePaths: readonly string[],
): Map<string, string[]> => {
	const result = new Map<string, string[]>();
	const ref = data.repository?.ref;
	if (!ref) return result;

	for (let i = 0; i < filePaths.length; i++) {
		const blame = ref[`file${i}`];
		if (!blame) continue;

		const authorSet = new Set<string>();
		for (const range of blame.ranges) {
			const login = range.commit.author.user?.login;
			if (login) authorSet.add(login);
		}
		result.set(filePaths[i], [...authorSet]);
	}

	return result;
};

export const mapGraphQLToRepositoryContext = (
	data: GraphQLRepositoryResponse,
	repo: RepoContext,
	scorecard: ScorecardResult | null,
	busFactor?: BusFactor | null,
): RepositoryContext | null => {
	const r = data.repository;
	if (!r) return null;

	return {
		owner: repo.owner,
		repo: repo.repo,
		description: r.description,
		url: r.url,
		stars: r.stargazerCount,
		forks: r.forkCount,
		watchers: r.watchers.totalCount,
		openIssues: r.issues.totalCount,
		openPRs: r.pullRequests.totalCount,
		language: r.primaryLanguage?.name ?? null,
		license: r.licenseInfo?.spdxId ?? null,
		isArchived: r.isArchived,
		isFork: r.isFork,
		createdAt: r.createdAt,
		pushedAt: r.pushedAt,
		defaultBranchCommits: r.defaultBranchRef?.target.history.totalCount ?? 0,
		scorecard,
		busFactor: busFactor ?? null,
		fetchedAt: new Date().toISOString(),
	};
};

// Activity mapper

export const mapGraphQLToActivity = (
	data: GraphQLActivityResponse,
	username: string,
	streak: ContributionStreak,
): ContributorActivity => {
	const calendar = data.user.contributionsCollection.contributionCalendar;

	return {
		username,
		totalContributions: calendar.totalContributions,
		weeks: calendar.weeks.map((w) => ({
			days: w.contributionDays.map((d) => ({
				date: d.date,
				count: d.contributionCount,
				level: contributionLevelToNumber(d.contributionLevel),
			})),
		})),
		streak,
		fetchedAt: new Date().toISOString(),
	};
};
