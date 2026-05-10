import type { ScoreResponse, SearchUsersResponse, TokenResponse } from "../../utils/messaging.js";
import type { UserSearchResult } from "@happyhackingspace/gitbaz";

const authStatus = document.getElementById("auth-status") as HTMLDivElement;
const usernameInput = document.getElementById("username") as HTMLInputElement;
const searchResults = document.getElementById("search-results") as HTMLDivElement;
const lookupBtn = document.getElementById("lookup-btn") as HTMLButtonElement;
const resultDiv = document.getElementById("result") as HTMLDivElement;

let searchTimeout: ReturnType<typeof setTimeout>;

const checkAuth = async (): Promise<void> => {
	const response: TokenResponse = await chrome.runtime.sendMessage({ type: "GET_TOKEN" });
	if (response.token) {
		authStatus.textContent = "Authenticated";
		authStatus.classList.add("authenticated");
	} else {
		authStatus.textContent = "No token — set one in Settings";
	}
};

const lookupUser = async (usernameToUse?: string): Promise<void> => {
	const username = usernameToUse || usernameInput.value.trim();
	if (!username) return;

	resultDiv.textContent = "Loading...";
	lookupBtn.disabled = true;
	searchResults.style.display = "none";

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

const handleSearch = async (): Promise<void> => {
	const query = usernameInput.value.trim();
	if (query.length < 2) {
		searchResults.style.display = "none";
		return;
	}

	const response: SearchUsersResponse = await chrome.runtime.sendMessage({
		type: "SEARCH_USERS",
		query,
	});

	if (response.result && response.result.length > 0) {
		displayResults(response.result);
	} else {
		searchResults.style.display = "none";
	}
};

const displayResults = (users: readonly UserSearchResult[]): void => {
	searchResults.innerHTML = "";
	searchResults.style.display = "block";

	for (const user of users) {
		const item = document.createElement("div");
		item.className = "search-result-item";
		item.innerHTML = `
			<img src="${user.avatarUrl}" alt="${user.login}" />
			<span>${user.login}</span>
		`;
		item.addEventListener("click", () => {
			usernameInput.value = user.login;
			searchResults.style.display = "none";
			lookupUser(user.login);
		});
		searchResults.appendChild(item);
	}
};

lookupBtn.addEventListener("click", () => lookupUser());

usernameInput.addEventListener("input", () => {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(handleSearch, 300);
});

usernameInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		clearTimeout(searchTimeout);
		lookupUser();
	}
});

// Hide search results when clicking outside
document.addEventListener("click", (e) => {
	if (!usernameInput.contains(e.target as Node) && !searchResults.contains(e.target as Node)) {
		searchResults.style.display = "none";
	}
});

checkAuth();
