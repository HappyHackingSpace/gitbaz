import { describe, expect, it } from "vitest";
import { detectBot } from "../../src/contributor/bot-detect.js";

describe("detectBot", () => {
	describe("definitive bots (GitHub App [bot] suffix)", () => {
		it.each(["dependabot[bot]", "renovate[bot]", "github-actions[bot]"])(
			"detects '%s' as definitive bot",
			(username) => {
				const result = detectBot(username);
				expect(result.isBot).toBe(true);
				expect(result.confidence).toBe("definitive");
				expect(result.reason).toContain(username);
			},
		);
	});

	describe("case insensitivity", () => {
		it("detects 'Dependabot[bot]' as definitive (case-insensitive)", () => {
			const result = detectBot("Dependabot[bot]");
			expect(result.isBot).toBe(true);
			expect(result.confidence).toBe("definitive");
		});

		it("detects 'RENOVATE[BOT]' as definitive (case-insensitive)", () => {
			const result = detectBot("RENOVATE[BOT]");
			expect(result.isBot).toBe(true);
			expect(result.confidence).toBe("definitive");
		});
	});

	describe("likely bots (username pattern match)", () => {
		it.each(["snyk-bot", "k8s-ci-robot", "jenkins-ci", "codecov-commenter", "github-actions"])(
			"detects '%s' as likely bot",
			(username) => {
				const result = detectBot(username);
				expect(result.isBot).toBe(true);
				expect(result.confidence).toBe("likely");
				expect(result.reason).toContain("matches known bot username patterns");
			},
		);
	});

	describe("non-bots", () => {
		it.each(["octocat", "abbott", "dogancanbakir"])("does not flag '%s' as a bot", (username) => {
			const result = detectBot(username);
			expect(result.isBot).toBe(false);
			expect(result.confidence).toBe("none");
		});

		it("returns non-bot for empty string", () => {
			const result = detectBot("");
			expect(result.isBot).toBe(false);
			expect(result.confidence).toBe("none");
		});
	});
});
