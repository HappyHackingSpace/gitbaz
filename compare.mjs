import { computeScorecard } from "./packages/core/node_modules/@happyhackingspace/scorecard/dist/index.js";

const token = process.env.GITHUB_TOKEN;

// Fresh OSSF scores from https://api.securityscorecards.dev
const ossfScores = {
	nuclei: {
		overall: 5.7,
		checks: {
			"Code-Review": 6,
			"Dangerous-Workflow": 10,
			Maintained: 10,
			"CII-Best-Practices": 0,
			Packaging: -1,
			"Token-Permissions": 0,
			"Binary-Artifacts": 10,
			Fuzzing: 0,
			License: 10,
			"Branch-Protection": -1,
			"Security-Policy": 10,
			"Pinned-Dependencies": 0,
			"Signed-Releases": 0,
			SAST: 8,
		},
	},
	kubernetes: {
		overall: 7.6,
		checks: {
			"Code-Review": 10,
			Maintained: 10,
			Packaging: -1,
			"Dangerous-Workflow": -1,
			"Token-Permissions": -1,
			"Security-Policy": 10,
			"CII-Best-Practices": 5,
			"Branch-Protection": -1,
			License: 10,
			"Signed-Releases": -1,
			Fuzzing: 10,
			"Binary-Artifacts": 10,
			SAST: 0,
			"Pinned-Dependencies": 0,
		},
	},
};

// OSSF risk weights
const RISK_WEIGHTS = { Critical: 10, High: 7.5, Medium: 5, Low: 2.5 };
const CHECK_RISKS = {
	Maintained: "High",
	"Dependency-Update-Tool": "High",
	"Binary-Artifacts": "High",
	"Branch-Protection": "High",
	"CI-Tests": "Low",
	"CII-Best-Practices": "Low",
	"Code-Review": "High",
	Contributors: "Low",
	Fuzzing: "Medium",
	Packaging: "Medium",
	"Pinned-Dependencies": "Medium",
	SAST: "Medium",
	"Security-Policy": "Medium",
	"Signed-Releases": "High",
	"Token-Permissions": "High",
	Vulnerabilities: "High",
	"Dangerous-Workflow": "Critical",
	License: "Low",
};

function computeFilteredAggregate(checks, ossfCheckNames) {
	let weightedSum = 0;
	let totalWeight = 0;
	for (const c of checks) {
		if (c.score < 0) continue;
		if (!ossfCheckNames.includes(c.name)) continue;
		const w = RISK_WEIGHTS[CHECK_RISKS[c.name]];
		if (!w) continue;
		weightedSum += w * c.score;
		totalWeight += w;
	}
	if (totalWeight === 0) return 0;
	return Math.round((weightedSum / totalWeight) * 10) / 10;
}

async function run(owner, repo) {
	const result = await computeScorecard(owner, repo, { token });
	const ossf = ossfScores[repo];
	const ossfCheckNames = Object.keys(ossf.checks);
	const filteredScore = computeFilteredAggregate(result.checks, ossfCheckNames);

	let mismatchCount = 0;
	console.log(`\n=== ${repo.toUpperCase()} ===`);
	console.log(
		`Ours (all ${result.checks.length}): ${result.score} | Ours (${ossfCheckNames.length} OSSF checks): ${filteredScore} | OSSF: ${ossf.overall}`,
	);
	console.log("Check".padEnd(25) + "Ours".padStart(4) + "OSSF".padStart(5) + "Delta".padStart(6));
	console.log("-".repeat(45));
	for (const c of result.checks) {
		const o = ossf.checks[c.name];
		const delta = o != null ? c.score - o : "";
		const oStr = o != null ? String(o) : "n/a";
		const marker = delta === 0 || delta === "" ? "" : " <<<";
		if (marker) mismatchCount++;
		console.log(
			c.name.padEnd(25) +
				String(c.score).padStart(4) +
				oStr.padStart(5) +
				String(delta).padStart(6) +
				marker,
		);
	}
	console.log(
		`\nMismatches: ${mismatchCount} | Aggregate delta (filtered): ${(filteredScore - ossf.overall).toFixed(1)}`,
	);
}

const ossfExpress = {
	overall: 8.7,
	checks: {
		"Dangerous-Workflow": 10,
		Packaging: -1,
		"Token-Permissions": 10,
		"Dependency-Update-Tool": 10,
		"Binary-Artifacts": 10,
		"Code-Review": 8,
		"Pinned-Dependencies": 6,
		Maintained: 10,
		Vulnerabilities: 10,
		"CII-Best-Practices": 0,
		License: 10,
		"Branch-Protection": -1,
		Fuzzing: 0,
		"Signed-Releases": -1,
		"Security-Policy": 10,
		SAST: 10,
		"CI-Tests": 10,
		Contributors: 10,
	},
};
ossfScores.express = ossfExpress;

await run("projectdiscovery", "nuclei");
await run("kubernetes", "kubernetes");
await run("expressjs", "express");
