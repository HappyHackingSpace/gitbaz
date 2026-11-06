import type { UserSearchResult } from "@happyhackingspace/gitbaz";
import type { ScoreResponse, SearchUsersResponse, TokenResponse } from "../../utils/messaging.js";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 6;

const authStatus = document.getElementById("auth-status") as HTMLDivElement;
const usernameInput = document.getElementById("username") as HTMLInputElement;
const lookupBtn = document.getElementById("lookup-btn") as HTMLButtonElement;
const resultDiv = document.getElementById("result") as HTMLDivElement;
const suggestionsList = document.getElementById("suggestions") as HTMLUListElement;

let suggestions: readonly UserSearchResult[] = [];
let activeIndex = -1;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchSeq = 0;

const checkAuth = async (): Promise<void> => {
	const response: TokenResponse = await chrome.runtime.sendMessage({ type: "GET_TOKEN" });
	if (response.token) {
		authStatus.textContent = "Authenticated";
		authStatus.classList.add("authenticated");
	} else {
		authStatus.textContent = "No token — set one in Settings";
	}
};

// --- Suggestions ---

const hideSuggestions = (): void => {
	suggestions = [];
	activeIndex = -1;
	suggestionsList.hidden = true;
	suggestionsList.replaceChildren();
	usernameInput.setAttribute("aria-expanded", "false");
	usernameInput.removeAttribute("aria-activedescendant");
};

const setActive = (index: number): void => {
	activeIndex = index;
	const items = suggestionsList.querySelectorAll<HTMLLIElement>(".suggestion");
	items.forEach((item, i) => {
		const selected = i === index;
		item.setAttribute("aria-selected", String(selected));
		if (selected) {
			usernameInput.setAttribute("aria-activedescendant", item.id);
			item.scrollIntoView({ block: "nearest" });
		}
	});
	if (index < 0) usernameInput.removeAttribute("aria-activedescendant");
};

const kindLabel = (type: UserSearchResult["type"]): string =>
	type === "Organization" ? "org" : type === "Bot" ? "bot" : "";

const renderSuggestions = (items: readonly UserSearchResult[], message?: string): void => {
	suggestions = items;
	activeIndex = -1;
	suggestionsList.replaceChildren();

	if (items.length === 0) {
		if (!message) {
			hideSuggestions();
			return;
		}
		const empty = document.createElement("li");
		empty.className = "empty";
		empty.textContent = message;
		suggestionsList.append(empty);
	}

	items.forEach((user, i) => {
		const li = document.createElement("li");
		li.id = `suggestion-${i}`;
		li.className = user.type === "Organization" ? "suggestion org" : "suggestion";
		li.setAttribute("role", "option");
		li.setAttribute("aria-selected", "false");

		const img = document.createElement("img");
		img.src = `${user.avatarUrl}${user.avatarUrl.includes("?") ? "&" : "?"}s=40`;
		img.alt = "";
		img.loading = "lazy";

		const login = document.createElement("span");
		login.className = "login";
		login.textContent = user.login;

		li.append(img, login);

		const kind = kindLabel(user.type);
		if (kind) {
			const kindEl = document.createElement("span");
			kindEl.className = "kind";
			kindEl.textContent = kind;
			li.append(kindEl);
		}

		// mousedown (not click) so it fires before the input's blur hides the list
		li.addEventListener("mousedown", (e) => {
			e.preventDefault();
			selectSuggestion(i);
		});
		li.addEventListener("mousemove", () => {
			if (activeIndex !== i) setActive(i);
		});

		suggestionsList.append(li);
	});

	suggestionsList.hidden = false;
	usernameInput.setAttribute("aria-expanded", "true");
};

const searchUsers = async (query: string): Promise<void> => {
	const seq = ++searchSeq;
	const response: SearchUsersResponse = await chrome.runtime.sendMessage({
		type: "SEARCH_USERS",
		query,
		limit: SUGGESTION_LIMIT,
	});

	// Ignore stale responses (user kept typing) or input that no longer matches
	if (seq !== searchSeq || usernameInput.value.trim() !== query) return;
	if (document.activeElement !== usernameInput) return;

	if (response.error) {
		renderSuggestions([], "Couldn't load suggestions");
	} else {
		renderSuggestions(response.result ?? [], "No matching users");
	}
};

const scheduleSearch = (): void => {
	clearTimeout(searchTimer);
	const query = usernameInput.value.trim();
	if (query.replace(/^@/, "").length < MIN_QUERY_LENGTH) {
		searchSeq++;
		hideSuggestions();
		return;
	}
	searchTimer = setTimeout(() => searchUsers(query), SEARCH_DEBOUNCE_MS);
};

function selectSuggestion(index: number): void {
	const user = suggestions[index];
	if (!user) return;
	usernameInput.value = user.login;
	clearTimeout(searchTimer);
	searchSeq++;
	hideSuggestions();
	lookupUser();
}

// --- Lookup ---

const lookupUser = async (): Promise<void> => {
	const username = usernameInput.value.trim().replace(/^@/, "");
	if (!username) return;

	clearTimeout(searchTimer);
	searchSeq++;
	hideSuggestions();

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
usernameInput.addEventListener("input", scheduleSearch);
usernameInput.addEventListener("blur", () => {
	searchSeq++;
	hideSuggestions();
});
usernameInput.addEventListener("keydown", (e) => {
	const open = !suggestionsList.hidden && suggestions.length > 0;

	if (e.key === "ArrowDown" && open) {
		e.preventDefault();
		setActive((activeIndex + 1) % suggestions.length);
	} else if (e.key === "ArrowUp" && open) {
		e.preventDefault();
		setActive(activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1);
	} else if (e.key === "Escape" && !suggestionsList.hidden) {
		e.preventDefault();
		searchSeq++;
		hideSuggestions();
	} else if (e.key === "Enter") {
		e.preventDefault();
		if (open && activeIndex >= 0) {
			selectSuggestion(activeIndex);
		} else {
			lookupUser();
		}
	}
});

checkAuth();
