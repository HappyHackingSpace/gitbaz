import type {
	AIDetectionResult,
	ContributorActivity,
	DiscussionContext,
	DiscussionSummary,
	IssueContext,
	IssueSummary,
	PullRequestContext,
	PullRequestSummary,
	RepositoryContext,
	ScoreResult,
	VouchLookupResult,
} from "@happyhackingspace/gitbaz";

const TIER_COLORS: Record<string, string> = {
	newcomer: "\x1b[90m",
	regular: "\x1b[36m",
	contributor: "\x1b[32m",
	trusted: "\x1b[33m",
	maintainer: "\x1b[35m",
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";

const bar = (ratio: number, width = 20): string => {
	const filled = Math.round(ratio * width);
	return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
};

export const formatTable = (result: ScoreResult): string => {
	const color = TIER_COLORS[result.tier.id] ?? "";
	const lines: string[] = [
		"",
		`${BOLD}  Contributor: ${result.username}${RESET}`,
		`${DIM}  ${"─".repeat(40)}${RESET}`,
		`  ${color}${BOLD}${result.score}${RESET}/100 points  │  ${color}${result.tier.label}${RESET}`,
		"",
	];

	for (const c of result.breakdown.components) {
		if (c.name === "Merge rate") continue;
		const pct = c.maxPoints > 0 ? c.points / c.maxPoints : 0;
		let label = c.name;
		if (c.name === "Global PRs") {
			const merged = Math.round(c.rawValue);
			const total = result.globalPRsTotal ?? merged;
			label = `PRs ${merged}/${total}`;
		} else if (c.name === "In-repo PRs") {
			const merged = Math.round(c.rawValue);
			const total = result.repoPRsTotal ?? merged;
			label = `Repo PRs ${merged}/${total}`;
		}
		lines.push(
			`  ${label.padEnd(18)} ${bar(pct)} ${c.points.toFixed(1).padStart(5)}/${c.maxPoints}`,
		);
	}

	if (result.badges.length > 0) {
		lines.push("", `  Badges: ${result.badges.map((b) => b.label).join(" · ")}`);
	}

	if (result.organizations?.length > 0) {
		lines.push(`  Orgs: ${result.organizations.map((o) => o.login).join(" · ")}`);
	}

	lines.push("");
	return lines.join("\n");
};

export const formatJson = (result: ScoreResult): string => JSON.stringify(result, null, "\t");

export const formatMinimal = (result: ScoreResult): string =>
	`${result.username}: Contributor ${result.score}/100 (${result.tier.label})`;

// Pull Request formatters

const STATE_COLORS: Record<string, string> = {
	OPEN: "\x1b[32m",
	CLOSED: "\x1b[31m",
	MERGED: "\x1b[35m",
};

const formatVouchLine = (vouch: VouchLookupResult): string | null => {
	if (!vouch.hasVouchFile) return null;
	if (vouch.status === "vouched") return `  Vouch              ${GREEN}Vouched${RESET}`;
	if (vouch.status === "denounced") {
		const reason = vouch.reason ? ` (${vouch.reason})` : "";
		return `  Vouch              ${RED}Denounced${RESET}${reason}`;
	}
	return `  Vouch              ${DIM}Not listed${RESET}`;
};

export const formatPullRequest = (
	ctx: PullRequestContext,
	summary: PullRequestSummary,
	aiDetection?: AIDetectionResult,
	vouch?: VouchLookupResult,
): string => {
	const stateColor = STATE_COLORS[ctx.state] ?? "";
	const ref = `${ctx.ref.owner}/${ctx.ref.repo}#${ctx.ref.number}`;

	const lines: string[] = [
		"",
		`${BOLD}  Pull Request: ${ref}${RESET}`,
		`${DIM}  ${"─".repeat(40)}${RESET}`,
		`  ${stateColor}${BOLD}${ctx.isDraft ? "Draft" : ctx.state}${RESET}  │  ${ctx.title}`,
		"",
		`  Size               ${summary.sizeCategory.toUpperCase()} (+${ctx.additions} −${ctx.deletions})`,
		`  Changed files      ${ctx.changedFiles}`,
		`  Commits            ${ctx.commits}`,
		`  Reviews            ${ctx.reviewCount}`,
		`  Comments           ${ctx.commentCount}`,
	];

	if (ctx.reviewDecision) {
		const label =
			ctx.reviewDecision.replace(/_/g, " ").charAt(0) +
			ctx.reviewDecision.replace(/_/g, " ").slice(1).toLowerCase();
		lines.push(`  Review decision    ${label}`);
	}

	if (ctx.linkedIssueCount > 0) {
		lines.push(`  Linked issues      ${ctx.linkedIssueCount}`);
	}

	if (summary.timeToMergeLabel) {
		lines.push(`  Time to merge      ${summary.timeToMergeLabel}`);
	}

	if (summary.isStale) {
		lines.push(`  ${"\x1b[33m"}Stale${RESET}              Open > 30 days`);
	}

	if (aiDetection?.isAIGenerated) {
		const toolStr = aiDetection.tools.join(", ");
		lines.push(`  ${"\x1b[33m"}AI-Assisted${RESET}        ${toolStr} (${aiDetection.confidence})`);
	}

	if (vouch) {
		const vouchLine = formatVouchLine(vouch);
		if (vouchLine) lines.push(vouchLine);
	}

	if (ctx.labels.length > 0) {
		lines.push("", `  Labels: ${ctx.labels.join(" · ")}`);
	}

	lines.push("");
	return lines.join("\n");
};

export const formatPullRequestJson = (
	ctx: PullRequestContext,
	aiDetection?: AIDetectionResult,
	vouch?: VouchLookupResult,
): string => {
	const data: Record<string, unknown> = { ...ctx };
	if (aiDetection?.isAIGenerated) data.aiDetection = aiDetection;
	if (vouch?.hasVouchFile) data.vouch = vouch;
	return JSON.stringify(data, null, "\t");
};

export const formatPullRequestMinimal = (ctx: PullRequestContext): string =>
	`${ctx.ref.owner}/${ctx.ref.repo}#${ctx.ref.number}: ${ctx.state} — ${ctx.title}`;

// Issue formatters

export const formatIssue = (ctx: IssueContext, summary: IssueSummary): string => {
	const stateColor = ctx.state === "OPEN" ? "\x1b[32m" : "\x1b[31m";
	const ref = `${ctx.ref.owner}/${ctx.ref.repo}#${ctx.ref.number}`;

	const lines: string[] = [
		"",
		`${BOLD}  Issue: ${ref}${RESET}`,
		`${DIM}  ${"─".repeat(40)}${RESET}`,
		`  ${stateColor}${BOLD}${ctx.state}${RESET}  │  ${ctx.title}`,
		"",
		`  Comments           ${ctx.commentCount}`,
		`  Participants       ${ctx.participantCount}`,
		`  Reactions          ${ctx.reactionCount}`,
		`  Engagement         ${summary.engagementLevel.charAt(0).toUpperCase() + summary.engagementLevel.slice(1)}`,
	];

	if (summary.resolutionLabel) {
		lines.push(`  Resolution         ${summary.resolutionLabel}`);
	}

	if (ctx.linkedPRCount > 0) {
		lines.push(`  Linked PRs         ${ctx.linkedPRCount}`);
	}

	if (ctx.labels.length > 0) {
		lines.push("", `  Labels: ${ctx.labels.join(" · ")}`);
	}

	lines.push("");
	return lines.join("\n");
};

export const formatIssueJson = (ctx: IssueContext): string => JSON.stringify(ctx, null, "\t");

export const formatIssueMinimal = (ctx: IssueContext): string =>
	`${ctx.ref.owner}/${ctx.ref.repo}#${ctx.ref.number}: ${ctx.state} — ${ctx.title}`;

// Discussion formatters

export const formatDiscussion = (ctx: DiscussionContext, summary: DiscussionSummary): string => {
	const stateColor = ctx.isOpen ? "\x1b[32m" : "\x1b[31m";
	const ref = `${ctx.ref.owner}/${ctx.ref.repo}#${ctx.ref.number}`;

	const lines: string[] = [
		"",
		`${BOLD}  Discussion: ${ref}${RESET}`,
		`${DIM}  ${"─".repeat(40)}${RESET}`,
		`  ${stateColor}${BOLD}${ctx.isOpen ? "OPEN" : "CLOSED"}${RESET}  │  ${ctx.title}`,
		"",
		`  Category           ${ctx.category}`,
		`  Answered           ${ctx.isAnswered ? "Yes" : "No"}`,
		`  Comments           ${ctx.commentCount}`,
		`  Reactions          ${ctx.reactionCount}`,
		`  Upvotes            ${ctx.upvoteCount}`,
		`  Engagement         ${summary.engagementLevel.charAt(0).toUpperCase() + summary.engagementLevel.slice(1)}`,
	];

	if (ctx.labels.length > 0) {
		lines.push("", `  Labels: ${ctx.labels.join(" · ")}`);
	}

	lines.push("");
	return lines.join("\n");
};

export const formatDiscussionJson = (ctx: DiscussionContext): string =>
	JSON.stringify(ctx, null, "\t");

export const formatDiscussionMinimal = (ctx: DiscussionContext): string =>
	`${ctx.ref.owner}/${ctx.ref.repo}#${ctx.ref.number}: ${ctx.isOpen ? "OPEN" : "CLOSED"} — ${ctx.title}`;

// Activity formatters

const HEATMAP_CHARS = [" ", "\u2591", "\u2592", "\u2593", "\u2588"] as const;

export const formatActivity = (activity: ContributorActivity): string => {
	const lines: string[] = [
		"",
		`${BOLD}  Contributor: ${activity.username}${RESET}`,
		`${DIM}  ${"─".repeat(40)}${RESET}`,
		`  ${activity.totalContributions.toLocaleString()} contributions in the last year`,
		"",
	];

	// Compressed single-row heatmap: one char per week (max level in that week)
	const weekChars = activity.weeks.map((w) => {
		const maxLevel = Math.max(...w.days.map((d) => d.level)) as 0 | 1 | 2 | 3 | 4;
		return HEATMAP_CHARS[maxLevel];
	});
	lines.push(`  ${weekChars.join("")}`);
	lines.push("");

	lines.push(
		`  ${"Current streak".padEnd(20)}${activity.streak.current} days`,
		`  ${"Longest streak".padEnd(20)}${activity.streak.longest} days`,
	);

	lines.push("");
	return lines.join("\n");
};

export const formatActivityJson = (activity: ContributorActivity): string =>
	JSON.stringify(activity, null, "\t");

export const formatActivityMinimal = (activity: ContributorActivity): string =>
	`${activity.username}: ${activity.totalContributions} contributions, ${activity.streak.current}-day streak`;

// Repository formatters

const formatTimeAgo = (dateStr: string): string => {
	const diff = Date.now() - new Date(dateStr).getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	if (days < 1) return "today";
	if (days === 1) return "1 day ago";
	if (days < 30) return `${days} days ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} mo ago`;
	const years = Math.floor(days / 365);
	return `${years} yr${years > 1 ? "s" : ""} ago`;
};

export const formatRepo = (ctx: RepositoryContext): string => {
	const lines: string[] = [
		"",
		`${BOLD}  Repository: ${ctx.owner}/${ctx.repo}${RESET}`,
		`${DIM}  ${"─".repeat(40)}${RESET}`,
	];

	const metaParts: string[] = [];
	metaParts.push(`★ ${ctx.stars.toLocaleString()}`);
	metaParts.push(`🍴 ${ctx.forks.toLocaleString()}`);
	if (ctx.language) metaParts.push(ctx.language);
	if (ctx.license) metaParts.push(ctx.license);
	lines.push(`  ${metaParts.join("  │  ")}`);
	lines.push("");

	if (ctx.isArchived) {
		lines.push(`  ${"\x1b[33m"}${BOLD}ARCHIVED${RESET}`);
		lines.push("");
	}

	lines.push(
		`  ${"Open issues".padEnd(20)}${ctx.openIssues.toLocaleString()}`,
		`  ${"Open PRs".padEnd(20)}${ctx.openPRs.toLocaleString()}`,
		`  ${"Total commits".padEnd(20)}${ctx.defaultBranchCommits.toLocaleString()}`,
	);

	if (ctx.pushedAt) {
		lines.push(`  ${"Last push".padEnd(20)}${formatTimeAgo(ctx.pushedAt)}`);
	}

	lines.push(`  ${"Created".padEnd(20)}${formatTimeAgo(ctx.createdAt)}`);

	if (ctx.scorecard) {
		lines.push("");
		lines.push(`  ${BOLD}OSSF Scorecard${RESET}     ${ctx.scorecard.score}/10`);
		for (const check of ctx.scorecard.checks) {
			lines.push(`    ${check.name.padEnd(18)} ${check.score}/10`);
		}
	}

	lines.push("");
	return lines.join("\n");
};

export const formatRepoJson = (ctx: RepositoryContext): string => JSON.stringify(ctx, null, "\t");

export const formatRepoMinimal = (ctx: RepositoryContext): string => {
	const parts = [
		`${ctx.owner}/${ctx.repo}: ★${ctx.stars.toLocaleString()} 🍴${ctx.forks.toLocaleString()}`,
	];
	if (ctx.language) parts.push(ctx.language);
	if (ctx.scorecard) parts.push(`(Scorecard: ${ctx.scorecard.score}/10)`);
	return parts.join(" ");
};
