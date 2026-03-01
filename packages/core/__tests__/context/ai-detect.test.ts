import { describe, expect, it } from "vitest";
import { detectAIGenerated } from "../../src/context/ai-detect.js";
import type { PullRequestContext } from "../../src/types.js";

const basePR: PullRequestContext = {
	ref: { owner: "org", repo: "project", number: 1 },
	title: "Fix parser bug",
	state: "OPEN",
	author: "octocat",
	createdAt: "2024-01-10T10:00:00Z",
	mergedAt: null,
	closedAt: null,
	isDraft: false,
	reviewDecision: null,
	additions: 10,
	deletions: 5,
	changedFiles: 2,
	commits: 1,
	reviewCount: 0,
	commentCount: 0,
	labels: [],
	linkedIssueCount: 0,
	timeToMergeMs: null,
	fetchedAt: "2024-01-10T12:00:00Z",
};

describe("detectAIGenerated", () => {
	// --- Tier 1: Definitive ---

	describe("Tier 1 — Definitive", () => {
		it("detects Bot author typename as Copilot", () => {
			const ctx: PullRequestContext = { ...basePR, authorTypename: "Bot" };
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("definitive");
			expect(result.tools).toContain("Copilot");
			expect(result.signals).toEqual(
				expect.arrayContaining([expect.objectContaining({ tier: 1, tool: "Copilot" })]),
			);
		});

		it("detects Claude Co-authored-by trailer", () => {
			const ctx: PullRequestContext = {
				...basePR,
				commitAuthors: [
					{
						name: "octocat",
						email: "octocat@example.com",
						messageHeadline: "fix: parser bug",
						messageBody: "Co-authored-by: Claude <noreply@anthropic.com>",
					},
				],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("definitive");
			expect(result.tools).toContain("Claude");
		});

		it("detects Aider Co-authored-by trailer", () => {
			const ctx: PullRequestContext = {
				...basePR,
				commitAuthors: [
					{
						name: "dev",
						email: "dev@example.com",
						messageHeadline: "refactor: clean up",
						messageBody: "Co-authored-by: aider (aider) <noreply@aider.chat>",
					},
				],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("definitive");
			expect(result.tools).toContain("Aider");
		});

		it("detects Cursor agent email in commit author", () => {
			const ctx: PullRequestContext = {
				...basePR,
				commitAuthors: [
					{
						name: "Cursor Agent",
						email: "cursoragent@cursor.com",
						messageHeadline: "feat: add feature",
						messageBody: "",
					},
				],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("definitive");
			expect(result.tools).toContain("Cursor");
		});

		it("deduplicates signals across multiple commits with same trailer", () => {
			const ctx: PullRequestContext = {
				...basePR,
				commitAuthors: [
					{
						name: "dev",
						email: "dev@example.com",
						messageHeadline: "fix: part 1",
						messageBody: "Co-authored-by: Claude <noreply@anthropic.com>",
					},
					{
						name: "dev",
						email: "dev@example.com",
						messageHeadline: "fix: part 2",
						messageBody: "Co-authored-by: Claude <noreply@anthropic.com>",
					},
				],
			};
			const result = detectAIGenerated(ctx);

			const claudeSignals = result.signals.filter(
				(s) => s.tool === "Claude" && s.reason.includes("Co-authored-by"),
			);
			expect(claudeSignals).toHaveLength(1);
		});
	});

	// --- Tier 2: High confidence ---

	describe("Tier 2 — High confidence", () => {
		it("detects copilot/* branch name", () => {
			const ctx: PullRequestContext = {
				...basePR,
				headRefName: "copilot/fix-parser",
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
			expect(result.tools).toContain("Copilot");
		});

		it("detects cursor/* branch name", () => {
			const ctx: PullRequestContext = {
				...basePR,
				headRefName: "cursor/refactor-api",
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
			expect(result.tools).toContain("Cursor");
		});

		it("detects devin/* branch name", () => {
			const ctx: PullRequestContext = {
				...basePR,
				headRefName: "devin/implement-auth",
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
			expect(result.tools).toContain("Devin");
		});

		it("detects 'GitHub Copilot' author name", () => {
			const ctx: PullRequestContext = {
				...basePR,
				commitAuthors: [
					{
						name: "GitHub Copilot",
						email: "noreply@github.com",
						messageHeadline: "fix: typo",
						messageBody: "",
					},
				],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
			expect(result.tools).toContain("Copilot");
		});

		it("detects (aider) author name suffix", () => {
			const ctx: PullRequestContext = {
				...basePR,
				commitAuthors: [
					{
						name: "dev (aider)",
						email: "dev@example.com",
						messageHeadline: "refactor: module",
						messageBody: "",
					},
				],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
			expect(result.tools).toContain("Aider");
		});

		it("detects ai-generated label", () => {
			const ctx: PullRequestContext = {
				...basePR,
				labels: ["bug", "ai-generated"],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
		});

		it("detects ai-assisted label", () => {
			const ctx: PullRequestContext = {
				...basePR,
				labels: ["ai-assisted"],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
		});

		it("detects copilot label", () => {
			const ctx: PullRequestContext = {
				...basePR,
				labels: ["copilot"],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("high");
			expect(result.tools).toContain("Copilot");
		});

		it("returns no signal for normal branch name", () => {
			const ctx: PullRequestContext = {
				...basePR,
				headRefName: "feature/add-login",
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(false);
			expect(result.confidence).toBe("none");
		});
	});

	// --- Tier 3: Low confidence ---

	describe("Tier 3 — Low confidence", () => {
		it("detects empty body on large PR", () => {
			const ctx: PullRequestContext = {
				...basePR,
				additions: 100,
				deletions: 30,
				body: "",
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("low");
			expect(result.signals[0].tier).toBe(3);
		});

		it("returns no signal for empty body on small PR", () => {
			const ctx: PullRequestContext = {
				...basePR,
				additions: 5,
				deletions: 2,
				body: "",
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(false);
			expect(result.confidence).toBe("none");
		});

		it("returns no signal for large PR with proper description", () => {
			const ctx: PullRequestContext = {
				...basePR,
				additions: 200,
				deletions: 50,
				body: "This PR refactors the authentication module to support OAuth2 flow with proper token refresh handling.",
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(false);
			expect(result.confidence).toBe("none");
		});

		it("returns no signal when body is undefined (old cache)", () => {
			const result = detectAIGenerated(basePR);

			// basePR has no body field at all → undefined
			expect(result.signals.filter((s) => s.tier === 3)).toHaveLength(0);
		});
	});

	// --- Confidence resolution ---

	describe("Confidence resolution", () => {
		it("resolves to definitive when tier 1 present", () => {
			const ctx: PullRequestContext = { ...basePR, authorTypename: "Bot" };
			const result = detectAIGenerated(ctx);
			expect(result.confidence).toBe("definitive");
		});

		it("resolves to high when only tier 2", () => {
			const ctx: PullRequestContext = {
				...basePR,
				headRefName: "copilot/fix-bug",
			};
			const result = detectAIGenerated(ctx);
			expect(result.confidence).toBe("high");
		});

		it("resolves to low when only tier 3", () => {
			const ctx: PullRequestContext = {
				...basePR,
				additions: 100,
				deletions: 30,
				body: "",
			};
			const result = detectAIGenerated(ctx);
			expect(result.confidence).toBe("low");
		});

		it("resolves to definitive when tier 1 + tier 2 present", () => {
			const ctx: PullRequestContext = {
				...basePR,
				authorTypename: "Bot",
				headRefName: "copilot/fix-bug",
			};
			const result = detectAIGenerated(ctx);
			expect(result.confidence).toBe("definitive");
		});

		it("resolves to none when no signals", () => {
			const result = detectAIGenerated(basePR);
			expect(result.confidence).toBe("none");
			expect(result.isAIGenerated).toBe(false);
			expect(result.signals).toHaveLength(0);
			expect(result.tools).toHaveLength(0);
		});
	});

	// --- Multi-tool detection ---

	describe("Multi-tool detection", () => {
		it("detects both Claude and Cursor when both present", () => {
			const ctx: PullRequestContext = {
				...basePR,
				commitAuthors: [
					{
						name: "dev",
						email: "dev@example.com",
						messageHeadline: "fix: auth",
						messageBody: "Co-authored-by: Claude <noreply@anthropic.com>",
					},
					{
						name: "Cursor Agent",
						email: "cursoragent@cursor.com",
						messageHeadline: "feat: logging",
						messageBody: "",
					},
				],
			};
			const result = detectAIGenerated(ctx);

			expect(result.isAIGenerated).toBe(true);
			expect(result.confidence).toBe("definitive");
			expect(result.tools).toContain("Claude");
			expect(result.tools).toContain("Cursor");
		});
	});
});
