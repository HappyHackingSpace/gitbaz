/** Fetches a single pull request by owner, repo, and number */
export const PULL_REQUEST_QUERY = `
  query PullRequestContext($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title
        state
        author { login __typename }
        headRefName
        body
        createdAt
        mergedAt
        closedAt
        isDraft
        reviewDecision
        additions
        deletions
        changedFiles
        commits(first: 20) {
          totalCount
          nodes {
            commit {
              messageHeadline
              messageBody
              author { name email }
            }
          }
        }
        reviews { totalCount }
        comments { totalCount }
        labels(first: 20) { nodes { name } }
        closingIssuesReferences { totalCount }
        files(first: 50) { nodes { path } }
      }
    }
  }
`;

/** Fetches a single issue by owner, repo, and number */
export const ISSUE_QUERY = `
  query IssueContext($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        title
        state
        stateReason
        author { login }
        createdAt
        closedAt
        comments { totalCount }
        labels(first: 20) { nodes { name } }
        timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 0) { totalCount }
        reactions { totalCount }
        participants { totalCount }
      }
    }
  }
`;

/** Fetches repository metadata */
export const REPOSITORY_QUERY = `
  query RepositoryContext($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      description
      url
      stargazerCount
      forkCount
      watchers { totalCount }
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
      primaryLanguage { name }
      licenseInfo { spdxId }
      isArchived
      isFork
      createdAt
      pushedAt
      defaultBranchRef {
        target {
          ... on Commit {
            history { totalCount }
          }
        }
      }
    }
  }
`;

/** Fetches a single discussion by owner, repo, and number */
export const DISCUSSION_QUERY = `
  query DiscussionContext($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $number) {
        title
        closed
        author { login }
        createdAt
        closedAt
        category { name }
        isAnswered
        comments { totalCount }
        reactions { totalCount }
        upvoteCount
        labels(first: 20) { nodes { name } }
      }
    }
  }
`;
