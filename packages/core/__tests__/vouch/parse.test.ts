import { describe, expect, it } from "vitest";
import { lookupVouchStatus, parseVouchFile } from "../../src/vouch/parse.js";

describe("parseVouchFile", () => {
	it("parses bare usernames as vouched entries", () => {
		const entries = parseVouchFile("alice\nbob");
		expect(entries).toEqual([
			{ platform: null, username: "alice", isDenounced: false, reason: null },
			{ platform: null, username: "bob", isDenounced: false, reason: null },
		]);
	});

	it("parses platform-prefixed entries", () => {
		const entries = parseVouchFile("github:alice");
		expect(entries).toEqual([
			{ platform: "github", username: "alice", isDenounced: false, reason: null },
		]);
	});

	it("parses denounced entries without reason", () => {
		const entries = parseVouchFile("-github:spammer");
		expect(entries).toEqual([
			{ platform: "github", username: "spammer", isDenounced: true, reason: null },
		]);
	});

	it("parses denounced entries with reason", () => {
		const entries = parseVouchFile("-github:spammer Submitted AI slop");
		expect(entries).toEqual([
			{ platform: "github", username: "spammer", isDenounced: true, reason: "Submitted AI slop" },
		]);
	});

	it("skips comments and blank lines", () => {
		const content = `# This is a comment
alice

# Another comment
bob
`;
		const entries = parseVouchFile(content);
		expect(entries).toHaveLength(2);
		expect(entries[0].username).toBe("alice");
		expect(entries[1].username).toBe("bob");
	});

	it("handles mixed content file", () => {
		const content = `# Trusted contributors
github:alice
bob
-github:spammer Submitted AI slop
-badactor

# End of file
`;
		const entries = parseVouchFile(content);
		expect(entries).toEqual([
			{ platform: "github", username: "alice", isDenounced: false, reason: null },
			{ platform: null, username: "bob", isDenounced: false, reason: null },
			{ platform: "github", username: "spammer", isDenounced: true, reason: "Submitted AI slop" },
			{ platform: null, username: "badactor", isDenounced: true, reason: null },
		]);
	});

	it("returns empty array for empty content", () => {
		expect(parseVouchFile("")).toEqual([]);
	});

	it("strips inline comments from entries", () => {
		const entries = parseVouchFile("github:alice # trusted maintainer");
		expect(entries).toEqual([
			{ platform: "github", username: "alice", isDenounced: false, reason: null },
		]);
	});
});

describe("lookupVouchStatus", () => {
	const entries = parseVouchFile(`
github:alice
bob
-github:spammer Submitted AI slop
gitlab:external
`);

	it("finds vouched user with github platform", () => {
		const result = lookupVouchStatus(entries, "alice");
		expect(result).toEqual({ status: "vouched", reason: null, hasVouchFile: true });
	});

	it("finds vouched bare username", () => {
		const result = lookupVouchStatus(entries, "bob");
		expect(result).toEqual({ status: "vouched", reason: null, hasVouchFile: true });
	});

	it("finds denounced user with reason", () => {
		const result = lookupVouchStatus(entries, "spammer");
		expect(result).toEqual({
			status: "denounced",
			reason: "Submitted AI slop",
			hasVouchFile: true,
		});
	});

	it("returns none for unknown user", () => {
		const result = lookupVouchStatus(entries, "unknown");
		expect(result).toEqual({ status: "none", reason: null, hasVouchFile: true });
	});

	it("matches case-insensitively", () => {
		const result = lookupVouchStatus(entries, "ALICE");
		expect(result).toEqual({ status: "vouched", reason: null, hasVouchFile: true });
	});

	it("ignores non-github platform entries", () => {
		const result = lookupVouchStatus(entries, "external");
		expect(result).toEqual({ status: "none", reason: null, hasVouchFile: true });
	});

	it("last entry wins when duplicated", () => {
		const dupeEntries = parseVouchFile("github:alice\n-github:alice Changed mind");
		const result = lookupVouchStatus(dupeEntries, "alice");
		expect(result).toEqual({
			status: "denounced",
			reason: "Changed mind",
			hasVouchFile: true,
		});
	});
});
