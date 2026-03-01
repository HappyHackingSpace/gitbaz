import { describe, expect, it } from "vitest";
import { summarizeDiscussion } from "../../src/context/discussion.js";
import type { DiscussionContext } from "../../src/types.js";

const baseDiscussion = (overrides: Partial<DiscussionContext> = {}): DiscussionContext => ({
	ref: { owner: "org", repo: "project", number: 1 },
	title: "Test Discussion",
	isOpen: true,
	author: "user",
	createdAt: "2024-01-01T00:00:00Z",
	closedAt: null,
	category: "General",
	isAnswered: false,
	commentCount: 0,
	reactionCount: 0,
	upvoteCount: 0,
	labels: [],
	fetchedAt: new Date().toISOString(),
	...overrides,
});

describe("summarizeDiscussion", () => {
	it("classifies low engagement", () => {
		const summary = summarizeDiscussion(baseDiscussion({ commentCount: 1, reactionCount: 1 }));
		expect(summary.engagementLevel).toBe("low");
	});

	it("classifies medium engagement", () => {
		const summary = summarizeDiscussion(baseDiscussion({ commentCount: 5, reactionCount: 8 }));
		expect(summary.engagementLevel).toBe("medium");
	});

	it("classifies high engagement", () => {
		const summary = summarizeDiscussion(baseDiscussion({ commentCount: 10, reactionCount: 10 }));
		expect(summary.engagementLevel).toBe("high");
	});

	it("passes through isAnswered false", () => {
		const summary = summarizeDiscussion(baseDiscussion());
		expect(summary.isAnswered).toBe(false);
	});

	it("passes through isAnswered true", () => {
		const summary = summarizeDiscussion(baseDiscussion({ isAnswered: true }));
		expect(summary.isAnswered).toBe(true);
	});
});
