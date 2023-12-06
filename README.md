# Github-Notion Importer

Imports issues from a repository on Github to Notion.
Designed for setting up [Github-Notion Bridge](https://github.com/alpico/github-notion-bridge) which updates issues in Notion based on Github events.

## Setup

### Notion

- [Create an integration](https://www.notion.so/my-integration)
- Create an issue board. Any further changes to the board needed will be performed automatically, so don't worry about matching a template or anything.

### Github
- [Create an access token]()

### Dotenv

Copy the `.env.example` file and fill it



```text
ts-node src/index.ts [repoOwner] [repoName]
```

For example, if the link to your repo is <https://github.com/owner/name>, then the command would be `ts-node src/index.ts owner name`.
