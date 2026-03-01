import { describe, expect, it } from "vitest";
import { summarizeIssue } from "../../src/context/issue.js";
import type { IssueContext } from "../../src/types.js";

const baseIssue = (overrides: Partial<IssueContext> = {}): IssueContext => ({
	ref: { owner: "org", repo: "project", number: 1 },
	title: "Test Issue",
	state: "OPEN",
	stateReason: null,
	author: "user",
	createdAt: "2024-01-01T00:00:00Z",
	closedAt: null,
	commentCount: 0,
	labels: [],
	linkedPRCount: 0,
	reactionCount: 0,
	participantCount: 1,
	fetchedAt: new Date().toISOString(),
	...overrides,
});

describe("summarizeIssue", () => {
	it("detects no linked PRs", () => {
		const summary = summarizeIssue(baseIssue());
		expect(summary.hasLinkedPRs).toBe(false);
	});

	it("detects linked PRs", () => {
		const summary = summarizeIssue(baseIssue({ linkedPRCount: 2 }));
		expect(summary.hasLinkedPRs).toBe(true);
	});

	it("classifies low engagement", () => {
		const summary = summarizeIssue(baseIssue({ commentCount: 1, participantCount: 1 }));
		expect(summary.engagementLevel).toBe("low");
	});

	it("classifies medium engagement", () => {
		const summary = summarizeIssue(baseIssue({ commentCount: 8, participantCount: 5 }));
		expect(summary.engagementLevel).toBe("medium");
	});

	it("classifies high engagement", () => {
		const summary = summarizeIssue(baseIssue({ commentCount: 20, participantCount: 10 }));
		expect(summary.engagementLevel).toBe("high");
	});

	it("returns Completed resolution for completed issues", () => {
		const summary = summarizeIssue(baseIssue({ state: "CLOSED", stateReason: "COMPLETED" }));
		expect(summary.resolutionLabel).toBe("Completed");
	});

	it("returns Not planned resolution", () => {
		const summary = summarizeIssue(baseIssue({ state: "CLOSED", stateReason: "NOT_PLANNED" }));
		expect(summary.resolutionLabel).toBe("Not planned");
	});

	it("returns null resolution for open issues", () => {
		const summary = summarizeIssue(baseIssue());
		expect(summary.resolutionLabel).toBeNull();
	});

	it("returns null resolution for closed issues without stateReason", () => {
		const summary = summarizeIssue(baseIssue({ state: "CLOSED", stateReason: null }));
		expect(summary.resolutionLabel).toBeNull();
	});
});
