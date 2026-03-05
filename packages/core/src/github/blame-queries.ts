export const MAX_BLAME_FILES = 30;

export const escapeGraphQLString = (value: string): string =>
	value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const buildBlameQuery = (
	owner: string,
	repo: string,
	branch: string,
	filePaths: readonly string[],
): string => {
	const limited = filePaths.slice(0, MAX_BLAME_FILES);

	const fragments = limited
		.map((filePath, i) => {
			const escaped = escapeGraphQLString(filePath);
			return `    file${i}: blame(path: "${escaped}") {
      ranges {
        commit { author { user { login } } }
        startingLine
        endingLine
      }
    }`;
		})
		.join("\n");

	const escapedOwner = escapeGraphQLString(owner);
	const escapedRepo = escapeGraphQLString(repo);
	const escapedBranch = escapeGraphQLString(branch);

	return `query BlameAnalysis {
  repository(owner: "${escapedOwner}", name: "${escapedRepo}") {
    ref: object(expression: "${escapedBranch}") {
      ... on Commit {
${fragments}
      }
    }
  }
}`;
};
