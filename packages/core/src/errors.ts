export class GitBazError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitBazError";
	}
}

export class AuthenticationError extends GitBazError {
	constructor(message = "Invalid or missing GitHub token") {
		super(message);
		this.name = "AuthenticationError";
	}
}

export class RateLimitError extends GitBazError {
	readonly resetAt: Date;

	constructor(resetAt: Date) {
		super(`GitHub API rate limit exceeded. Resets at ${resetAt.toISOString()}`);
		this.name = "RateLimitError";
		this.resetAt = resetAt;
	}
}

export class UserNotFoundError extends GitBazError {
	readonly username: string;

	constructor(username: string) {
		super(`GitHub user "${username}" not found`);
		this.name = "UserNotFoundError";
		this.username = username;
	}
}

export class BotAccountError extends GitBazError {
	readonly username: string;

	constructor(username: string, reason: string) {
		super(`Bot account detected: ${reason}`);
		this.name = "BotAccountError";
		this.username = username;
	}
}

export class RepositoryNotFoundError extends GitBazError {
	readonly owner: string;
	readonly repo: string;

	constructor(owner: string, repo: string) {
		super(`Repository "${owner}/${repo}" not found`);
		this.name = "RepositoryNotFoundError";
		this.owner = owner;
		this.repo = repo;
	}
}

export class ContributionNotFoundError extends GitBazError {
	readonly kind: "pr" | "issue" | "discussion";
	readonly ref: { owner: string; repo: string; number: number };

	constructor(
		kind: "pr" | "issue" | "discussion",
		ref: { owner: string; repo: string; number: number },
	) {
		super(
			`${kind === "pr" ? "Pull request" : kind === "issue" ? "Issue" : "Discussion"} ${ref.owner}/${ref.repo}#${ref.number} not found`,
		);
		this.name = "ContributionNotFoundError";
		this.kind = kind;
		this.ref = ref;
	}
}
