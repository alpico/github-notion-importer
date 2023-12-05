import { graphql } from "@octokit/graphql";
import { config } from "dotenv";
import { Client } from "@notionhq/client";
import { openIssue, prepareDB, setLabels } from "./notion";

config();
const ghTokenTmp = process.env.GITHUB_API_TOKEN;
if (!ghTokenTmp) {
    throw new Error("Please add a Github access token to your .env file");
}
const ghToken = ghTokenTmp!;
const pageIdTmp = process.env.NOTION_PAGE_ID;
if (!pageIdTmp) {
    throw new Error("Please add a pageId to your .env file");
}
export const pageId = pageIdTmp!;
const apiKeyTmp = process.env.NOTION_API_KEY!;
if (!apiKeyTmp) {
    throw new Error("Please add a notion API key to your .env file");
}
const apiKey = apiKeyTmp!;
export const labelPropName = process.env.GH_LABEL_PROP_NAME ?? "Github Labels";
export const linkPropName = process.env.GH_LINK_PROP_NAME ?? "Github Link";
export const repoPropName = process.env.GH_LABEL_PROP_NAME ?? "Repository";
export const assigneePropName = process.env.ASSIGNEE_PROP_NAME ?? "Assignees";
export const boardColumnPropName = process.env.BOARD_COLUMN_PROP_NAME ?? "Status";
export const boardColumnDefaultVal = process.env.BOARD_COLUMN_DEFAULT_VAL ?? "Backlog";
export const boardColumnDoneVal = process.env.BOARD_COLUMN_DONE_VAL ?? "Done";
export const ghNotionUserMap = JSON.parse(process.env.GITHUB_NOTION_USER_MAP ?? "");
export const issueIcon = process.env.NOTION_ISSUE_ICON ?? "https://www.notion.so/images/external_integrations/github-icon.png";

export type Username = string;
export type LabelName = string;
export type Url = string;
export type User = {
    login: Username,
    url: Url,
}
export type Comment = {
    author: User,
    body: string,
    url: string,
}
export type Issue = {
    assignees: Username[],
    labels: LabelName[],
    body: string,
    title: string,
    isOpen: boolean,
    url: Url,
    comments: Comment[],
}

export async function run(): Promise<void> {
    const repoOwner = process.argv[2];
    if (!repoOwner) {
        throw new Error("Please enter your github repo's owner");
    }
    const repoName = process.argv[3];
    if (!repoName) {
        throw new Error("Please enter your github repo's name");
    }

    const notionClient = new Client({ auth: apiKey });
    let labels = await prepareDB(notionClient, repoName);

    let next = undefined;
    while (true) {
        const paginatedResponse = await paginatedIssues(repoName, repoOwner, next);
        const issues = paginatedResponse.issues;
        await updateLabels(notionClient, labels, issues);
        issues.forEach(async issue => await openIssue(notionClient, issue, repoName))
        next = paginatedResponse.next;
        if (!next) {
            break;
        }
    }
}

async function updateLabels(notionClient: Client, labels: LabelName[], issues: Issue[]) {
    issues.forEach(issue => {
        issue.labels.forEach(issueLabel => {
            if (!labels.find(label => issueLabel === label)) {
                labels.push(issueLabel)
            }
        })
    })
    await setLabels(notionClient, labels);
}

type PaginatedRepositoryResponse = {
    repository: {
        issues: {
            pageInfo: {
                startCursor: string,
                hasPreviousPage: boolean,
            }
            edges: [{
                node: IssueResponse,
            }]
        }
    }
};

type IssueResponse = {
    assignees: { nodes: [{ login: Username }] }
    labels: { nodes: [{ name: LabelName }] }
    body: string,
    title: string,
    url: Url,
    state: "OPEN" | "CLOSED",
    comments: { nodes: [Comment] }
}

function issue_from_issue_response(response: IssueResponse): Issue {
    const ret = {
        assignees: response.assignees.nodes.map(elem => elem.login),
        labels: response.labels.nodes.map(elem => elem.name),
        body: response.body,
        title: response.title,
        isOpen: response.state == "OPEN",
        url: response.url,
        comments: response.comments.nodes,
    };
    return ret;
}

type PaginatedIssueResult = {
    issues: Issue[],
    next: string | undefined,
}

async function paginatedIssues(repoName: string, repoOwner: string, next: string | undefined): Promise<PaginatedIssueResult> {
    const response = await graphql({
        query: `
        query issues($repoName: String!, $repoOwner: String!, $before: String, $issuePagination: Int!, $labelCutoff: Int!, $commentCutoff: Int!, $assigneeCutoff: Int!) {
            repository(name: $repoName, owner: $repoOwner) {
              issues(last: $issuePagination, before: $before) {
                pageInfo {
                  startCursor
                  hasPreviousPage
                }
                edges {
                  node {
                    assignees(last: $assigneeCutoff) {
                      nodes {
                        login,
                      }
                    }
                    labels(last: $labelCutoff) {
                      nodes {
                        name
                      }
                    }
                    body,
                    title,
                    url,
                    state,
                    comments(last: $commentCutoff) {
                      nodes {
                        author {
                          login,
                          url,
                        }
                        body,
                        url,
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        repoName: repoName,
        repoOwner: repoOwner,
        before: next,
        issuePagination: 50,
        labelCutoff: 50,
        commentCutoff: 100,
        assigneeCutoff: 50,
        headers: {
            authorization: `token ${ghToken}`
        }
    }) as PaginatedRepositoryResponse;
    const paginator = response.repository.issues;
    const issues = paginator.edges.map(issue => issue_from_issue_response(issue.node));
    const ret = {
        issues: issues,
        next: paginator.pageInfo.hasPreviousPage ? paginator.pageInfo.startCursor : undefined,
    }
    return ret;
}
