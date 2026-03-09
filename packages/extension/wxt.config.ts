import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "GitBaz - GitHub Contributor Context",
		description: "Sharp as a falcon - see Contributor Scores, PR stats, and badges on GitHub pages",
		permissions: ["storage"],
		host_permissions: [
			"https://api.github.com/*",
			"https://oss-fuzz-build-logs.storage.googleapis.com/*",
			"https://www.bestpractices.dev/*",
			"https://api.osv.dev/*",
		],
		icons: {
			16: "icons/icon-16.png",
			32: "icons/icon-32.png",
			48: "icons/icon-48.png",
			128: "icons/icon-128.png",
		},
	},
});
