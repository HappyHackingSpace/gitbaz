import type { ScoreResponse, TokenResponse } from "../../utils/messaging.js";

const authStatus = document.getElementById("auth-status") as HTMLDivElement;
const usernameInput = document.getElementById("username") as HTMLInputElement;
const lookupBtn = document.getElementById("lookup-btn") as HTMLButtonElement;
const resultDiv = document.getElementById("result") as HTMLDivElement;

const checkAuth = async (): Promise<void> => {
	const response: TokenResponse = await chrome.runtime.sendMessage({ type: "GET_TOKEN" });
	if (response.token) {
		authStatus.textContent = "Authenticated";
		authStatus.classList.add("authenticated");
	} else {
		authStatus.textContent = "No token — set one in Settings";
	}
};

const lookupUser = async (): Promise<void> => {
	const username = usernameInput.value.trim();
	if (!username) return;

	resultDiv.textContent = "Loading...";
	lookupBtn.disabled = true;

	const response: ScoreResponse = await chrome.runtime.sendMessage({
		type: "GET_SCORE",
		username,
	});

	if (response.error) {
		resultDiv.textContent = `Error: ${response.error}`;
	} else if (response.result) {
		const r = response.result;
		resultDiv.textContent = `Contributor: ${r.score}/100 (${r.tier.label})`;
	}

	lookupBtn.disabled = false;
};

lookupBtn.addEventListener("click", lookupUser);
usernameInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") lookupUser();
});

checkAuth();
