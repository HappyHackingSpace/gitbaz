import { describe, expect, it } from "vitest";
import { summarizePullRequest } from "../../src/context/pull-request.js";
import type { PullRequestContext } from "../../src/types.js";

const basePR = (overrides: Partial<PullRequestContext> = {}): PullRequestContext => ({
	ref: { owner: "org", repo: "project", number: 1 },
	title: "Test PR",
	state: "OPEN",
	author: "user",
	createdAt: "2024-01-01T00:00:00Z",
	mergedAt: null,
	closedAt: null,
	isDraft: false,
	reviewDecision: null,
	additions: 100,
	deletions: 50,
	changedFiles: 5,
	commits: 3,
	reviewCount: 1,
	commentCount: 2,
	labels: [],
	linkedIssueCount: 0,
	timeToMergeMs: null,
	fetchedAt: new Date().toISOString(),
	...overrides,
});

describe("summarizePullRequest", () => {
	it("categorizes xs PRs (<=10 lines)", () => {
		const summary = summarizePullRequest(basePR({ additions: 5, deletions: 3 }));
		expect(summary.sizeCategory).toBe("xs");
	});

	it("categorizes s PRs (<=50 lines)", () => {
		const summary = summarizePullRequest(basePR({ additions: 20, deletions: 15 }));
		expect(summary.sizeCategory).toBe("s");
	});

	it("categorizes m PRs (<=250 lines)", () => {
		const summary = summarizePullRequest(basePR({ additions: 100, deletions: 50 }));
		expect(summary.sizeCategory).toBe("m");
	});

	it("categorizes l PRs (<=1000 lines)", () => {
		const summary = summarizePullRequest(basePR({ additions: 500, deletions: 300 }));
		expect(summary.sizeCategory).toBe("l");
	});

	it("categorizes xl PRs (>1000 lines)", () => {
		const summary = summarizePullRequest(basePR({ additions: 800, deletions: 500 }));
		expect(summary.sizeCategory).toBe("xl");
	});

	it("marks open PR as stale after 30 days", () => {
		const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
		const summary = summarizePullRequest(basePR({ createdAt: oldDate }));
		expect(summary.isStale).toBe(true);
	});

	it("does not mark recent open PR as stale", () => {
		const summary = summarizePullRequest(basePR({ createdAt: new Date().toISOString() }));
		expect(summary.isStale).toBe(false);
	});

	it("does not mark merged PR as stale even if old", () => {
		const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
		const summary = summarizePullRequest(basePR({ state: "MERGED", createdAt: oldDate }));
		expect(summary.isStale).toBe(false);
	});

	it("returns timeToMergeLabel for merged PRs", () => {
		const twoHoursMs = 2 * 60 * 60 * 1000;
		const summary = summarizePullRequest(basePR({ timeToMergeMs: twoHoursMs }));
		expect(summary.timeToMergeLabel).toBe("2 hours");
	});

	it("returns timeToMergeLabel in days", () => {
		const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
		const summary = summarizePullRequest(basePR({ timeToMergeMs: threeDaysMs }));
		expect(summary.timeToMergeLabel).toBe("3 days");
	});

	it("returns timeToMergeLabel in minutes", () => {
		const tenMinMs = 10 * 60 * 1000;
		const summary = summarizePullRequest(basePR({ timeToMergeMs: tenMinMs }));
		expect(summary.timeToMergeLabel).toBe("10 minutes");
	});

	it("returns null timeToMergeLabel for unmerged PRs", () => {
		const summary = summarizePullRequest(basePR());
		expect(summary.timeToMergeLabel).toBeNull();
	});

	it("handles singular labels (1 day, 1 hour, 1 minute)", () => {
		const oneDay = 24 * 60 * 60 * 1000;
		expect(summarizePullRequest(basePR({ timeToMergeMs: oneDay })).timeToMergeLabel).toBe("1 day");

		const oneHour = 60 * 60 * 1000;
		expect(summarizePullRequest(basePR({ timeToMergeMs: oneHour })).timeToMergeLabel).toBe(
			"1 hour",
		);

		const oneMinute = 60 * 1000;
		expect(summarizePullRequest(basePR({ timeToMergeMs: oneMinute })).timeToMergeLabel).toBe(
			"1 minute",
		);
	});

	it("estimates review time based on lines changed", () => {
		const small = summarizePullRequest(basePR({ additions: 10, deletions: 5 }));
		expect(small.estimatedReviewMinutes).toBe(7); // 5 + 15 * 0.1 = 6.5 → 7

		const large = summarizePullRequest(basePR({ additions: 800, deletions: 500 }));
		expect(large.estimatedReviewMinutes).toBe(120); // capped at 120
	});

	it("classifies bugfix PRs", () => {
		expect(summarizePullRequest(basePR({ title: "fix: resolve login issue" })).classification).toBe(
			"bugfix",
		);
	});

	it("classifies feature PRs", () => {
		expect(summarizePullRequest(basePR({ title: "feat: add dark mode" })).classification).toBe(
			"feature",
		);
	});

	it("classifies docs PRs", () => {
		expect(summarizePullRequest(basePR({ title: "update docs for API" })).classification).toBe(
			"docs",
		);
	});

	it("classifies test PRs", () => {
		expect(
			summarizePullRequest(basePR({ title: "add unit tests for parser" })).classification,
		).toBe("test");
	});

	it("classifies dependency PRs", () => {
		expect(
			summarizePullRequest(basePR({ title: "bump typescript from 5.0 to 5.1" })).classification,
		).toBe("dependency");
	});

	it("classifies refactor PRs", () => {
		expect(summarizePullRequest(basePR({ title: "refactor auth module" })).classification).toBe(
			"refactor",
		);
	});

	it("classifies chore PRs", () => {
		expect(summarizePullRequest(basePR({ title: "chore: update CI config" })).classification).toBe(
			"chore",
		);
	});

	it("falls back to mixed for unclassifiable PRs", () => {
		expect(summarizePullRequest(basePR({ title: "update stuff" })).classification).toBe("mixed");
	});

	it("classifies from branch name", () => {
		expect(
			summarizePullRequest(basePR({ title: "some changes", headRefName: "fix/login-bug" }))
				.classification,
		).toBe("bugfix");
	});

	it("classifies from labels", () => {
		expect(
			summarizePullRequest(basePR({ title: "some changes", labels: ["bug"] })).classification,
		).toBe("bugfix");
	});
});
