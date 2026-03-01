export type BotConfidence = "definitive" | "likely" | "none";

export interface BotDetectionResult {
	readonly isBot: boolean;
	readonly confidence: BotConfidence;
	readonly reason: string;
}

// Definitive: GitHub App bots — cannot be queried via user() GraphQL
const GITHUB_APP_BOT_SUFFIX = /\[bot\]$/i;

// Likely: OSS Insight regex covering ~95,620 known bot accounts
const BOT_USERNAME_PATTERN =
	/^(bot-.+|.+bot|.+\[bot\]|.+-bot-.+|robot-.+|.+-ci-.+|.+-ci|.+-testing|.+clabot.+|.+-gerrit|k8s-.+|.+-machine|.+-automation|github-.+|.+-github|.+-service|.+-builds|codecov-.+|.+teamcity.+|jenkins-.+|.+-jira-.+)$/i;

export const detectBot = (username: string): BotDetectionResult => {
	if (!username) {
		return { isBot: false, confidence: "none", reason: "" };
	}

	if (GITHUB_APP_BOT_SUFFIX.test(username)) {
		return {
			isBot: true,
			confidence: "definitive",
			reason: `"${username}" is a GitHub App bot`,
		};
	}

	if (BOT_USERNAME_PATTERN.test(username)) {
		return {
			isBot: true,
			confidence: "likely",
			reason: `"${username}" matches known bot username patterns`,
		};
	}

	return { isBot: false, confidence: "none", reason: "" };
};
