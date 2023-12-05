import { graphql  } from "@octokit/graphql";
import { config } from "dotenv";

config()

export type Issue = {
    assignees: Username[],
    labels: LabelName[],
    body: string,
    title: string,
    isOpen: boolean,
    comments: Comment[],
}

export async function run(): Promise<void> {
    const repoOwner = process.argv[2];
    const repoName = process.argv[3];

    let next = undefined;
    while (true) {
        const paginatedResponse = await paginatedIssues(repoName, repoOwner, next);
        const issues = paginatedResponse.issues;
        issues.forEach(issue => console.log(issue.title))
        next = paginatedResponse.next;
        if (!next) {
            break;
        }
    }
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

type Username = string;
type LabelName = string;
type Url = string;
type User = {
    login: Username,
    url: Url,
}
type Comment = {
    author: User,
    body: string,
    url: string,
}

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
        comments: response.comments.nodes,
    };
    return ret;
}

type PaginatedIssueResult = {
    issues: Issue[],
    next: string | undefined,
}

async function paginatedIssues(repoName: string, repoOwner: string, next: string | undefined): Promise<PaginatedIssueResult> {
    const token = process.env.GITHUB_API_TOKEN;
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
            authorization: `token ${token}`
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
