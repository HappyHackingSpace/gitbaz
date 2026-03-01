import type { AIConfidence, AIDetectionResult, AISignal, PullRequestContext } from "../types.js";

// Tier 1 — Co-authored-by trailer patterns (matched against commit messageBody)
const CO_AUTHOR_PATTERNS: readonly [RegExp, string][] = [
	[/Co-authored-by:.*<.*noreply@anthropic\.com>/i, "Claude"],
	[/Co-authored-by:.*<.*noreply@aider\.chat>/i, "Aider"],
	[/Co-authored-by:.*<.*cursoragent@cursor\.com>/i, "Cursor"],
];

// Tier 1 — Commit author email patterns
const AI_AUTHOR_EMAIL_PATTERNS: readonly [RegExp, string][] = [
	[/^.*noreply@anthropic\.com$/i, "Claude"],
	[/^.*noreply@aider\.chat$/i, "Aider"],
	[/^cursoragent@cursor\.com$/i, "Cursor"],
];

// Tier 2 — Branch naming patterns
const AI_BRANCH_PATTERNS: readonly [RegExp, string][] = [
	[/^copilot\//i, "Copilot"],
	[/^cursor\//i, "Cursor"],
	[/^devin\//i, "Devin"],
	[/^aider\//i, "Aider"],
	[/^claude\//i, "Claude"],
];

// Tier 2 — Commit author name patterns
const AI_AUTHOR_NAME_PATTERNS: readonly [RegExp, string][] = [
	[/^GitHub Copilot$/i, "Copilot"],
	[/\(aider\)$/i, "Aider"],
];

// Tier 2 — Label patterns
const AI_LABEL_PATTERNS: readonly [RegExp, string][] = [
	[/^ai-generated$/i, "AI"],
	[/^ai-assisted$/i, "AI"],
	[/^copilot$/i, "Copilot"],
];

const checkBotAuthor = (ctx: PullRequestContext): AISignal | null => {
	if (ctx.authorTypename === "Bot") {
		return { tier: 1, tool: "Copilot", reason: "PR author is a Bot account" };
	}
	return null;
};

const checkCoAuthorTrailers = (ctx: PullRequestContext, seen: Set<string>): AISignal[] => {
	if (!ctx.commitAuthors) return [];
	const signals: AISignal[] = [];

	for (const commit of ctx.commitAuthors) {
		for (const [pattern, tool] of CO_AUTHOR_PATTERNS) {
			const key = `coauthor:${tool}`;
			if (seen.has(key)) continue;
			if (pattern.test(commit.messageBody)) {
				seen.add(key);
				signals.push({
					tier: 1,
					tool,
					reason: `Co-authored-by ${tool} trailer in commit`,
				});
			}
		}
	}

	return signals;
};

const checkCommitAuthorEmails = (ctx: PullRequestContext, seen: Set<string>): AISignal[] => {
	if (!ctx.commitAuthors) return [];
	const signals: AISignal[] = [];

	for (const commit of ctx.commitAuthors) {
		for (const [pattern, tool] of AI_AUTHOR_EMAIL_PATTERNS) {
			const key = `email:${tool}`;
			if (seen.has(key)) continue;
			if (pattern.test(commit.email)) {
				seen.add(key);
				signals.push({
					tier: 1,
					tool,
					reason: `Commit author email matches ${tool}`,
				});
			}
		}
	}

	return signals;
};

const checkBranchName = (ctx: PullRequestContext): AISignal | null => {
	if (!ctx.headRefName) return null;

	for (const [pattern, tool] of AI_BRANCH_PATTERNS) {
		if (pattern.test(ctx.headRefName)) {
			return { tier: 2, tool, reason: `Branch "${ctx.headRefName}" matches ${tool} pattern` };
		}
	}

	return null;
};

const checkCommitAuthorNames = (ctx: PullRequestContext, seen: Set<string>): AISignal[] => {
	if (!ctx.commitAuthors) return [];
	const signals: AISignal[] = [];

	for (const commit of ctx.commitAuthors) {
		for (const [pattern, tool] of AI_AUTHOR_NAME_PATTERNS) {
			const key = `name:${tool}`;
			if (seen.has(key)) continue;
			if (pattern.test(commit.name)) {
				seen.add(key);
				signals.push({
					tier: 2,
					tool,
					reason: `Commit author name matches ${tool}`,
				});
			}
		}
	}

	return signals;
};

const checkLabels = (ctx: PullRequestContext): AISignal[] => {
	const signals: AISignal[] = [];

	for (const label of ctx.labels) {
		for (const [pattern, tool] of AI_LABEL_PATTERNS) {
			if (pattern.test(label)) {
				signals.push({ tier: 2, tool, reason: `Label "${label}" indicates AI assistance` });
				break;
			}
		}
	}

	return signals;
};

const checkEmptyBody = (ctx: PullRequestContext): AISignal | null => {
	if (ctx.body === undefined) return null;

	const totalLines = ctx.additions + ctx.deletions;
	const isMinimalBody = !ctx.body || ctx.body.trim().length < 10;

	if (isMinimalBody && totalLines > 50) {
		return {
			tier: 3,
			tool: "Unknown",
			reason: "Empty/minimal PR description on a non-trivial PR",
		};
	}

	return null;
};

const resolveConfidence = (signals: readonly AISignal[]): AIConfidence => {
	if (signals.length === 0) return "none";

	let minTier = 4;
	for (const s of signals) {
		if (s.tier < minTier) minTier = s.tier;
	}

	if (minTier === 1) return "definitive";
	if (minTier === 2) return "high";
	return "low";
};

export const detectAIGenerated = (ctx: PullRequestContext): AIDetectionResult => {
	const seen = new Set<string>();
	const signals: AISignal[] = [];

	// Tier 1 checks
	const botSignal = checkBotAuthor(ctx);
	if (botSignal) signals.push(botSignal);

	signals.push(...checkCoAuthorTrailers(ctx, seen));
	signals.push(...checkCommitAuthorEmails(ctx, seen));

	// Tier 2 checks
	const branchSignal = checkBranchName(ctx);
	if (branchSignal) signals.push(branchSignal);

	signals.push(...checkCommitAuthorNames(ctx, seen));
	signals.push(...checkLabels(ctx));

	// Tier 3 checks
	const bodySignal = checkEmptyBody(ctx);
	if (bodySignal) signals.push(bodySignal);

	const confidence = resolveConfidence(signals);
	const tools = [...new Set(signals.map((s) => s.tool))];

	return {
		isAIGenerated: confidence !== "none",
		confidence,
		signals,
		tools,
	};
};
