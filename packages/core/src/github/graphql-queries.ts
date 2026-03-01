/** Fetches user profile stats, contribution data, and calendar in a single GraphQL call */
export const USER_STATS_QUERY = `
  query UserStats($login: String!) {
    user(login: $login) {
      createdAt
      followers { totalCount }
      repositories(privacy: PUBLIC) { totalCount }
      contributionsCollection {
        totalCommitContributions
        restrictedContributionsCount
        contributionCalendar {
          weeks {
            contributionDays {
              contributionCount
            }
          }
        }
      }
      pullRequests(states: MERGED) { totalCount }
      allPullRequests: pullRequests { totalCount }
      organizations(first: 10) {
        nodes {
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

/** Fetches contribution calendar heatmap data for the last year */
export const USER_ACTIVITY_QUERY = `
  query UserActivity($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;
