# Github-Notion Importer

Imports issues from a repository on Github to Notion.
Designed for setting up [Github-Notion Bridge](https://github.com/alpico/github-notion-bridge) which updates issues in Notion based on Github events.

## Setup

### Notion

- [Create an integration](https://www.notion.so/my-integration)
- Create an issue board.
- [Find out the user IDs of the people on the issue board](https://developers.notion.com/reference/get-users)
- Create a relation to separate the different repositories you're adding issues from in your issue board. Take note of the ID of the page holding the issues for this specific repository.
- Any further changes to the board needed will be performed automatically, so don't worry about matching a template or anything.

### Github

- [Create an access token with read permissions on the repository you want to export issues from](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

### Dotenv

Copy the `.env.example` file and fill it

```text
ts-node src/index.ts [repoOwner] [repoName] [relatedPageId]
```

For example, if the link to your repo is <https://github.com/owner/name>, and you have a related project set up in Notion under the ID `abcdef1234` then the command would be `ts-node src/index.ts owner name abcdef1234`.
