import type {
	BusFactor,
	ContributorActivity,
	DiscussionContext,
	IssueContext,
	KnowledgeSiloResult,
	PullRequestContext,
	RepoContext,
	RepositoryContext,
	ScoreResult,
	VouchLookupResult,
} from "@happyhackingspace/gitbaz";
import {
	detectAIGenerated,
	detectBot,
	summarizeDiscussion,
	summarizeIssue,
	summarizePullRequest,
} from "@happyhackingspace/gitbaz";
import { parseGitHubUrl, toContributionRef, toRepoContext } from "../utils/github-url-parser.js";
import type {
	ActivityResponse,
	BlameAnalysisResponse,
	BusFactorResponse,
	CollaboratorResponse,
	DiscussionResponse,
	IssueResponse,
	PullRequestResponse,
	RepoContextResponse,
	ScoreResponse,
	TokenResponse,
	VouchActionResponse,
	VouchStatusResponse,
} from "../utils/messaging.js";
import cssText from "./github-panel.content/style.css?inline";

const PANEL_ID = "gitbaz-panel";

const formatAccountAge = (years: number): string => {
	if (years < 1) return `${Math.round(years * 12)} mo`;
	return `${Math.round(years)} yrs`;
};

const renderBotContent = (username: string): string => `
	<div class="gitbaz-bot-panel">
		<div class="gitbaz-bot-icon">🤖</div>
		<div class="gitbaz-bot-label">${username}</div>
		<div class="gitbaz-bot-description">Automated account (not a human contributor)</div>
	</div>
`;

// --- Tab content renderers (return inner HTML, not full panels) ---

const renderVouchStatus = (vouch: VouchLookupResult): string => {
	if (!vouch.hasVouchFile) return "";

	if (vouch.status === "vouched") {
		return `<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Vouch</span>
			<span class="gitbaz-vouch-status vouch-vouched">Vouched</span>
		</div>`;
	}

	if (vouch.status === "denounced") {
		const tooltip = vouch.reason ? ` title="${vouch.reason}"` : "";
		return `<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Vouch</span>
			<span class="gitbaz-vouch-status vouch-denounced"${tooltip}>Denounced</span>
		</div>`;
	}

	return `<div class="gitbaz-stat-row">
		<span class="gitbaz-stat-label">Vouch</span>
		<span class="gitbaz-vouch-status vouch-none">Not listed</span>
	</div>`;
};

interface ScoreContentOptions {
	readonly vouch?: VouchLookupResult;
	readonly showVouchActions?: boolean;
}

const renderScoreContent = (result: ScoreResult, options?: ScoreContentOptions): string => {
	const tierClass = `tier-${result.tier.id}`;

	const statRows = result.breakdown.components
		.filter((c) => c.name !== "Merge rate")
		.map((c) => {
			let displayValue: string;
			if (c.name === "Account age") {
				displayValue = formatAccountAge(c.rawValue);
			} else if (c.name === "Global PRs") {
				const merged = Math.round(c.rawValue);
				const total = result.globalPRsTotal ?? merged;
				displayValue = `${merged}/${total}`;
			} else if (c.name === "In-repo PRs") {
				const merged = Math.round(c.rawValue);
				const total = result.repoPRsTotal ?? merged;
				displayValue = `${merged}/${total}`;
			} else {
				displayValue = `${Math.round(c.rawValue)}`;
			}
			return `<div class="gitbaz-stat-row">
				<span class="gitbaz-stat-label">${c.name}</span>
				<span class="gitbaz-stat-value">${displayValue}</span>
			</div>`;
		})
		.join("");

	const vouchRow = options?.vouch ? renderVouchStatus(options.vouch) : "";

	const badgesHtml =
		result.badges.length > 0
			? `<div class="gitbaz-badges">${result.badges.map((b) => `<span class="gitbaz-badge" title="${b.description}">${b.label}</span>`).join("")}</div>`
			: "";

	const orgs = result.organizations ?? [];
	const orgsHtml =
		orgs.length > 0
			? `<div class="gitbaz-orgs">${orgs.map((org) => `<a href="https://github.com/${org.login}" target="_blank" title="${org.name || org.login}"><img class="gitbaz-org-avatar" src="${org.avatarUrl}&s=32" alt="${org.login}" /></a>`).join("")}</div>`
			: "";

	const actionsHtml =
		options?.showVouchActions && options.vouch?.hasVouchFile
			? renderVouchActions(options.vouch)
			: "";

	return `
		<div class="${tierClass}">
			<div class="gitbaz-score-row">
				<span class="gitbaz-score">${result.score ?? 0}</span>
				<span class="gitbaz-tier">${result.tier.label}</span>
				<span class="gitbaz-points-label">points</span>
			</div>
			<div class="gitbaz-stats">${statRows}${vouchRow}</div>
			${badgesHtml}
			${orgsHtml}
			${actionsHtml}
		</div>
	`;
};

const renderVouchActions = (vouch: VouchLookupResult): string => {
	const buttons: string[] = [];

	if (vouch.status !== "vouched") {
		buttons.push(
			`<button class="gitbaz-vouch-btn vouch-btn-vouch" data-vouch-action="vouch">Vouch</button>`,
		);
	}
	if (vouch.status !== "denounced") {
		buttons.push(
			`<button class="gitbaz-vouch-btn vouch-btn-denounce" data-vouch-action="denounce">Denounce</button>`,
		);
	}
	if (vouch.status !== "none") {
		buttons.push(
			`<button class="gitbaz-vouch-btn vouch-btn-unvouch" data-vouch-action="unvouch">Unvouch</button>`,
		);
	}

	return `<div class="gitbaz-vouch-actions">${buttons.join("")}</div>`;
};

const wireVouchActions = (
	container: HTMLElement,
	username: string,
	repo: RepoContext,
	issueNumber: number,
): void => {
	const buttons = container.querySelectorAll<HTMLButtonElement>("[data-vouch-action]");

	for (const btn of buttons) {
		btn.addEventListener("click", async () => {
			const action = btn.dataset.vouchAction as "vouch" | "denounce" | "unvouch";

			if (action === "denounce") {
				const existing = container.querySelector(".gitbaz-denounce-dialog");
				if (existing) {
					existing.remove();
					return;
				}

				const dialog = document.createElement("div");
				dialog.className = "gitbaz-denounce-dialog";
				dialog.innerHTML = `<input type="text" placeholder="Reason (required)" /><button>Send</button><button>Cancel</button>`;

				const actionsDiv = container.querySelector(".gitbaz-vouch-actions");
				if (actionsDiv) actionsDiv.after(dialog);

				const input = dialog.querySelector("input") as HTMLInputElement;
				const [sendBtn, cancelBtn] = dialog.querySelectorAll("button");

				cancelBtn.addEventListener("click", () => dialog.remove());
				sendBtn.addEventListener("click", async () => {
					const reason = input.value.trim();
					if (!reason) return;
					dialog.remove();
					btn.textContent = "Sending...";
					btn.disabled = true;

					const response: VouchActionResponse = await chrome.runtime.sendMessage({
						type: "POST_VOUCH_ACTION",
						repo,
						issueNumber,
						action: "denounce",
						targetUsername: username,
						reason,
					});

					btn.textContent = response.result?.success ? "Done!" : "Failed";
				});

				input.focus();
				return;
			}

			btn.textContent = "Sending...";
			btn.disabled = true;

			const response: VouchActionResponse = await chrome.runtime.sendMessage({
				type: "POST_VOUCH_ACTION",
				repo,
				issueNumber,
				action,
				targetUsername: username,
			});

			btn.textContent = response.result?.success ? "Done!" : "Failed";
		});
	}
};

const renderPullRequestContent = (ctx: PullRequestContext): string => {
	const summary = summarizePullRequest(ctx);
	const stateClass = `state-${ctx.state.toLowerCase()}`;

	const statRows = [
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Status</span>
			<span class="gitbaz-context-status ${stateClass}">${ctx.isDraft ? "Draft" : ctx.state.charAt(0) + ctx.state.slice(1).toLowerCase()}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Size</span>
			<span class="gitbaz-stat-value">${summary.sizeCategory.toUpperCase()} (+${ctx.additions} −${ctx.deletions})</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Changed files</span>
			<span class="gitbaz-stat-value">${ctx.changedFiles}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Commits</span>
			<span class="gitbaz-stat-value">${ctx.commits}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Reviews</span>
			<span class="gitbaz-stat-value">${ctx.reviewCount}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Comments</span>
			<span class="gitbaz-stat-value">${ctx.commentCount}</span>
		</div>`,
	];

	if (ctx.reviewDecision) {
		const decisionLabel =
			ctx.reviewDecision.replace(/_/g, " ").charAt(0) +
			ctx.reviewDecision.replace(/_/g, " ").slice(1).toLowerCase();
		statRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Review decision</span>
			<span class="gitbaz-stat-value">${decisionLabel}</span>
		</div>`);
	}

	if (ctx.linkedIssueCount > 0) {
		statRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Linked issues</span>
			<span class="gitbaz-stat-value">${ctx.linkedIssueCount}</span>
		</div>`);
	}

	if (summary.timeToMergeLabel) {
		statRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Time to merge</span>
			<span class="gitbaz-stat-value">${summary.timeToMergeLabel}</span>
		</div>`);
	}

	if (summary.isStale) {
		statRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Stale</span>
			<span class="gitbaz-context-status state-closed">Yes</span>
		</div>`);
	}

	const aiDetection = detectAIGenerated(ctx);
	if (aiDetection.isAIGenerated) {
		const confClass = `ai-${aiDetection.confidence}`;
		const toolStr = aiDetection.tools.join(", ");
		const tooltip = aiDetection.signals.map((s) => s.reason).join("; ");
		statRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">AI-Assisted</span>
			<span class="gitbaz-ai-indicator ${confClass}" title="${tooltip}">${toolStr}</span>
		</div>`);
	}

	const labelsHtml =
		ctx.labels.length > 0
			? `<div class="gitbaz-badges">${ctx.labels.map((l) => `<span class="gitbaz-badge">${l}</span>`).join("")}</div>`
			: "";

	const siloPlaceholder = '<div class="gitbaz-silo-placeholder"></div>';

	return `<div class="gitbaz-stats">${statRows.join("")}</div>${labelsHtml}${siloPlaceholder}`;
};

const renderSiloContent = (result: KnowledgeSiloResult): string => {
	const atRisk = result.files.filter((f) => f.risk === "critical" || f.risk === "high");
	if (atRisk.length === 0) return "";

	const fileRows = atRisk
		.map((f) => {
			const riskClass = `silo-${f.risk}`;
			const authors = f.topAuthors.join(", ") || "unknown";
			return `<div class="gitbaz-stat-row">
				<span class="gitbaz-stat-label" title="${f.path}">${f.path.split("/").pop()}</span>
				<span class="gitbaz-silo-badge ${riskClass}" title="${authors}">${f.risk} (${f.uniqueAuthors})</span>
			</div>`;
		})
		.join("");

	return `<div class="gitbaz-silo-section">
		<div class="gitbaz-silo-header">
			<span class="gitbaz-stat-label">Knowledge Silos</span>
			<span class="gitbaz-stat-value">${result.criticalCount + result.highCount} at risk</span>
		</div>
		<div class="gitbaz-silo-files">${fileRows}</div>
	</div>`;
};

const renderIssueContent = (ctx: IssueContext): string => {
	const summary = summarizeIssue(ctx);
	const stateClass = `state-${ctx.state.toLowerCase()}`;

	const statRows = [
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Status</span>
			<span class="gitbaz-context-status ${stateClass}">${ctx.state.charAt(0) + ctx.state.slice(1).toLowerCase()}</span>
		</div>`,
	];

	if (summary.resolutionLabel) {
		statRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Resolution</span>
			<span class="gitbaz-stat-value">${summary.resolutionLabel}</span>
		</div>`);
	}

	statRows.push(
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Comments</span>
			<span class="gitbaz-stat-value">${ctx.commentCount}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Participants</span>
			<span class="gitbaz-stat-value">${ctx.participantCount}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Reactions</span>
			<span class="gitbaz-stat-value">${ctx.reactionCount}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Engagement</span>
			<span class="gitbaz-stat-value">${summary.engagementLevel.charAt(0).toUpperCase() + summary.engagementLevel.slice(1)}</span>
		</div>`,
	);

	if (ctx.linkedPRCount > 0) {
		statRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Linked PRs</span>
			<span class="gitbaz-stat-value">${ctx.linkedPRCount}</span>
		</div>`);
	}

	const labelsHtml =
		ctx.labels.length > 0
			? `<div class="gitbaz-badges">${ctx.labels.map((l) => `<span class="gitbaz-badge">${l}</span>`).join("")}</div>`
			: "";

	return `<div class="gitbaz-stats">${statRows.join("")}</div>${labelsHtml}`;
};

const renderDiscussionContent = (ctx: DiscussionContext): string => {
	const summary = summarizeDiscussion(ctx);
	const stateClass = ctx.isOpen ? "state-open" : "state-closed";

	const statRows = [
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Status</span>
			<span class="gitbaz-context-status ${stateClass}">${ctx.isOpen ? "Open" : "Closed"}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Category</span>
			<span class="gitbaz-stat-value">${ctx.category}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Answered</span>
			<span class="gitbaz-stat-value">${ctx.isAnswered ? "Yes" : "No"}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Comments</span>
			<span class="gitbaz-stat-value">${ctx.commentCount}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Reactions</span>
			<span class="gitbaz-stat-value">${ctx.reactionCount}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Upvotes</span>
			<span class="gitbaz-stat-value">${ctx.upvoteCount}</span>
		</div>`,
		`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Engagement</span>
			<span class="gitbaz-stat-value">${summary.engagementLevel.charAt(0).toUpperCase() + summary.engagementLevel.slice(1)}</span>
		</div>`,
	];

	const labelsHtml =
		ctx.labels.length > 0
			? `<div class="gitbaz-badges">${ctx.labels.map((l) => `<span class="gitbaz-badge">${l}</span>`).join("")}</div>`
			: "";

	return `<div class="gitbaz-stats">${statRows.join("")}</div>${labelsHtml}`;
};

const formatTimeAgo = (dateStr: string): string => {
	const diff = Date.now() - new Date(dateStr).getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	if (days < 1) return "today";
	if (days === 1) return "1 day ago";
	if (days < 30) return `${days} days ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} mo ago`;
	const years = Math.floor(days / 365);
	return `${years} yr${years > 1 ? "s" : ""} ago`;
};

const renderBusFactor = (bf: BusFactor): string => {
	const riskClass = `bf-${bf.risk}`;
	return `<div class="gitbaz-stats"><div class="gitbaz-stat-row">
		<span class="gitbaz-stat-label">Bus factor</span>
		<span class="gitbaz-bf-indicator ${riskClass}" title="Min key developers: ${bf.factor}">${bf.factor} <span class="gitbaz-bf-risk">${bf.risk}</span></span>
	</div></div>`;
};

const renderRepoContent = (ctx: RepositoryContext): string => {
	const statRows: string[] = [];

	if (ctx.isArchived) {
		statRows.push(
			`<div class="gitbaz-stat-row"><span class="gitbaz-archived-badge">Archived</span></div>`,
		);
	}

	const detailRows: string[] = [];

	if (ctx.pushedAt) {
		detailRows.push(`<div class="gitbaz-stat-row">
			<span class="gitbaz-stat-label">Last push</span>
			<span class="gitbaz-stat-value">${formatTimeAgo(ctx.pushedAt)}</span>
		</div>`);
	}

	detailRows.push(`<div class="gitbaz-stat-row">
		<span class="gitbaz-stat-label">Created</span>
		<span class="gitbaz-stat-value">${formatTimeAgo(ctx.createdAt)}</span>
	</div>`);

	const busFactorPlaceholder = '<div class="gitbaz-bf-placeholder"></div>';

	let scorecardHtml = "";
	if (ctx.scorecard) {
		const checksHtml = ctx.scorecard.checks
			.map(
				(c) =>
					`<div class="gitbaz-stat-row"><span class="gitbaz-stat-label">${c.name}</span><span class="gitbaz-stat-value">${c.score}/10</span></div>`,
			)
			.join("");
		scorecardHtml = `<div class="gitbaz-scorecard">
			<div class="gitbaz-scorecard-header">
				<span class="gitbaz-stat-label">OSSF Scorecard</span>
				<span class="gitbaz-stat-value">${ctx.scorecard.score}/10</span>
			</div>
			<div class="gitbaz-scorecard-checks">${checksHtml}</div>
		</div>`;
	}

	return `${statRows.join("")}<div class="gitbaz-stats">${detailRows.join("")}</div>${busFactorPlaceholder}${scorecardHtml}`;
};

const renderActivityContent = (activity: ContributorActivity): string => {
	const cells = activity.weeks
		.flatMap((w) => w.days)
		.map(
			(d) =>
				`<div class="gitbaz-heatmap-cell level-${d.level}" title="${d.date}: ${d.count} contribution${d.count !== 1 ? "s" : ""}"></div>`,
		)
		.join("");

	const legendCells = [0, 1, 2, 3, 4]
		.map((l) => `<span class="gitbaz-heatmap-cell level-${l}"></span>`)
		.join("");

	return `<div class="gitbaz-activity">
		<div class="gitbaz-activity-summary">
			<span class="gitbaz-activity-total">${activity.totalContributions.toLocaleString()} contributions</span>
			<span class="gitbaz-activity-period">last year</span>
		</div>
		<div class="gitbaz-heatmap">${cells}</div>
		<div class="gitbaz-heatmap-legend">Less ${legendCells} More</div>
		<div class="gitbaz-streaks">
			<div class="gitbaz-stat-row">
				<span class="gitbaz-stat-label">Current streak</span>
				<span class="gitbaz-stat-value">${activity.streak.current} days</span>
			</div>
			<div class="gitbaz-stat-row">
				<span class="gitbaz-stat-label">Longest streak</span>
				<span class="gitbaz-stat-value">${activity.streak.longest} days</span>
			</div>
		</div>
	</div>`;
};

// --- Panel builders ---

const ICON_PR = `<svg class="gitbaz-tab-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path></svg>`;
const ICON_ISSUE = `<svg class="gitbaz-tab-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path></svg>`;
const ICON_DISCUSSION = `<svg class="gitbaz-tab-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"></path></svg>`;

const avatarIcon = (username: string) =>
	`<img class="gitbaz-tab-avatar" src="https://github.com/${username}.png?size=32" alt="@${username}" data-hovercard-type="user" data-hovercard-url="/users/${username}/hovercard" />`;

const contextIcon = (type: string) =>
	type === "pull" ? ICON_PR : type === "issue" ? ICON_ISSUE : ICON_DISCUSSION;

interface TabDef {
	id: string;
	label: string;
	icon?: string;
	content: string;
}

const buildTabbedPanel = (tabs: TabDef[], activeTab: string): string => {
	const tabButtons = tabs
		.map(
			(t) =>
				`<button class="gitbaz-tab${t.id === activeTab ? " active" : ""}" data-tab="${t.id}" title="${t.label}">${t.icon ?? t.label}</button>`,
		)
		.join("");

	const tabPanes = tabs
		.map(
			(t) =>
				`<div class="gitbaz-tab-pane${t.id === activeTab ? " active" : ""}" data-tab-pane="${t.id}">${t.content}</div>`,
		)
		.join("");

	return `
		<div class="gitbaz-panel">
			<div class="gitbaz-header">
				<div class="gitbaz-tabs">${tabButtons}</div>
			</div>
			<div class="gitbaz-tab-content">${tabPanes}</div>
		</div>
	`;
};

const buildSinglePanel = (title: string, content: string): string => `
	<div class="gitbaz-panel">
		<div class="gitbaz-header">
			<span class="gitbaz-title">${title}</span>
		</div>
		${content}
	</div>
`;

const createSetupPanel = (): string =>
	buildSinglePanel(
		"Contributor",
		`<div class="gitbaz-setup">
		<p>Set up a GitHub token to see contributor context.</p>
		<a class="gitbaz-setup-btn" href="#" id="gitbaz-open-settings">Open Settings</a>
	</div>`,
	);

const createErrorPanel = (message: string): string =>
	buildSinglePanel("Contributor", `<p class="gitbaz-error-msg">${message}</p>`);

const createLoadingPanel = (): string =>
	buildSinglePanel("Contributor", '<span class="gitbaz-loading">Loading...</span>');

// --- DOM helpers ---

const findAuthorUsername = (): string | undefined => {
	const selectors = [
		'a[data-testid="issue-body-header-author"]',
		".gh-header-meta .author a",
		".timeline-comment-header .author",
		'[data-hovercard-type="user"].author',
		'[data-hovercard-type="bot"].author',
		".pull-header-username",
		// Discussion pages: header meta author link
		'h2.timeline-comment-header-text a[data-hovercard-type="user"]',
		'.color-fg-muted > a[data-hovercard-type="user"]',
	];

	for (const selector of selectors) {
		const el = document.querySelector<HTMLAnchorElement>(selector);
		const text = el?.textContent?.trim();
		if (text) return appendBotSuffix(el, text);
	}

	const headerMeta = document.querySelector(".gh-header-meta");
	if (headerMeta) {
		const links = headerMeta.querySelectorAll<HTMLAnchorElement>(
			'a[data-hovercard-type="user"], a[data-hovercard-type="bot"]',
		);
		if (links.length > 0) {
			const text = links[0].textContent?.trim();
			if (text) return appendBotSuffix(links[0], text);
		}
	}

	return undefined;
};

const appendBotSuffix = (el: Element | null, username: string): string => {
	if (username.endsWith("[bot]")) return username;

	// GitHub renders bot authors as "dependabot" + a sibling <span class="Label">bot</span>
	if (el?.getAttribute("data-hovercard-type") === "bot") {
		return `${username}[bot]`;
	}

	// Check for adjacent "bot" label badge
	const sibling = el?.nextElementSibling;
	if (sibling?.classList.contains("Label") && sibling.textContent?.trim().toLowerCase() === "bot") {
		return `${username}[bot]`;
	}

	return username;
};

const findSidebar = (): Element | null => {
	const selectors = [
		'[data-testid="sticky-sidebar"]',
		"#partial-discussion-sidebar",
		'[data-testid="issue-sidebar"]',
		".Layout-sidebar .discussion-sidebar",
		".Layout-sidebar",
		'aside[role="complementary"]',
		".discussion-sidebar",
	];

	for (const selector of selectors) {
		const el = document.querySelector(selector);
		if (el) return el;
	}

	return null;
};

const findRepoSidebar = (): Element | null => {
	// Try standard sidebar selectors first (works on some GitHub layouts)
	const sidebarSelectors = [".Layout-sidebar", 'aside[role="complementary"]', ".BorderGrid"];

	for (const selector of sidebarSelectors) {
		const el = document.querySelector(selector);
		if (el) return el;
	}

	// Fallback: find the main content area of the repo page
	const fallbackSelectors = ["#repo-content-turbo-frame", ".repository-content", "main"];

	for (const selector of fallbackSelectors) {
		const el = document.querySelector(selector);
		if (el) return el;
	}

	return null;
};

const injectPanel = (
	html: string,
	onTabSwitch?: (tabId: string, paneEl: HTMLElement) => void,
	targetOverride?: Element | null,
): void => {
	const existing = document.getElementById(PANEL_ID);
	if (existing) {
		const parent = existing.parentElement;
		if (parent?.dataset.gitbazWrapper) parent.remove();
		else existing.remove();
	}

	const sidebar = targetOverride ?? findSidebar();
	if (!sidebar) return;

	const container = document.createElement("div");
	container.id = PANEL_ID;

	const shadow = container.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = cssText;
	shadow.appendChild(style);

	const content = document.createElement("div");
	content.innerHTML = html;
	shadow.appendChild(content);

	// Wire up "Open Settings" button
	const settingsBtn = content.querySelector("#gitbaz-open-settings");
	if (settingsBtn) {
		settingsBtn.addEventListener("click", (e) => {
			e.preventDefault();
			chrome.runtime.sendMessage({ type: "OPEN_SETTINGS" });
		});
	}

	// Wire up tab switching
	const tabs = content.querySelectorAll<HTMLButtonElement>(".gitbaz-tab");
	for (const tab of tabs) {
		tab.addEventListener("click", () => {
			const tabId = tab.dataset.tab;
			if (!tabId) return;

			for (const t of tabs) t.classList.toggle("active", t.dataset.tab === tabId);

			const panes = content.querySelectorAll<HTMLElement>(".gitbaz-tab-pane");
			for (const p of panes) p.classList.toggle("active", p.dataset.tabPane === tabId);

			// Notify lazy-load callback
			const activePane = content.querySelector<HTMLElement>(
				`.gitbaz-tab-pane[data-tab-pane="${tabId}"]`,
			);
			if (activePane && onTabSwitch) {
				onTabSwitch(tabId, activePane);
			}
		});
	}

	// Wrap container so we can position a hovercard overlay as a sibling
	const wrapper = document.createElement("div");
	wrapper.style.position = "relative";
	wrapper.dataset.gitbazWrapper = "true";
	wrapper.appendChild(container);
	sidebar.prepend(wrapper);

	// Place a real <a> with hovercard attrs in the main document over the avatar
	const avatarImg = content.querySelector<HTMLImageElement>(".gitbaz-tab-avatar");
	if (avatarImg) {
		const username = avatarImg.alt?.replace("@", "");
		if (username) {
			const overlay = document.createElement("a");
			overlay.href = `https://github.com/${username}`;
			overlay.setAttribute("data-hovercard-type", "user");
			overlay.setAttribute("data-hovercard-url", `/users/${username}/hovercard`);
			overlay.setAttribute("octo-click", "hovercard-link-click");
			overlay.setAttribute("octo-dimensions", "link_type:self");
			overlay.style.cssText = "position:absolute;border-radius:50%;z-index:1;display:block;";
			overlay.addEventListener("click", (e) => {
				e.preventDefault();
				const tabBtn = content.querySelector<HTMLButtonElement>(
					'.gitbaz-tab[data-tab="contributor"]',
				);
				tabBtn?.click();
			});
			wrapper.appendChild(overlay);

			const positionOverlay = () => {
				const ar = avatarImg.getBoundingClientRect();
				const wr = wrapper.getBoundingClientRect();
				overlay.style.left = `${ar.left - wr.left}px`;
				overlay.style.top = `${ar.top - wr.top}px`;
				overlay.style.width = `${ar.width}px`;
				overlay.style.height = `${ar.height}px`;
			};

			requestAnimationFrame(positionOverlay);
			for (const tab of content.querySelectorAll<HTMLButtonElement>(".gitbaz-tab")) {
				tab.addEventListener("click", () => requestAnimationFrame(positionOverlay));
			}
		}
	}

	// Trigger initial load for the active tab
	if (onTabSwitch) {
		const activeTab = content.querySelector<HTMLButtonElement>(".gitbaz-tab.active");
		const activePane = content.querySelector<HTMLElement>(".gitbaz-tab-pane.active");
		if (activeTab?.dataset.tab && activePane) {
			onTabSwitch(activeTab.dataset.tab, activePane);
		}
	}
};

// --- Activity loaders ---

const loadActivityIntoPane = async (paneEl: HTMLElement, username: string): Promise<void> => {
	const placeholder = paneEl.querySelector(".gitbaz-activity-placeholder");
	if (!placeholder) return;

	const response = await sendMsg<ActivityResponse>({
		type: "GET_ACTIVITY",
		username,
	});

	if (response.result) {
		placeholder.innerHTML = renderActivityContent(response.result);
	} else {
		placeholder.remove();
	}
};

const loadActivityIntoPlaceholder = (username: string): void => {
	const panel = document.getElementById(PANEL_ID);
	const shadow = panel?.shadowRoot;
	if (!shadow) return;

	const placeholder = shadow.querySelector(".gitbaz-activity-placeholder");
	if (!placeholder) return;

	(async () => {
		const response = await sendMsg<ActivityResponse>({
			type: "GET_ACTIVITY",
			username,
		});

		if (response.result) {
			placeholder.innerHTML = renderActivityContent(response.result);
		} else {
			placeholder.remove();
		}
	})();
};

// --- Helpers ---

const waitFor = async <T>(
	fn: () => T | undefined,
	maxRetries: number,
	intervalMs: number,
): Promise<T | undefined> => {
	let result = fn();
	for (let i = 0; i < maxRetries && !result; i++) {
		await new Promise((r) => setTimeout(r, intervalMs));
		result = fn();
	}
	return result;
};

// --- Safe messaging ---

const sendMsg = <T>(message: unknown): Promise<T> => {
	if (!chrome.runtime?.id) return Promise.reject(new Error("context invalidated"));
	return chrome.runtime.sendMessage(message) as Promise<T>;
};

// --- Main loader ---

let lastUrl = "";
let loadGeneration = 0;

const loadPanel = async (): Promise<void> => {
	try {
		if (!chrome.runtime?.id) return;

		const currentUrl = window.location.href;
		if (currentUrl === lastUrl && document.getElementById(PANEL_ID)) return;
		lastUrl = currentUrl;

		const generation = ++loadGeneration;
		const isStale = () => generation !== loadGeneration;

		const parsed = parseGitHubUrl(currentUrl);
		if (!parsed || parsed.type === "unknown") return;

		const tokenResponse = await sendMsg<TokenResponse>({ type: "GET_TOKEN" });
		if (isStale()) return;
		if (!tokenResponse.token) {
			injectPanel(createSetupPanel());
			return;
		}

		// Repo pages: no author detection needed, show repo context directly
		if (parsed.type === "repo") {
			const repoTarget = await waitFor(findRepoSidebar, 10, 300);
			if (!repoTarget || isStale()) return;
			injectPanel(
				buildSinglePanel("Repository", '<span class="gitbaz-loading">Loading...</span>'),
				undefined,
				repoTarget,
			);
			const repo = toRepoContext(parsed);
			const response = await sendMsg<RepoContextResponse>({
				type: "GET_REPO_CONTEXT",
				repo,
			});
			if (isStale()) return;
			if (response.result) {
				injectPanel(
					buildSinglePanel("Repository", renderRepoContent(response.result)),
					undefined,
					repoTarget,
				);
				// Async-load bus factor (separate REST call, doesn't block panel)
				const loadBusFactor = (attempt: number) => {
					sendMsg<BusFactorResponse>({
						type: "GET_BUS_FACTOR",
						repo,
					}).then((bfResponse) => {
						if (isStale()) return;
						const panel = document.getElementById(PANEL_ID);
						const placeholder = panel?.shadowRoot?.querySelector(".gitbaz-bf-placeholder");
						if (!placeholder) return;
						if (bfResponse.result) {
							placeholder.innerHTML = renderBusFactor(bfResponse.result);
						} else if (attempt < 5) {
							// GitHub returns 202 while computing stats — retry with backoff
							setTimeout(() => loadBusFactor(attempt + 1), 3000 * (attempt + 1));
						}
					});
				};
				loadBusFactor(0);
			} else {
				injectPanel(
					createErrorPanel(response.error ?? "Failed to load repository"),
					undefined,
					repoTarget,
				);
			}
			return;
		}

		// Wait for both author and sidebar to be available after turbo navigation
		const [username, sidebar] = await Promise.all([
			waitFor(findAuthorUsername, 10, 300),
			waitFor(findSidebar, 10, 300),
		]);
		if (!username || !sidebar || isStale()) return;

		// Bots: show bot panel immediately, skip API call
		const botCheck = detectBot(username);
		if (botCheck.isBot) {
			const ref = toContributionRef(parsed);
			const contextLabel =
				parsed.type === "pull"
					? "Pull Request"
					: parsed.type === "issue"
						? "Issue"
						: parsed.type === "discussion"
							? "Discussion"
							: null;

			if (ref && contextLabel) {
				const botHtml = `${renderBotContent(username)}<div class="gitbaz-activity-placeholder"></div>`;
				const tabs: TabDef[] = [
					{ id: "contributor", label: "Contributor", icon: avatarIcon(username), content: botHtml },
					{ id: "context", label: contextLabel, icon: contextIcon(parsed.type!), content: "" },
				];

				const loaded: Record<string, boolean> = { contributor: true };

				const loadTab = async (tabId: string, paneEl: HTMLElement) => {
					if (loaded[tabId]) return;
					loaded[tabId] = true;

					if (tabId === "context" && ref) {
						paneEl.innerHTML = '<span class="gitbaz-loading">Loading...</span>';
						const msgType =
							parsed.type === "pull"
								? "GET_PULL_REQUEST"
								: parsed.type === "issue"
									? "GET_ISSUE"
									: "GET_DISCUSSION";
						const response = await sendMsg<
							PullRequestResponse | IssueResponse | DiscussionResponse
						>({
							type: msgType,
							ref,
						});
						if (response.result) {
							if (parsed.type === "pull") {
								paneEl.innerHTML = renderPullRequestContent(response.result as PullRequestContext);
								const prCtx = response.result as PullRequestContext;
								if (prCtx.filePaths && prCtx.filePaths.length > 0 && ref) {
									sendMsg<BlameAnalysisResponse>({
										type: "GET_BLAME_ANALYSIS",
										repo: { owner: ref.owner, repo: ref.repo },
										filePaths: [...prCtx.filePaths],
									}).then((siloResponse) => {
										if (siloResponse.result) {
											const placeholder = paneEl.querySelector(".gitbaz-silo-placeholder");
											if (placeholder)
												placeholder.innerHTML = renderSiloContent(siloResponse.result);
										}
									});
								}
							} else if (parsed.type === "issue") {
								paneEl.innerHTML = renderIssueContent(response.result as IssueContext);
							} else {
								paneEl.innerHTML = renderDiscussionContent(response.result as DiscussionContext);
							}
						} else {
							paneEl.innerHTML = `<p class="gitbaz-error-msg">${response.error ?? "Failed to load"}</p>`;
						}
					}
				};

				injectPanel(buildTabbedPanel(tabs, "contributor"), loadTab);
				loadActivityIntoPlaceholder(username);
			} else {
				const botHtml = `${renderBotContent(username)}<div class="gitbaz-activity-placeholder"></div>`;
				injectPanel(buildSinglePanel("Contributor", botHtml));
				loadActivityIntoPlaceholder(username);
			}
			return;
		}

		injectPanel(createLoadingPanel());

		const ref = toContributionRef(parsed);
		const repo = toRepoContext(parsed);

		const contextLabel =
			parsed.type === "pull"
				? "Pull Request"
				: parsed.type === "issue"
					? "Issue"
					: parsed.type === "discussion"
						? "Discussion"
						: null;

		if (ref && contextLabel) {
			// All tabs lazy-load: render tabs immediately, load data on demand
			const loadingHtml = '<span class="gitbaz-loading">Loading...</span>';
			const tabs: TabDef[] = [
				{
					id: "contributor",
					label: "Contributor",
					icon: avatarIcon(username),
					content: loadingHtml,
				},
				{ id: "context", label: contextLabel, icon: contextIcon(parsed.type!), content: "" },
			];

			const loaded: Record<string, boolean> = {};

			const loadTab = async (tabId: string, paneEl: HTMLElement) => {
				if (loaded[tabId]) return;
				loaded[tabId] = true;

				if (tabId === "contributor") {
					paneEl.innerHTML = loadingHtml;
					const [scoreResponse, vouchResponse, collabResponse] = await Promise.all([
						sendMsg<ScoreResponse>({
							type: "GET_SCORE",
							username,
							repo,
						}),
						sendMsg<VouchStatusResponse>({
							type: "GET_VOUCH_STATUS",
							username,
							repo,
						}),
						sendMsg<CollaboratorResponse>({
							type: "CHECK_COLLABORATOR",
							repo,
						}),
					]);

					if (scoreResponse.result) {
						const isCollab = collabResponse.result === true;
						const showActions = isCollab && !!ref && !!vouchResponse.result?.hasVouchFile;

						paneEl.innerHTML = `${renderScoreContent(scoreResponse.result, {
							vouch: vouchResponse.result,
							showVouchActions: showActions,
						})}<div class="gitbaz-activity-placeholder"></div>`;

						if (showActions) {
							wireVouchActions(paneEl, username, repo, ref.number);
						}

						loadActivityIntoPane(paneEl, username);
					} else if (scoreResponse.error?.startsWith("bot:")) {
						paneEl.innerHTML = `${renderBotContent(username)}<div class="gitbaz-activity-placeholder"></div>`;
						loadActivityIntoPane(paneEl, username);
					} else {
						paneEl.innerHTML = `<p class="gitbaz-error-msg">${scoreResponse.error ?? "Failed to load"}</p>`;
					}
				} else if (tabId === "context" && ref) {
					paneEl.innerHTML = loadingHtml;
					const msgType =
						parsed.type === "pull"
							? "GET_PULL_REQUEST"
							: parsed.type === "issue"
								? "GET_ISSUE"
								: "GET_DISCUSSION";
					const response = await sendMsg<PullRequestResponse | IssueResponse | DiscussionResponse>({
						type: msgType,
						ref,
					});
					if (response.result) {
						if (parsed.type === "pull") {
							paneEl.innerHTML = renderPullRequestContent(response.result as PullRequestContext);
							const prCtx = response.result as PullRequestContext;
							if (prCtx.filePaths && prCtx.filePaths.length > 0 && ref) {
								sendMsg<BlameAnalysisResponse>({
									type: "GET_BLAME_ANALYSIS",
									repo: { owner: ref.owner, repo: ref.repo },
									filePaths: [...prCtx.filePaths],
								}).then((siloResponse) => {
									if (siloResponse.result) {
										const placeholder = paneEl.querySelector(".gitbaz-silo-placeholder");
										if (placeholder) placeholder.innerHTML = renderSiloContent(siloResponse.result);
									}
								});
							}
						} else if (parsed.type === "issue") {
							paneEl.innerHTML = renderIssueContent(response.result as IssueContext);
						} else {
							paneEl.innerHTML = renderDiscussionContent(response.result as DiscussionContext);
						}
					} else {
						paneEl.innerHTML = `<p class="gitbaz-error-msg">${response.error ?? "Failed to load"}</p>`;
					}
				}
			};

			injectPanel(buildTabbedPanel(tabs, "contributor"), loadTab);
		} else {
			// No context (not a PR/issue/discussion page) — single contributor panel
			injectPanel(createLoadingPanel());
			const [scoreResponse, vouchResponse] = await Promise.all([
				sendMsg<ScoreResponse>({
					type: "GET_SCORE",
					username,
					repo,
				}),
				sendMsg<VouchStatusResponse>({
					type: "GET_VOUCH_STATUS",
					username,
					repo,
				}),
			]);
			if (scoreResponse.error) {
				injectPanel(createErrorPanel(scoreResponse.error));
			} else if (scoreResponse.result) {
				const content = `${renderScoreContent(scoreResponse.result, {
					vouch: vouchResponse.result,
				})}<div class="gitbaz-activity-placeholder"></div>`;
				injectPanel(buildSinglePanel("Contributor", content));
				loadActivityIntoPlaceholder(username);
			}
		}
	} catch {
		// Extension context invalidated or navigation race — ignore
	}
};

export default defineContentScript({
	matches: ["https://github.com/*"],
	runAt: "document_idle",
	main: () => {
		loadPanel();

		let debounceTimer: ReturnType<typeof setTimeout> | undefined;
		const scheduleLoad = () => {
			clearTimeout(debounceTimer);
			lastUrl = "";
			debounceTimer = setTimeout(() => loadPanel(), 150);
		};

		// GitHub uses Turbo for SPA navigation
		document.addEventListener("turbo:load", scheduleLoad);
		document.addEventListener("turbo:render", scheduleLoad);
		document.addEventListener("turbo:frame-load", scheduleLoad);

		// Fallback: detect URL changes via title mutations and popstate
		const titleObserver = new MutationObserver(() => {
			if (window.location.href !== lastUrl) scheduleLoad();
		});
		titleObserver.observe(document.querySelector("head > title") ?? document.head, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		window.addEventListener("popstate", scheduleLoad);

		// Robust fallback: observe body for content changes (covers turbo-frame swaps)
		const bodyObserver = new MutationObserver(() => {
			const url = window.location.href;
			if (url !== lastUrl || !document.getElementById(PANEL_ID)) {
				scheduleLoad();
			}
		});
		bodyObserver.observe(document.body, { childList: true, subtree: true });
	},
});
