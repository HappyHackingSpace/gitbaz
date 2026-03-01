import { describe, expect, it } from "vitest";
import {
	type GraphQLDiscussionResponse,
	type GraphQLIssueResponse,
	type GraphQLPullRequestResponse,
	type GraphQLRepositoryResponse,
	mapGraphQLToDiscussionContext,
	mapGraphQLToIssueContext,
	mapGraphQLToPullRequestContext,
	mapGraphQLToRepositoryContext,
	mapGraphQLToUserStats,
} from "../../src/github/mappers.js";

const mockGraphQLResponse = {
	user: {
		createdAt: "2018-06-15T10:00:00Z",
		followers: { totalCount: 42 },
		repositories: { totalCount: 15 },
		contributionsCollection: {
			totalCommitContributions: 300,
			restrictedContributionsCount: 50,
			contributionCalendar: {
				weeks: Array.from({ length: 52 }, () => ({
					contributionDays: Array.from({ length: 7 }, (_, i) => ({
						contributionCount: i < 5 ? Math.floor(Math.random() * 5) : 0,
					})),
				})),
			},
		},
		pullRequests: { totalCount: 80 },
		allPullRequests: { totalCount: 100 },
		organizations: {
			nodes: [
				{
					login: "google",
					name: "Google",
					avatarUrl: "https://avatars.githubusercontent.com/u/1342004",
				},
				{
					login: "kubernetes",
					name: null,
					avatarUrl: "https://avatars.githubusercontent.com/u/13629408",
				},
			],
		},
	},
};

describe("mapGraphQLToUserStats", () => {
	it("maps basic user data correctly", () => {
		const stats = mapGraphQLToUserStats(mockGraphQLResponse, "octocat");

		expect(stats.username).toBe("octocat");
		expect(stats.accountCreatedAt).toBe("2018-06-15T10:00:00Z");
		expect(stats.followers).toBe(42);
		expect(stats.publicRepos).toBe(15);
	});

	it("combines commit contributions including restricted", () => {
		const stats = mapGraphQLToUserStats(mockGraphQLResponse, "octocat");
		expect(stats.totalCommitsLastYear).toBe(350);
	});

	it("maps global PR counts", () => {
		const stats = mapGraphQLToUserStats(mockGraphQLResponse, "octocat");
		expect(stats.globalPRsMerged).toBe(80);
		expect(stats.globalPRsTotal).toBe(100);
	});

	it("includes repo PR counts when provided", () => {
		const stats = mapGraphQLToUserStats(mockGraphQLResponse, "octocat", {
			merged: 5,
			total: 8,
		});
		expect(stats.repoPRsMerged).toBe(5);
		expect(stats.repoPRsTotal).toBe(8);
	});

	it("omits repo PR counts when not provided", () => {
		const stats = mapGraphQLToUserStats(mockGraphQLResponse, "octocat");
		expect(stats.repoPRsMerged).toBeUndefined();
		expect(stats.repoPRsTotal).toBeUndefined();
	});

	it("maps organizations correctly", () => {
		const stats = mapGraphQLToUserStats(mockGraphQLResponse, "octocat");
		expect(stats.organizations).toEqual([
			{
				login: "google",
				name: "Google",
				avatarUrl: "https://avatars.githubusercontent.com/u/1342004",
			},
			{
				login: "kubernetes",
				name: null,
				avatarUrl: "https://avatars.githubusercontent.com/u/13629408",
			},
		]);
	});

	it("returns empty organizations when user has none", () => {
		const response = {
			...mockGraphQLResponse,
			user: {
				...mockGraphQLResponse.user,
				organizations: { nodes: [] },
			},
		};
		const stats = mapGraphQLToUserStats(response, "octocat");
		expect(stats.organizations).toEqual([]);
	});
});

// Pull Request mapper tests

const mockPRResponse: GraphQLPullRequestResponse = {
	repository: {
		pullRequest: {
			title: "Fix bug in parser",
			state: "MERGED",
			author: { login: "octocat" },
			createdAt: "2024-01-10T10:00:00Z",
			mergedAt: "2024-01-12T14:00:00Z",
			closedAt: "2024-01-12T14:00:00Z",
			isDraft: false,
			reviewDecision: "APPROVED",
			additions: 42,
			deletions: 10,
			changedFiles: 3,
			commits: { totalCount: 2 },
			reviews: { totalCount: 3 },
			comments: { totalCount: 5 },
			labels: { nodes: [{ name: "bug" }, { name: "priority" }] },
			closingIssuesReferences: { totalCount: 1 },
		},
	},
};

const prRef = { owner: "org", repo: "project", number: 42 };

describe("mapGraphQLToPullRequestContext", () => {
	it("maps basic PR data correctly", () => {
		const ctx = mapGraphQLToPullRequestContext(mockPRResponse, prRef);

		expect(ctx).not.toBeNull();
		expect(ctx?.title).toBe("Fix bug in parser");
		expect(ctx?.state).toBe("MERGED");
		expect(ctx?.author).toBe("octocat");
		expect(ctx?.isDraft).toBe(false);
		expect(ctx?.reviewDecision).toBe("APPROVED");
	});

	it("maps numeric fields correctly", () => {
		const ctx = mapGraphQLToPullRequestContext(mockPRResponse, prRef);

		expect(ctx?.additions).toBe(42);
		expect(ctx?.deletions).toBe(10);
		expect(ctx?.changedFiles).toBe(3);
		expect(ctx?.commits).toBe(2);
		expect(ctx?.reviewCount).toBe(3);
		expect(ctx?.commentCount).toBe(5);
		expect(ctx?.linkedIssueCount).toBe(1);
	});

	it("maps labels correctly", () => {
		const ctx = mapGraphQLToPullRequestContext(mockPRResponse, prRef);
		expect(ctx?.labels).toEqual(["bug", "priority"]);
	});

	it("calculates timeToMergeMs for merged PRs", () => {
		const ctx = mapGraphQLToPullRequestContext(mockPRResponse, prRef);
		const expected =
			new Date("2024-01-12T14:00:00Z").getTime() - new Date("2024-01-10T10:00:00Z").getTime();
		expect(ctx?.timeToMergeMs).toBe(expected);
	});

	it("returns null when PR is not found", () => {
		const ctx = mapGraphQLToPullRequestContext({ repository: { pullRequest: null } }, prRef);
		expect(ctx).toBeNull();
	});

	it("handles null author as ghost", () => {
		const response: GraphQLPullRequestResponse = {
			repository: {
				pullRequest: { ...mockPRResponse.repository!.pullRequest!, author: null },
			},
		};
		const ctx = mapGraphQLToPullRequestContext(response, prRef);
		expect(ctx?.author).toBe("ghost");
	});

	it("preserves the ref", () => {
		const ctx = mapGraphQLToPullRequestContext(mockPRResponse, prRef);
		expect(ctx?.ref).toEqual(prRef);
	});

	it("maps authorTypename when present", () => {
		const response: GraphQLPullRequestResponse = {
			repository: {
				pullRequest: {
					...mockPRResponse.repository!.pullRequest!,
					author: { login: "copilot-bot", __typename: "Bot" },
				},
			},
		};
		const ctx = mapGraphQLToPullRequestContext(response, prRef);
		expect(ctx?.authorTypename).toBe("Bot");
	});

	it("omits authorTypename when __typename not present", () => {
		const ctx = mapGraphQLToPullRequestContext(mockPRResponse, prRef);
		expect(ctx?.authorTypename).toBeUndefined();
	});

	it("maps headRefName when present", () => {
		const response: GraphQLPullRequestResponse = {
			repository: {
				pullRequest: {
					...mockPRResponse.repository!.pullRequest!,
					headRefName: "feature/cool-stuff",
				},
			},
		};
		const ctx = mapGraphQLToPullRequestContext(response, prRef);
		expect(ctx?.headRefName).toBe("feature/cool-stuff");
	});

	it("maps body when present", () => {
		const response: GraphQLPullRequestResponse = {
			repository: {
				pullRequest: {
					...mockPRResponse.repository!.pullRequest!,
					body: "This fixes the parser bug.",
				},
			},
		};
		const ctx = mapGraphQLToPullRequestContext(response, prRef);
		expect(ctx?.body).toBe("This fixes the parser bug.");
	});

	it("maps empty body as empty string", () => {
		const response: GraphQLPullRequestResponse = {
			repository: {
				pullRequest: {
					...mockPRResponse.repository!.pullRequest!,
					body: "",
				},
			},
		};
		const ctx = mapGraphQLToPullRequestContext(response, prRef);
		expect(ctx?.body).toBe("");
	});

	it("maps commitAuthors from commit nodes", () => {
		const response: GraphQLPullRequestResponse = {
			repository: {
				pullRequest: {
					...mockPRResponse.repository!.pullRequest!,
					commits: {
						totalCount: 1,
						nodes: [
							{
								commit: {
									messageHeadline: "fix: parser",
									messageBody: "Co-authored-by: Claude <noreply@anthropic.com>",
									author: { name: "Dev User", email: "dev@example.com" },
								},
							},
						],
					},
				},
			},
		};
		const ctx = mapGraphQLToPullRequestContext(response, prRef);
		expect(ctx?.commitAuthors).toEqual([
			{
				name: "Dev User",
				email: "dev@example.com",
				messageHeadline: "fix: parser",
				messageBody: "Co-authored-by: Claude <noreply@anthropic.com>",
			},
		]);
	});

	it("omits commitAuthors when nodes not present (backward compat)", () => {
		const ctx = mapGraphQLToPullRequestContext(mockPRResponse, prRef);
		expect(ctx?.commitAuthors).toBeUndefined();
	});
});

// Issue mapper tests

const mockIssueResponse: GraphQLIssueResponse = {
	repository: {
		issue: {
			title: "Button does not work",
			state: "CLOSED",
			stateReason: "COMPLETED",
			author: { login: "reporter" },
			createdAt: "2024-02-01T08:00:00Z",
			closedAt: "2024-02-05T12:00:00Z",
			comments: { totalCount: 7 },
			labels: { nodes: [{ name: "bug" }] },
			timelineItems: { totalCount: 2 },
			reactions: { totalCount: 5 },
			participants: { totalCount: 4 },
		},
	},
};

const issueRef = { owner: "org", repo: "project", number: 99 };

describe("mapGraphQLToIssueContext", () => {
	it("maps basic issue data correctly", () => {
		const ctx = mapGraphQLToIssueContext(mockIssueResponse, issueRef);

		expect(ctx).not.toBeNull();
		expect(ctx?.title).toBe("Button does not work");
		expect(ctx?.state).toBe("CLOSED");
		expect(ctx?.stateReason).toBe("COMPLETED");
		expect(ctx?.author).toBe("reporter");
	});

	it("maps numeric fields correctly", () => {
		const ctx = mapGraphQLToIssueContext(mockIssueResponse, issueRef);

		expect(ctx?.commentCount).toBe(7);
		expect(ctx?.linkedPRCount).toBe(2);
		expect(ctx?.reactionCount).toBe(5);
		expect(ctx?.participantCount).toBe(4);
	});

	it("returns null when issue is not found", () => {
		const ctx = mapGraphQLToIssueContext({ repository: { issue: null } }, issueRef);
		expect(ctx).toBeNull();
	});

	it("handles null stateReason", () => {
		const response: GraphQLIssueResponse = {
			repository: {
				issue: { ...mockIssueResponse.repository!.issue!, stateReason: null },
			},
		};
		const ctx = mapGraphQLToIssueContext(response, issueRef);
		expect(ctx?.stateReason).toBeNull();
	});
});

// Discussion mapper tests

const mockDiscussionResponse: GraphQLDiscussionResponse = {
	repository: {
		discussion: {
			title: "How to deploy?",
			closed: false,
			author: { login: "asker" },
			createdAt: "2024-03-01T10:00:00Z",
			closedAt: null,
			category: { name: "Q&A" },
			isAnswered: true,
			comments: { totalCount: 3 },
			reactions: { totalCount: 10 },
			upvoteCount: 7,
			labels: { nodes: [{ name: "question" }] },
		},
	},
};

const discRef = { owner: "org", repo: "project", number: 55 };

describe("mapGraphQLToDiscussionContext", () => {
	it("maps basic discussion data correctly", () => {
		const ctx = mapGraphQLToDiscussionContext(mockDiscussionResponse, discRef);

		expect(ctx).not.toBeNull();
		expect(ctx?.title).toBe("How to deploy?");
		expect(ctx?.isOpen).toBe(true);
		expect(ctx?.author).toBe("asker");
		expect(ctx?.category).toBe("Q&A");
		expect(ctx?.isAnswered).toBe(true);
	});

	it("maps numeric fields correctly", () => {
		const ctx = mapGraphQLToDiscussionContext(mockDiscussionResponse, discRef);

		expect(ctx?.commentCount).toBe(3);
		expect(ctx?.reactionCount).toBe(10);
		expect(ctx?.upvoteCount).toBe(7);
	});

	it("returns null when discussion is not found", () => {
		const ctx = mapGraphQLToDiscussionContext({ repository: { discussion: null } }, discRef);
		expect(ctx).toBeNull();
	});

	it("maps closed discussion correctly", () => {
		const response: GraphQLDiscussionResponse = {
			repository: {
				discussion: {
					...mockDiscussionResponse.repository!.discussion!,
					closed: true,
					closedAt: "2024-03-05T10:00:00Z",
				},
			},
		};
		const ctx = mapGraphQLToDiscussionContext(response, discRef);
		expect(ctx?.isOpen).toBe(false);
		expect(ctx?.closedAt).toBe("2024-03-05T10:00:00Z");
	});
});

// Repository mapper tests

const mockRepoResponse: GraphQLRepositoryResponse = {
	repository: {
		description: "A cool project",
		url: "https://github.com/org/project",
		stargazerCount: 1234,
		forkCount: 567,
		watchers: { totalCount: 89 },
		issues: { totalCount: 42 },
		pullRequests: { totalCount: 12 },
		primaryLanguage: { name: "TypeScript" },
		licenseInfo: { spdxId: "MIT" },
		isArchived: false,
		isFork: false,
		createdAt: "2020-01-01T00:00:00Z",
		pushedAt: "2024-06-01T10:00:00Z",
		defaultBranchRef: {
			target: {
				history: { totalCount: 5678 },
			},
		},
	},
};

const repoCtx = { owner: "org", repo: "project" };

describe("mapGraphQLToRepositoryContext", () => {
	it("maps full repository data correctly", () => {
		const scorecard = {
			score: 7.6,
			date: "2024-06-01",
			checks: [{ name: "Maintained", score: 10, reason: "30 commits in 90 days" }],
		};
		const ctx = mapGraphQLToRepositoryContext(mockRepoResponse, repoCtx, scorecard);

		expect(ctx).not.toBeNull();
		expect(ctx?.owner).toBe("org");
		expect(ctx?.repo).toBe("project");
		expect(ctx?.description).toBe("A cool project");
		expect(ctx?.stars).toBe(1234);
		expect(ctx?.forks).toBe(567);
		expect(ctx?.watchers).toBe(89);
		expect(ctx?.openIssues).toBe(42);
		expect(ctx?.openPRs).toBe(12);
		expect(ctx?.language).toBe("TypeScript");
		expect(ctx?.license).toBe("MIT");
		expect(ctx?.isArchived).toBe(false);
		expect(ctx?.isFork).toBe(false);
		expect(ctx?.defaultBranchCommits).toBe(5678);
		expect(ctx?.scorecard).toEqual(scorecard);
		expect(ctx?.fetchedAt).toBeDefined();
	});

	it("handles null optional fields", () => {
		const response: GraphQLRepositoryResponse = {
			repository: {
				...mockRepoResponse.repository!,
				description: null,
				primaryLanguage: null,
				licenseInfo: null,
				pushedAt: null,
				defaultBranchRef: null,
			},
		};
		const ctx = mapGraphQLToRepositoryContext(response, repoCtx, null);

		expect(ctx).not.toBeNull();
		expect(ctx?.description).toBeNull();
		expect(ctx?.language).toBeNull();
		expect(ctx?.license).toBeNull();
		expect(ctx?.pushedAt).toBeNull();
		expect(ctx?.defaultBranchCommits).toBe(0);
		expect(ctx?.scorecard).toBeNull();
	});

	it("returns null when repository is not found", () => {
		const ctx = mapGraphQLToRepositoryContext({ repository: null }, repoCtx, null);
		expect(ctx).toBeNull();
	});
});
