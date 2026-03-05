import type {
	BusFactor,
	BusFactorRisk,
	FileSilo,
	KnowledgeSiloResult,
	SiloRisk,
} from "../types.js";

const classifySiloRisk = (uniqueAuthors: number): SiloRisk => {
	if (uniqueAuthors === 0) return "new-file";
	if (uniqueAuthors === 1) return "critical";
	if (uniqueAuthors === 2) return "high";
	return "ok";
};

export const analyzeKnowledgeSilos = (
	blameByFile: Map<string, string[]>,
	filePaths: readonly string[],
	totalFiles: number,
): KnowledgeSiloResult => {
	const files: FileSilo[] = [];
	let criticalCount = 0;
	let highCount = 0;

	for (const path of filePaths) {
		const authors = blameByFile.get(path);
		const uniqueAuthors = authors ? authors.length : 0;
		const risk = classifySiloRisk(uniqueAuthors);

		if (risk === "critical") criticalCount++;
		if (risk === "high") highCount++;

		files.push({
			path,
			uniqueAuthors,
			risk,
			topAuthors: authors?.slice(0, 3) ?? [],
		});
	}

	return {
		files,
		criticalCount,
		highCount,
		analyzedFiles: filePaths.length,
		totalFiles,
	};
};

const classifyBusFactorRisk = (factor: number): BusFactorRisk => {
	if (factor <= 1) return "critical";
	if (factor === 2) return "high";
	if (factor <= 4) return "moderate";
	return "healthy";
};

export interface ContributorStats {
	readonly login: string;
	readonly commits: number;
}

export const computeBusFactor = (contributors: readonly ContributorStats[]): BusFactor => {
	if (contributors.length === 0) {
		return { factor: 0, risk: "critical", topContributors: [] };
	}

	const sorted = [...contributors].sort((a, b) => b.commits - a.commits);
	const totalCommits = sorted.reduce((sum, c) => sum + c.commits, 0);
	const threshold = totalCommits * 0.5;

	let removed = 0;
	let removedCommits = 0;

	for (const contributor of sorted) {
		removedCommits += contributor.commits;
		removed++;
		if (removedCommits >= threshold) break;
	}

	return {
		factor: removed,
		risk: classifyBusFactorRisk(removed),
		topContributors: sorted.slice(0, 5).map((c) => ({ login: c.login, commits: c.commits })),
	};
};
