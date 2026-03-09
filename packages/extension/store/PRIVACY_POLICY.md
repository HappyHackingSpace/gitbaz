# Privacy Policy - GitBaz Chrome Extension

**Last updated:** March 9, 2026

## Overview

GitBaz is an open-source Chrome extension that displays contributor context on GitHub pages. We are committed to protecting your privacy.

## Data Collection

GitBaz does **not** collect, transmit, or store any personal data on external servers. The extension operates entirely within your browser.

## Data Storage

The following data is stored **locally** in your browser using `chrome.storage.local`:

- **GitHub Personal Access Token (PAT):** Used to authenticate API requests. Stored only on your device and never transmitted to any server other than `api.github.com`.
- **Cached API responses:** Contributor scores, repository data, and related metadata are cached locally to reduce API calls. Cache entries expire automatically.

## External Services

The extension communicates with the following third-party APIs to provide its functionality:

| Service | URL | Purpose |
|---------|-----|---------|
| GitHub API | `api.github.com` | Contributor data, PRs, issues, discussions |
| OSV (Google) | `api.osv.dev` | Vulnerability database lookups |
| OpenSSF Best Practices | `bestpractices.dev` | Repository security scorecard |
| OSS-Fuzz (Google) | `oss-fuzz-build-logs.storage.googleapis.com` | Fuzz testing coverage data |

All requests are made directly from your browser. No data passes through any intermediary server operated by GitBaz.

## Permissions

- **`storage`**: Used to store your PAT and cache API responses locally.
- **Host permissions**: Required to make API calls to the services listed above and to inject contributor panels on GitHub pages.

## Data Sharing

GitBaz does **not** share, sell, or transfer any user data to third parties.

## Open Source

GitBaz is fully open source. You can audit the code at: https://github.com/happyhackingspace/gitbaz

## Changes

If this policy changes, the updated version will be published in the repository and the extension listing.

## Contact

For questions about this privacy policy, open an issue at: https://github.com/happyhackingspace/gitbaz/issues
