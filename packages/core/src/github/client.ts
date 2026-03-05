import { Octokit } from "@octokit/core";
import { calculateStreaks } from "../activity/streaks.js";
import { buildCacheKey, buildContextCacheKey, buildRepoCacheKey } from "../cache/utils.js";
import { DEFAULT_CACHE_TTL, VOUCH_CACHE_TTL } from "../constants.js";
import { analyzeKnowledgeSilos } from "../context/knowledge-silo.js";
import { computeBusFactor } from "../context/knowledge-silo.js";
import { detectBot } from "../contributor/bot-detect.js";
import { calculateScore } from "../contributor/score.js";
import {
	AuthenticationError,
	BotAccountError,
	ContributionNotFoundError,
	RateLimitError,
	RepositoryNotFoundError,
	UserNotFoundError,
} from "../errors.js";
import type {
	BusFactor,
	CacheAdapter,
	ContributionRef,
	ContributorActivity,
	ContributorProfile,
	DiscussionContext,
	GitBazClient,
	GitBazClientOptions,
	IssueContext,
	KnowledgeSiloResult,
	PullRequestContext,
	RepoContext,
	RepositoryContext,
	ScoreResult,
	UserStats,
	VouchAction,
	VouchActionResult,
	VouchLookupResult,
} from "../types.js";
import { lookupVouchStatus, parseVouchFile } from "../vouch/parse.js";
import { buildBlameQuery } from "./blame-queries.js";
import {
	DISCUSSION_QUERY,
	ISSUE_QUERY,
	PULL_REQUEST_QUERY,
	REPOSITORY_QUERY,
} from "./context-queries.js";
import { USER_ACTIVITY_QUERY, USER_STATS_QUERY } from "./graphql-queries.js";
import {
	type GraphQLActivityResponse,
	type GraphQLBlameResponse,
	type GraphQLDiscussionResponse,
	type GraphQLIssueResponse,
	type GraphQLPullRequestResponse,
	type GraphQLRepositoryResponse,
	mapBlameResponse,
	mapGraphQLToActivity,
	mapGraphQLToDiscussionContext,
	mapGraphQLToIssueContext,
	mapGraphQLToPullRequestContext,
	mapGraphQLToRepositoryContext,
	mapGraphQLToUserStats,
} from "./mappers.js";
import {
	checkCollaboratorPermission,
	countRepoPRsMerged,
	countRepoPRsTotal,
	fetchVouchFile,
	postVouchComment,
} from "./rest-queries.js";
import { fetchScorecard } from "./scorecard.js";

const handleApiError = (error: unknown, username: string): never => {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		if (message.includes("bad credentials") || message.includes("401")) {
			throw new AuthenticationError();
		}

		if (message.includes("rate limit") || message.includes("403")) {
			const resetAt = new Date(Date.now() + 60 * 60 * 1000);
			throw new RateLimitError(resetAt);
		}

		if (message.includes("not found") || message.includes("could not resolve")) {
			const botCheck = detectBot(username);
			if (botCheck.isBot) {
				throw new BotAccountError(username, botCheck.reason);
			}
			// "Could not resolve to a User" is what GitHub returns for App accounts
			// (e.g. "coderabbitai" which is actually "coderabbitai[bot]")
			if (message.includes("could not resolve")) {
				throw new BotAccountError(
					`${username}[bot]`,
					`"${username}" could not be resolved as a user (likely a GitHub App)`,
				);
			}
			throw new UserNotFoundError(username);
		}
	}
	throw error;
};

export const createGitBazClient = (options: GitBazClientOptions = {}): GitBazClient => {
	const octokit = new Octokit(options.token ? { auth: options.token } : {});
	const cache = options.cache;
	const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL;

	const getStats = async (username: string, repo?: RepoContext): Promise<UserStats> => {
		const botCheck = detectBot(username);
		if (botCheck.confidence === "definitive") {
			throw new BotAccountError(username, botCheck.reason);
		}

		const cacheKey = `stats:${buildCacheKey(username, repo)}`;

		if (cache) {
			const cached = await cache.get<UserStats>(cacheKey);
			if (cached) return cached;
		}

		try {
			const graphqlResponse = await octokit.graphql(USER_STATS_QUERY, {
				login: username,
			});

			let repoPRs: { merged: number; total: number } | undefined;

			if (repo) {
				const [merged, total] = await Promise.all([
					countRepoPRsMerged(octokit, username, repo),
					countRepoPRsTotal(octokit, username, repo),
				]);
				repoPRs = { merged, total };
			}

			const stats = mapGraphQLToUserStats(
				graphqlResponse as unknown as Parameters<typeof mapGraphQLToUserStats>[0],
				username,
				repoPRs,
			);

			if (cache) {
				await cache.set(cacheKey, stats, cacheTtl);
			}

			return stats;
		} catch (error) {
			return handleApiError(error, username);
		}
	};

	const getScore = async (username: string, repo?: RepoContext): Promise<ScoreResult> => {
		const stats = await getStats(username, repo);
		return calculateScore(stats);
	};

	const getProfile = async (username: string, repo?: RepoContext): Promise<ContributorProfile> => {
		const stats = await getStats(username, repo);
		return {
			stats,
			score: calculateScore(stats),
		};
	};

	const handleContributionApiError = (
		error: unknown,
		kind: "pr" | "issue" | "discussion",
		ref: ContributionRef,
	): never => {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message.includes("bad credentials") || message.includes("401")) {
				throw new AuthenticationError();
			}
			if (message.includes("rate limit") || message.includes("403")) {
				const resetAt = new Date(Date.now() + 60 * 60 * 1000);
				throw new RateLimitError(resetAt);
			}
			if (message.includes("not found") || message.includes("could not resolve")) {
				throw new ContributionNotFoundError(kind, ref);
			}
		}
		throw error;
	};

	const getPullRequest = async (ref: ContributionRef): Promise<PullRequestContext> => {
		const cacheKey = buildContextCacheKey("pr", ref);

		if (cache) {
			const cached = await cache.get<PullRequestContext>(cacheKey);
			if (cached) return cached;
		}

		try {
			const data = (await octokit.graphql(PULL_REQUEST_QUERY, {
				owner: ref.owner,
				repo: ref.repo,
				number: ref.number,
			})) as GraphQLPullRequestResponse;

			const result = mapGraphQLToPullRequestContext(data, ref);
			if (!result) throw new ContributionNotFoundError("pr", ref);

			if (cache) {
				await cache.set(cacheKey, result, cacheTtl);
			}

			return result;
		} catch (error) {
			if (error instanceof ContributionNotFoundError) throw error;
			return handleContributionApiError(error, "pr", ref);
		}
	};

	const getIssue = async (ref: ContributionRef): Promise<IssueContext> => {
		const cacheKey = buildContextCacheKey("issue", ref);

		if (cache) {
			const cached = await cache.get<IssueContext>(cacheKey);
			if (cached) return cached;
		}

		try {
			const data = (await octokit.graphql(ISSUE_QUERY, {
				owner: ref.owner,
				repo: ref.repo,
				number: ref.number,
			})) as GraphQLIssueResponse;

			const result = mapGraphQLToIssueContext(data, ref);
			if (!result) throw new ContributionNotFoundError("issue", ref);

			if (cache) {
				await cache.set(cacheKey, result, cacheTtl);
			}

			return result;
		} catch (error) {
			if (error instanceof ContributionNotFoundError) throw error;
			return handleContributionApiError(error, "issue", ref);
		}
	};

	const getDiscussion = async (ref: ContributionRef): Promise<DiscussionContext> => {
		const cacheKey = buildContextCacheKey("discussion", ref);

		if (cache) {
			const cached = await cache.get<DiscussionContext>(cacheKey);
			if (cached) return cached;
		}

		try {
			const data = (await octokit.graphql(DISCUSSION_QUERY, {
				owner: ref.owner,
				repo: ref.repo,
				number: ref.number,
			})) as GraphQLDiscussionResponse;

			const result = mapGraphQLToDiscussionContext(data, ref);
			if (!result) throw new ContributionNotFoundError("discussion", ref);

			if (cache) {
				await cache.set(cacheKey, result, cacheTtl);
			}

			return result;
		} catch (error) {
			if (error instanceof ContributionNotFoundError) throw error;
			return handleContributionApiError(error, "discussion", ref);
		}
	};

	const getBlameAnalysis = async (
		repo: RepoContext,
		filePaths: readonly string[],
	): Promise<KnowledgeSiloResult> => {
		if (filePaths.length === 0) {
			return { files: [], criticalCount: 0, highCount: 0, analyzedFiles: 0, totalFiles: 0 };
		}

		const cacheKey = `blame:${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}:${filePaths.slice(0, 5).join(",")}:${filePaths.length}`;

		if (cache) {
			const cached = await cache.get<KnowledgeSiloResult>(cacheKey);
			if (cached) return cached;
		}

		try {
			const query = buildBlameQuery(repo.owner, repo.repo, "HEAD", filePaths);
			const data = (await octokit.graphql(query)) as GraphQLBlameResponse;
			const blameByFile = mapBlameResponse(data, filePaths);
			const result = analyzeKnowledgeSilos(blameByFile, filePaths, filePaths.length);

			if (cache) {
				await cache.set(cacheKey, result, cacheTtl);
			}

			return result;
		} catch {
			return {
				files: [],
				criticalCount: 0,
				highCount: 0,
				analyzedFiles: 0,
				totalFiles: filePaths.length,
			};
		}
	};

	const getBusFactor = async (repo: RepoContext): Promise<BusFactor | null> => {
		const cacheKey = `busfactor:${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;

		if (cache) {
			const cached = await cache.get<BusFactor>(cacheKey);
			if (cached) return cached;
		}

		try {
			const res = await octokit.request("GET /repos/{owner}/{repo}/stats/contributors", {
				owner: repo.owner,
				repo: repo.repo,
			});
			if (res.status !== 200 || !Array.isArray(res.data)) return null;

			const stats = (res.data as { author: { login: string } | null; total: number }[])
				.filter((c): c is { author: { login: string }; total: number } => c.author !== null)
				.map((c) => ({ login: c.author.login, commits: c.total }));

			const result = computeBusFactor(stats);
			if (cache) {
				await cache.set(cacheKey, result, cacheTtl);
			}
			return result;
		} catch {
			return null;
		}
	};

	const getRepositoryContext = async (repo: RepoContext): Promise<RepositoryContext> => {
		const cacheKey = buildRepoCacheKey(repo);

		if (cache) {
			const cached = await cache.get<RepositoryContext>(cacheKey);
			if (cached) return cached;
		}

		try {
			const [graphqlResult, scorecardResult] = await Promise.allSettled([
				octokit.graphql(REPOSITORY_QUERY, {
					owner: repo.owner,
					repo: repo.repo,
				}) as Promise<GraphQLRepositoryResponse>,
				fetchScorecard(repo.owner, repo.repo, options.token),
			]);

			if (graphqlResult.status === "rejected") {
				throw graphqlResult.reason;
			}

			const scorecard = scorecardResult.status === "fulfilled" ? scorecardResult.value : null;

			const result = mapGraphQLToRepositoryContext(graphqlResult.value, repo, scorecard);
			if (!result) throw new RepositoryNotFoundError(repo.owner, repo.repo);

			if (cache) {
				await cache.set(cacheKey, result, cacheTtl);
			}

			return result;
		} catch (error) {
			if (error instanceof RepositoryNotFoundError) throw error;
			if (error instanceof Error) {
				const message = error.message.toLowerCase();
				if (message.includes("bad credentials") || message.includes("401")) {
					throw new AuthenticationError();
				}
				if (message.includes("rate limit") || message.includes("403")) {
					const resetAt = new Date(Date.now() + 60 * 60 * 1000);
					throw new RateLimitError(resetAt);
				}
				if (message.includes("not found") || message.includes("could not resolve")) {
					throw new RepositoryNotFoundError(repo.owner, repo.repo);
				}
			}
			throw error;
		}
	};

	const getVouchStatus = async (
		username: string,
		repo: RepoContext,
	): Promise<VouchLookupResult> => {
		const cacheKey = `vouch:${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;

		let fileContent: string | null = null;
		if (cache) {
			const cached = await cache.get<string>(cacheKey);
			if (cached !== undefined) {
				fileContent = cached;
			}
		}

		if (fileContent === null) {
			fileContent = await fetchVouchFile(octokit, repo);
			if (cache && fileContent !== null) {
				await cache.set(cacheKey, fileContent, VOUCH_CACHE_TTL);
			}
		}

		if (fileContent === null) {
			return { status: "none", reason: null, hasVouchFile: false };
		}

		const entries = parseVouchFile(fileContent);
		return lookupVouchStatus(entries, username);
	};

	const isCollaborator = async (repo: RepoContext): Promise<boolean> => {
		const cacheKey = `collab:${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;

		if (cache) {
			const cached = await cache.get<boolean>(cacheKey);
			if (cached !== undefined) return cached;
		}

		const result = await checkCollaboratorPermission(octokit, repo);
		if (cache) {
			await cache.set(cacheKey, result, cacheTtl);
		}
		return result;
	};

	const postVouchAction = async (
		repo: RepoContext,
		issueNumber: number,
		action: VouchAction,
		targetUsername: string,
		reason?: string,
	): Promise<VouchActionResult> => {
		let body: string;
		if (action === "vouch") {
			body = `!vouch @${targetUsername}`;
		} else if (action === "denounce") {
			body = `!denounce @${targetUsername} ${reason ?? ""}`.trim();
		} else {
			body = `!unvouch @${targetUsername}`;
		}

		try {
			const comment = await postVouchComment(octokit, repo, issueNumber, body);

			// Invalidate vouch file cache so next load reflects changes
			if (cache) {
				const cacheKey = `vouch:${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
				await cache.delete(cacheKey);
			}

			return { success: true, commentUrl: comment.html_url, error: null };
		} catch (error) {
			return { success: false, commentUrl: null, error: (error as Error).message };
		}
	};

	const getActivity = async (username: string): Promise<ContributorActivity> => {
		const botCheck = detectBot(username);
		if (botCheck.confidence === "definitive") {
			throw new BotAccountError(username, botCheck.reason);
		}

		const cacheKey = `activity:gitbaz:${username.toLowerCase()}`;

		if (cache) {
			const cached = await cache.get<ContributorActivity>(cacheKey);
			if (cached) return cached;
		}

		try {
			const data = (await octokit.graphql(USER_ACTIVITY_QUERY, {
				login: username,
			})) as GraphQLActivityResponse;

			const weeks = data.user.contributionsCollection.contributionCalendar.weeks.map((w) => ({
				days: w.contributionDays.map((d) => ({
					date: d.date,
					count: d.contributionCount,
					level:
						(
							{
								NONE: 0,
								FIRST_QUARTILE: 1,
								SECOND_QUARTILE: 2,
								THIRD_QUARTILE: 3,
								FOURTH_QUARTILE: 4,
							} as Record<string, 0 | 1 | 2 | 3 | 4>
						)[d.contributionLevel] ?? (0 as const),
				})),
			}));

			const streak = calculateStreaks(weeks);
			const result = mapGraphQLToActivity(data, username, streak);

			if (cache) {
				await cache.set(cacheKey, result, cacheTtl);
			}

			return result;
		} catch (error) {
			return handleApiError(error, username);
		}
	};

	return {
		getScore,
		getStats,
		getProfile,
		getActivity,
		getPullRequest,
		getIssue,
		getDiscussion,
		getRepositoryContext,
		getBusFactor,
		getBlameAnalysis,
		getVouchStatus,
		isCollaborator,
		postVouchAction,
	};
};
