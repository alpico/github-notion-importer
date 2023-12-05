import { Client } from "@notionhq/client"
import { Issue, LabelName, pageId } from "./main";
import { markdownToBlocks, markdownToRichText } from "@tryfabric/martian";
import { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

export async function prepareDB(notion: Client, repoName: string): Promise<LabelName[]> {
    let { labels, repos } = await getChangingProperties(notion);

    if (repos.find((elem: string) => elem === repoName) === undefined) {
        repos.push(repoName);
    }
    const repoOptions = repos.map(name => ({ name }));
    const labelOptions = labels.map(name => ({ name }));

    await notion.databases.update({
        database_id: pageId,
        properties: {
            "Repository": {
                select: { options: repoOptions }
            },
            "Github Labels": {
                multi_select: { options: labelOptions }
            },
            "Github Link": {
                url: {},
            },
            "Assignees": {
                people: {},
            }
        }
    });
    return labels;
}

export async function setLabels(notion: Client, labels: LabelName[]): Promise<void> {
    await notion.databases.update({
        database_id: pageId,
        properties: {
            "Github Labels": {
                multi_select: {
                    options: labels.map(name => ({ name })),
                }
            }
        }
    });
}

const notionUserFromGithubUsername: Record<string, string> = {
    "aDogCalledSpot": "30486824-964a-49ae-a41b-a4640bcf8721",
    "s1lken": "341ec851-6b7d-4c51-a3fd-5749dde48c4a",
    "vmmon": "2be252ea-83d1-418e-b4fb-ce130654bf63",
    "tpotie": "1f8bdbea-1aca-48f8-9801-7937c1ab7e4c",
}


export async function openIssue(notion: Client, issue: Issue, repoName: string): Promise<void> {
    const assignees = issue.assignees.map(login => ({ id: notionUserFromGithubUsername[login] }))
    const newPage = await notion.pages.create({
        parent: {
            database_id: pageId,
        },
        "icon": {
            external: {
                url: "https://www.notion.so/images/external_integrations/github-icon.png",
            }
        },
        properties: {
            "title": { title: [{ text: { content: issue.title } }] },
            "Github Link": { url: issue.url },
            "Tags": { status: { name: issue.isOpen ? "Backlog" : "Done" } },
            "Repository": { select: { name: repoName } },
            "Github Labels": { multi_select: issue.labels.map(name => ({ name })) },
            "Assignees": { people: assignees },
        },
        children: markdownToBlocks(issue.body) as Array<BlockObjectRequest>,
    }) as any;
    const newPageId = newPage.id;
    // Do this synchronously to get the right order
    for (const comment of issue.comments) {
        const header = `[@${comment.author.login}](${comment.author.url}) [commented](${comment.url})\n\n`;
        console.log(header + comment.body);
        await notion.comments.create({
            parent: {
                page_id: newPageId,
            },
            rich_text: markdownToRichText(header + comment.body),
        })
    }
}

type ChangingProperties = {
    labels: LabelName[],
    repos: string[],
}

async function getChangingProperties(notion: Client): Promise<ChangingProperties> {
    const response = await notion.databases.retrieve({ database_id: pageId });
    let labels = (response.properties["Github Labels"] as any)?.multi_select?.options?.map((elem: any) => elem["name"]) ?? undefined;
    let repos = (response.properties["Repository"] as any)?.select?.options?.map((elem: any) => elem["name"]) ?? undefined;
    repos = repos ? repos : [];
    labels = labels ? labels : [];
    return { labels, repos };
}
