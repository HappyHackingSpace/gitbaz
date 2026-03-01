import type { ContributionRef, RepoContext } from "../types.js";

export const buildCacheKey = (username: string, repo?: RepoContext): string => {
	const base = `gitbaz:${username.toLowerCase()}`;
	return repo ? `${base}:${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}` : base;
};

export const buildContextCacheKey = (
	type: "pr" | "issue" | "discussion",
	ref: ContributionRef,
): string => `gitbaz:${type}:${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}#${ref.number}`;

export const buildRepoCacheKey = (repo: RepoContext): string =>
	`gitbaz:repo:${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;

export const isExpired = (expiresAt: number): boolean => Date.now() >= expiresAt;
