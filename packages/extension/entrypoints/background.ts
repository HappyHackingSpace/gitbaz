import { BotAccountError, createGitBazClient } from "@happyhackingspace/gitbaz";
import type { ExtensionMessage, ExtensionResponse } from "../utils/messaging.js";
import { StorageCacheAdapter } from "../utils/storage-cache-adapter.js";

const TOKEN_KEY = "gitbaz_token";

const getStoredToken = async (): Promise<string | undefined> => {
	const result = await chrome.storage.local.get(TOKEN_KEY);
	return result[TOKEN_KEY] as string | undefined;
};

const createClient = async () => {
	const token = await getStoredToken();
	return createGitBazClient({ token, cache: new StorageCacheAdapter() });
};

export default defineBackground(() => {
	chrome.runtime.onMessage.addListener(
		(message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
			(async () => {
				if (message.type === "OPEN_SETTINGS") {
					chrome.runtime.openOptionsPage();
					return;
				}

				if (message.type === "GET_SCORE") {
					try {
						const client = await createClient();
						const result = await client.getScore(message.username, message.repo);
						sendResponse({ type: "SCORE_RESULT", result });
					} catch (error) {
						const errorMessage =
							error instanceof BotAccountError ? `bot:${error.username}` : (error as Error).message;
						sendResponse({
							type: "SCORE_RESULT",
							error: errorMessage,
						});
					}
				} else if (message.type === "GET_PULL_REQUEST") {
					try {
						const client = await createClient();
						const result = await client.getPullRequest(message.ref);
						sendResponse({ type: "PULL_REQUEST_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "PULL_REQUEST_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "GET_ISSUE") {
					try {
						const client = await createClient();
						const result = await client.getIssue(message.ref);
						sendResponse({ type: "ISSUE_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "ISSUE_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "GET_DISCUSSION") {
					try {
						const client = await createClient();
						const result = await client.getDiscussion(message.ref);
						sendResponse({ type: "DISCUSSION_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "DISCUSSION_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "GET_VOUCH_STATUS") {
					try {
						const client = await createClient();
						const result = await client.getVouchStatus(message.username, message.repo);
						sendResponse({ type: "VOUCH_STATUS_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "VOUCH_STATUS_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "CHECK_COLLABORATOR") {
					try {
						const client = await createClient();
						const result = await client.isCollaborator(message.repo);
						sendResponse({ type: "COLLABORATOR_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "COLLABORATOR_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "GET_ACTIVITY") {
					try {
						const client = await createClient();
						const result = await client.getActivity(message.username);
						sendResponse({ type: "ACTIVITY_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "ACTIVITY_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "GET_REPO_CONTEXT") {
					try {
						const client = await createClient();
						const result = await client.getRepositoryContext(message.repo);
						sendResponse({ type: "REPO_CONTEXT_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "REPO_CONTEXT_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "POST_VOUCH_ACTION") {
					try {
						const client = await createClient();
						const result = await client.postVouchAction(
							message.repo,
							message.issueNumber,
							message.action,
							message.targetUsername,
							message.reason,
						);
						sendResponse({ type: "VOUCH_ACTION_RESULT", result });
					} catch (error) {
						sendResponse({
							type: "VOUCH_ACTION_RESULT",
							error: (error as Error).message,
						});
					}
				} else if (message.type === "GET_TOKEN") {
					const token = await getStoredToken();
					sendResponse({ type: "TOKEN_RESULT", token });
				} else if (message.type === "SET_TOKEN") {
					await chrome.storage.local.set({ [TOKEN_KEY]: message.token });
					sendResponse({ type: "TOKEN_RESULT", success: true });
				} else if (message.type === "CLEAR_TOKEN") {
					await chrome.storage.local.remove(TOKEN_KEY);
					sendResponse({ type: "TOKEN_RESULT", success: true });
				}
			})();
			return true; // Keep message channel open for async response
		},
	);
});
