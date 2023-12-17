import { Client } from "@notionhq/client"
import { Issue, LabelName, } from "./main";
import { markdownToBlocks, markdownToRichText } from "@tryfabric/martian";
import { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { pageId, ghNotionUserMap, labelPropName, linkPropName, assigneePropName, boardColumnDefaultVal, boardColumnDoneVal, issueIcon, boardColumnPropName, relationPropName } from './config'

export async function prepareDB(notion: Client): Promise<LabelName[]> {
    let labels = await getLabels(notion);

    const labelOptions = labels.map(name => ({ name }));

    await notion.databases.update({
        database_id: pageId,
        properties: {
            [labelPropName]: { multi_select: { options: labelOptions } },
            [linkPropName]: { url: {}, },
            [assigneePropName]: { people: {}, },
        }
    });
    return labels;
}

export async function setLabels(notion: Client, labels: LabelName[]): Promise<void> {
    await notion.databases.update({
        database_id: pageId,
        properties: {
            [labelPropName]: {
                multi_select: { options: labels.map(name => ({ name })) }
            }
        }
    });
}

export async function openIssue(notion: Client, issue: Issue, relatedPage: string): Promise<void> {
    const exists = await issueExists(notion, issue);
    if (exists) {
        console.log(`Skipping issue ${issue.title}`);
        return;
    } else {
        console.log(`Opening issue ${issue.title}`);
    }
    const assignees = issue.assignees.map(login => ({ id: ghNotionUserMap[login] })) ?? {};
    const newPage = await notion.pages.create({
        parent: { database_id: pageId },
        "icon": { external: { url: issueIcon } },
        properties: {
            "title": { title: [{ text: { content: issue.title } }] },
            [linkPropName]: { url: issue.url },
            [boardColumnPropName]: { status: { name: issue.isOpen ? boardColumnDefaultVal : boardColumnDoneVal } },
            [labelPropName]: { multi_select: issue.labels.map(name => ({ name })) },
            [assigneePropName]: { people: assignees },
            [relationPropName]: { relation: [{id : relatedPage }] },
        },
        children: markdownToBlocks(issue.body) as Array<BlockObjectRequest>,
    });
    const newPageId = newPage.id;
    // Do this synchronously to get the right order
    for (const comment of issue.comments) {
        const header = `[@${comment.author.login}](${comment.author.url}) [commented](${comment.url}): `;
        await notion.comments.create({
            parent: { page_id: newPageId },
            rich_text: markdownToRichText(header + comment.body),
        })
    }
}

async function issueExists(notion: Client, issue: Issue): Promise<boolean> {
    const response = await notion.databases.query({
        database_id: pageId,
        filter: {
            property: linkPropName,
            url: { equals: issue.url }
        }
    })
    return response.results.length !== 0;
}

async function getLabels(notion: Client): Promise<LabelName[]> {
    const response = await notion.databases.retrieve({ database_id: pageId });
    let labels = (response.properties[labelPropName] as any)?.multi_select?.options?.map((elem: any) => elem["name"]) ?? undefined;
    return labels ? labels : [];
}
