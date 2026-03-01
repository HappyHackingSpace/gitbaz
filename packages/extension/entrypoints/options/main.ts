import { StorageCacheAdapter } from "../../utils/storage-cache-adapter.js";

const tokenInput = document.getElementById("token") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
const tokenStatus = document.getElementById("token-status") as HTMLDivElement;
const clearCacheBtn = document.getElementById("clear-cache-btn") as HTMLButtonElement;
const cacheStatus = document.getElementById("cache-status") as HTMLDivElement;

const showStatus = (el: HTMLElement, msg: string, type: string): void => {
	el.textContent = msg;
	el.className = `status ${type}`;
	setTimeout(() => {
		el.textContent = "";
	}, 3000);
};

saveBtn.addEventListener("click", async () => {
	const token = tokenInput.value.trim();
	if (!token) {
		showStatus(tokenStatus, "Please enter a token", "error");
		return;
	}
	await chrome.runtime.sendMessage({ type: "SET_TOKEN", token });
	tokenInput.value = "";
	showStatus(tokenStatus, "Token saved", "success");
});

clearBtn.addEventListener("click", async () => {
	await chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" });
	showStatus(tokenStatus, "Token cleared", "success");
});

clearCacheBtn.addEventListener("click", async () => {
	const cache = new StorageCacheAdapter();
	await cache.clear();
	showStatus(cacheStatus, "Cache cleared", "success");
});

// Check current auth status on load
const checkInitialAuth = async (): Promise<void> => {
	const response = await chrome.runtime.sendMessage({ type: "GET_TOKEN" });
	if (response.token) {
		showStatus(tokenStatus, "Currently authenticated", "success");
	}
};

checkInitialAuth();
