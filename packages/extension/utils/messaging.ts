import type {
	BusFactor,
	ContributionRef,
	ContributorActivity,
	DiscussionContext,
	IssueContext,
	KnowledgeSiloResult,
	PullRequestContext,
	RepoContext,
	RepositoryContext,
	ScoreResult,
	VouchAction,
	VouchActionResult,
	VouchLookupResult,
} from "@happyhackingspace/gitbaz";

export interface ScoreRequest {
	type: "GET_SCORE";
	username: string;
	repo?: RepoContext;
}

export interface ScoreResponse {
	type: "SCORE_RESULT";
	result?: ScoreResult;
	error?: string;
}

export interface PullRequestRequest {
	type: "GET_PULL_REQUEST";
	ref: ContributionRef;
}

export interface PullRequestResponse {
	type: "PULL_REQUEST_RESULT";
	result?: PullRequestContext;
	error?: string;
}

export interface IssueRequest {
	type: "GET_ISSUE";
	ref: ContributionRef;
}

export interface IssueResponse {
	type: "ISSUE_RESULT";
	result?: IssueContext;
	error?: string;
}

export interface DiscussionRequest {
	type: "GET_DISCUSSION";
	ref: ContributionRef;
}

export interface DiscussionResponse {
	type: "DISCUSSION_RESULT";
	result?: DiscussionContext;
	error?: string;
}

export interface TokenRequest {
	type: "GET_TOKEN" | "SET_TOKEN" | "CLEAR_TOKEN";
	token?: string;
}

export interface TokenResponse {
	type: "TOKEN_RESULT";
	token?: string;
	success?: boolean;
}

export interface VouchStatusRequest {
	type: "GET_VOUCH_STATUS";
	username: string;
	repo: RepoContext;
}

export interface VouchStatusResponse {
	type: "VOUCH_STATUS_RESULT";
	result?: VouchLookupResult;
	error?: string;
}

export interface CollaboratorRequest {
	type: "CHECK_COLLABORATOR";
	repo: RepoContext;
}

export interface CollaboratorResponse {
	type: "COLLABORATOR_RESULT";
	result?: boolean;
	error?: string;
}

export interface VouchActionRequest {
	type: "POST_VOUCH_ACTION";
	repo: RepoContext;
	issueNumber: number;
	action: VouchAction;
	targetUsername: string;
	reason?: string;
}

export interface VouchActionResponse {
	type: "VOUCH_ACTION_RESULT";
	result?: VouchActionResult;
	error?: string;
}

export interface ActivityRequest {
	type: "GET_ACTIVITY";
	username: string;
}

export interface ActivityResponse {
	type: "ACTIVITY_RESULT";
	result?: ContributorActivity;
	error?: string;
}

export interface RepoContextRequest {
	type: "GET_REPO_CONTEXT";
	repo: RepoContext;
}

export interface RepoContextResponse {
	type: "REPO_CONTEXT_RESULT";
	result?: RepositoryContext;
	error?: string;
}

export interface BusFactorRequest {
	type: "GET_BUS_FACTOR";
	repo: RepoContext;
}

export interface BusFactorResponse {
	type: "BUS_FACTOR_RESULT";
	result?: BusFactor | null;
	error?: string;
}

export interface BlameAnalysisRequest {
	type: "GET_BLAME_ANALYSIS";
	repo: RepoContext;
	filePaths: string[];
}

export interface BlameAnalysisResponse {
	type: "BLAME_ANALYSIS_RESULT";
	result?: KnowledgeSiloResult;
	error?: string;
}

export interface OpenSettingsRequest {
	type: "OPEN_SETTINGS";
}

export type ExtensionMessage =
	| ScoreRequest
	| PullRequestRequest
	| IssueRequest
	| DiscussionRequest
	| ActivityRequest
	| RepoContextRequest
	| TokenRequest
	| VouchStatusRequest
	| CollaboratorRequest
	| VouchActionRequest
	| BusFactorRequest
	| BlameAnalysisRequest
	| OpenSettingsRequest;

export type ExtensionResponse =
	| ScoreResponse
	| PullRequestResponse
	| IssueResponse
	| DiscussionResponse
	| ActivityResponse
	| RepoContextResponse
	| TokenResponse
	| VouchStatusResponse
	| CollaboratorResponse
	| VouchActionResponse
	| BusFactorResponse
	| BlameAnalysisResponse;
