import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCacheAdapter } from "../../src/cache/memory-adapter.js";
import {
	AuthenticationError,
	BotAccountError,
	ContributionNotFoundError,
	RepositoryNotFoundError,
	UserNotFoundError,
} from "../../src/errors.js";
import { createGitBazClient } from "../../src/github/client.js";

// Mock Octokit
vi.mock("@octokit/core", () => ({
	Octokit: vi.fn().mockImplementation(() => ({
		graphql: vi.fn(),
		request: vi.fn(),
	})),
}));

// Mock scorecard fetcher
vi.mock("../../src/github/scorecard.js", () => ({
	fetchScorecard: vi.fn().mockResolvedValue(null),
}));

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
						contributionCount: i < 5 ? 2 : 0,
					})),
				})),
			},
		},
		pullRequests: { totalCount: 80 },
		allPullRequests: { totalCount: 100 },
		organizations: { nodes: [] },
	},
};

describe("createGitBazClient", () => {
	let mockOctokit: { graphql: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		const { Octokit } = await import("@octokit/core");
		mockOctokit = {
			graphql: vi.fn().mockResolvedValue(mockGraphQLResponse),
			request: vi.fn().mockResolvedValue({ data: { total_count: 3 } }),
		};
		vi.mocked(Octokit).mockImplementation(() => mockOctokit as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches user stats without repo context", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const stats = await client.getStats("octocat");

		expect(stats.username).toBe("octocat");
		expect(stats.followers).toBe(42);
		expect(stats.repoPRsMerged).toBeUndefined();
		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
		expect(mockOctokit.request).not.toHaveBeenCalled();
	});

	it("fetches user stats with repo context", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const stats = await client.getStats("octocat", { owner: "org", repo: "project" });

		expect(stats.repoPRsMerged).toBe(3);
		expect(stats.repoPRsTotal).toBe(3);
		expect(mockOctokit.request).toHaveBeenCalledTimes(2);
	});

	it("returns a score result from getScore", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const score = await client.getScore("octocat");

		expect(score.username).toBe("octocat");
		expect(score.score).toBeGreaterThanOrEqual(0);
		expect(score.score).toBeLessThanOrEqual(100);
		expect(score.tier).toBeDefined();
	});

	it("returns a full profile from getProfile", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const profile = await client.getProfile("octocat");

		expect(profile.stats.username).toBe("octocat");
		expect(profile.score.username).toBe("octocat");
	});

	it("caches stats when cache adapter is provided", async () => {
		const cache = new MemoryCacheAdapter();
		const client = createGitBazClient({ token: "test-token", cache });

		await client.getStats("octocat");
		await client.getStats("octocat");

		// Only one API call since second should hit cache
		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
	});

	it("wraps 401 errors as AuthenticationError", async () => {
		mockOctokit.graphql.mockRejectedValueOnce(new Error("Bad credentials"));
		const client = createGitBazClient({ token: "bad-token" });

		await expect(client.getStats("octocat")).rejects.toThrow(AuthenticationError);
	});

	it("wraps 'could not resolve' errors as BotAccountError", async () => {
		mockOctokit.graphql.mockRejectedValueOnce(
			new Error("Could not resolve to a User with the login of 'ghost'"),
		);
		const client = createGitBazClient({ token: "test-token" });

		await expect(client.getStats("ghost")).rejects.toThrow(BotAccountError);
	});

	it("wraps 'not found' errors as UserNotFoundError", async () => {
		mockOctokit.graphql.mockRejectedValueOnce(new Error("Not Found"));
		const client = createGitBazClient({ token: "test-token" });

		await expect(client.getStats("ghost")).rejects.toThrow(UserNotFoundError);
	});
});

// Context method tests

const mockPRGraphQLResponse = {
	repository: {
		pullRequest: {
			title: "Fix parser",
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
			labels: { nodes: [{ name: "bug" }] },
			closingIssuesReferences: { totalCount: 1 },
		},
	},
};

const mockIssueGraphQLResponse = {
	repository: {
		issue: {
			title: "Bug report",
			state: "OPEN",
			stateReason: null,
			author: { login: "reporter" },
			createdAt: "2024-02-01T08:00:00Z",
			closedAt: null,
			comments: { totalCount: 3 },
			labels: { nodes: [{ name: "bug" }] },
			timelineItems: { totalCount: 1 },
			reactions: { totalCount: 2 },
			participants: { totalCount: 3 },
		},
	},
};

const mockDiscussionGraphQLResponse = {
	repository: {
		discussion: {
			title: "How to deploy?",
			closed: false,
			author: { login: "asker" },
			createdAt: "2024-03-01T10:00:00Z",
			closedAt: null,
			category: { name: "Q&A" },
			isAnswered: true,
			comments: { totalCount: 5 },
			reactions: { totalCount: 8 },
			upvoteCount: 4,
			labels: { nodes: [] },
		},
	},
};

describe("getPullRequest", () => {
	let mockOctokit: { graphql: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		const { Octokit } = await import("@octokit/core");
		mockOctokit = {
			graphql: vi.fn().mockResolvedValue(mockPRGraphQLResponse),
			request: vi.fn(),
		};
		vi.mocked(Octokit).mockImplementation(() => mockOctokit as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches and maps a pull request", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const pr = await client.getPullRequest({ owner: "org", repo: "project", number: 42 });

		expect(pr.title).toBe("Fix parser");
		expect(pr.state).toBe("MERGED");
		expect(pr.author).toBe("octocat");
		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
	});

	it("caches pull request results", async () => {
		const cache = new MemoryCacheAdapter();
		const client = createGitBazClient({ token: "test-token", cache });

		await client.getPullRequest({ owner: "org", repo: "project", number: 42 });
		await client.getPullRequest({ owner: "org", repo: "project", number: 42 });

		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
	});

	it("throws ContributionNotFoundError when PR is null", async () => {
		mockOctokit.graphql.mockResolvedValueOnce({
			repository: { pullRequest: null },
		});
		const client = createGitBazClient({ token: "test-token" });

		await expect(
			client.getPullRequest({ owner: "org", repo: "project", number: 999 }),
		).rejects.toThrow(ContributionNotFoundError);
	});
});

describe("getIssue", () => {
	let mockOctokit: { graphql: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		const { Octokit } = await import("@octokit/core");
		mockOctokit = {
			graphql: vi.fn().mockResolvedValue(mockIssueGraphQLResponse),
			request: vi.fn(),
		};
		vi.mocked(Octokit).mockImplementation(() => mockOctokit as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches and maps an issue", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const issue = await client.getIssue({ owner: "org", repo: "project", number: 99 });

		expect(issue.title).toBe("Bug report");
		expect(issue.state).toBe("OPEN");
		expect(issue.author).toBe("reporter");
	});

	it("caches issue results", async () => {
		const cache = new MemoryCacheAdapter();
		const client = createGitBazClient({ token: "test-token", cache });

		await client.getIssue({ owner: "org", repo: "project", number: 99 });
		await client.getIssue({ owner: "org", repo: "project", number: 99 });

		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
	});

	it("throws ContributionNotFoundError when issue is null", async () => {
		mockOctokit.graphql.mockResolvedValueOnce({
			repository: { issue: null },
		});
		const client = createGitBazClient({ token: "test-token" });

		await expect(client.getIssue({ owner: "org", repo: "project", number: 999 })).rejects.toThrow(
			ContributionNotFoundError,
		);
	});
});

describe("getDiscussion", () => {
	let mockOctokit: { graphql: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		const { Octokit } = await import("@octokit/core");
		mockOctokit = {
			graphql: vi.fn().mockResolvedValue(mockDiscussionGraphQLResponse),
			request: vi.fn(),
		};
		vi.mocked(Octokit).mockImplementation(() => mockOctokit as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches and maps a discussion", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const disc = await client.getDiscussion({ owner: "org", repo: "project", number: 55 });

		expect(disc.title).toBe("How to deploy?");
		expect(disc.isOpen).toBe(true);
		expect(disc.isAnswered).toBe(true);
	});

	it("caches discussion results", async () => {
		const cache = new MemoryCacheAdapter();
		const client = createGitBazClient({ token: "test-token", cache });

		await client.getDiscussion({ owner: "org", repo: "project", number: 55 });
		await client.getDiscussion({ owner: "org", repo: "project", number: 55 });

		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
	});

	it("throws ContributionNotFoundError when discussion is null", async () => {
		mockOctokit.graphql.mockResolvedValueOnce({
			repository: { discussion: null },
		});
		const client = createGitBazClient({ token: "test-token" });

		await expect(
			client.getDiscussion({ owner: "org", repo: "project", number: 999 }),
		).rejects.toThrow(ContributionNotFoundError);
	});
});

// Repository context tests

const mockRepoGraphQLResponse = {
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

describe("getRepositoryContext", () => {
	let mockOctokit: { graphql: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		const { Octokit } = await import("@octokit/core");
		mockOctokit = {
			graphql: vi.fn().mockResolvedValue(mockRepoGraphQLResponse),
			request: vi.fn(),
		};
		vi.mocked(Octokit).mockImplementation(() => mockOctokit as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches and maps repository context", async () => {
		const client = createGitBazClient({ token: "test-token" });
		const ctx = await client.getRepositoryContext({ owner: "org", repo: "project" });

		expect(ctx.owner).toBe("org");
		expect(ctx.repo).toBe("project");
		expect(ctx.stars).toBe(1234);
		expect(ctx.forks).toBe(567);
		expect(ctx.language).toBe("TypeScript");
		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
	});

	it("caches repository context results", async () => {
		const cache = new MemoryCacheAdapter();
		const client = createGitBazClient({ token: "test-token", cache });

		await client.getRepositoryContext({ owner: "org", repo: "project" });
		await client.getRepositoryContext({ owner: "org", repo: "project" });

		expect(mockOctokit.graphql).toHaveBeenCalledOnce();
	});

	it("throws RepositoryNotFoundError when repository is null", async () => {
		mockOctokit.graphql.mockResolvedValueOnce({
			repository: null,
		});
		const client = createGitBazClient({ token: "test-token" });

		await expect(
			client.getRepositoryContext({ owner: "org", repo: "nonexistent" }),
		).rejects.toThrow(RepositoryNotFoundError);
	});
});
