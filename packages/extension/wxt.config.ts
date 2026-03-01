import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "GitBaz — GitHub Contributor Context",
		description: "Sharp as a falcon — see Contributor Scores, PR stats, and badges on GitHub pages",
		permissions: ["storage"],
		host_permissions: ["https://api.github.com/*"],
	},
});
