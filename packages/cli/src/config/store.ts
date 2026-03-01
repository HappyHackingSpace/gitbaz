import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface Config {
	token?: string;
}

const CONFIG_DIR = join(homedir(), ".gitbaz");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const ensureConfigDir = (): void => {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
};

const readConfig = (): Config => {
	if (!existsSync(CONFIG_FILE)) return {};
	try {
		return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Config;
	} catch {
		return {};
	}
};

const writeConfig = (config: Config): void => {
	ensureConfigDir();
	writeFileSync(CONFIG_FILE, JSON.stringify(config, null, "\t"), "utf-8");
};

export const getToken = (): string | undefined => readConfig().token;

export const setToken = (token: string): void => {
	const config = readConfig();
	config.token = token;
	writeConfig(config);
};

export const clearToken = (): void => {
	const config = readConfig();
	config.token = undefined;
	writeConfig(config);
};

export const getConfigDir = (): string => CONFIG_DIR;
