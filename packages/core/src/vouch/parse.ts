import type { VouchEntry, VouchLookupResult } from "../types.js";

/** Parse a VOUCHED.td file into structured entries */
export const parseVouchFile = (content: string): VouchEntry[] => {
	const entries: VouchEntry[] = [];

	for (const raw of content.split("\n")) {
		const line = raw.replace(/#.*$/, "").trim();
		if (!line) continue;

		const isDenounced = line.startsWith("-");
		const rest = isDenounced ? line.slice(1).trim() : line;

		let platform: string | null = null;
		let username: string;
		let reason: string | null = null;

		const colonIdx = rest.indexOf(":");
		const spaceIdx = rest.indexOf(" ");

		// platform:user or platform:user reason
		if (colonIdx !== -1 && (spaceIdx === -1 || colonIdx < spaceIdx)) {
			platform = rest.slice(0, colonIdx);
			const afterColon = rest.slice(colonIdx + 1);
			const parts = afterColon.split(/\s+/);
			username = parts[0];
			if (parts.length > 1) {
				reason = parts.slice(1).join(" ");
			}
		} else {
			const parts = rest.split(/\s+/);
			username = parts[0];
			if (parts.length > 1) {
				reason = parts.slice(1).join(" ");
			}
		}

		if (!username) continue;

		entries.push({ platform, username, isDenounced, reason });
	}

	return entries;
};

/** Look up a GitHub user's vouch status from parsed entries (case-insensitive, last entry wins) */
export const lookupVouchStatus = (
	entries: readonly VouchEntry[],
	username: string,
): VouchLookupResult => {
	const lower = username.toLowerCase();
	let matched: VouchEntry | undefined;

	for (const entry of entries) {
		// Match github-prefixed or bare entries (non-github platforms are ignored)
		if (entry.platform !== null && entry.platform.toLowerCase() !== "github") continue;
		if (entry.username.toLowerCase() !== lower) continue;
		matched = entry;
	}

	if (!matched) {
		return { status: "none", reason: null, hasVouchFile: true };
	}

	return {
		status: matched.isDenounced ? "denounced" : "vouched",
		reason: matched.reason,
		hasVouchFile: true,
	};
};
