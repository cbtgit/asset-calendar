---
name: Assign agents to unblocked issues
description: Assign Copilot to actionable issues after a merged pull request removes their final blocker.
on:
  pull_request:
    types: [closed]
permissions:
  contents: read
  issues: read
  pull-requests: read
engine: copilot
safe-outputs:
  assign-to-agent:
    name: copilot
    allowed: [copilot]
    max: 5
    target: "*"
---

# Assign agents to unblocked issues

Run only when the triggering pull request was merged. Read the triggering pull
request with the GitHub tools and verify its `merged` field is `true`; if it is
not, stop without making safe-output calls.

Use the GitHub tools to inspect the merged pull request and identify every issue
that it actually resolved. Prefer the pull request's linked closing issues and
GitHub's issue-dependency data. Treat an issue reference in the pull request
body as resolved only when it uses a closing keyword such as `fixes`, `closes`,
or `resolves`; do not treat ordinary references as resolved issues.

For each resolved issue:

1. Find open issues that are explicitly blocked by it. Use GitHub's issue
   dependency search and inspect each candidate issue; do not infer a blocker
   relationship from a shared label or an ordinary issue mention.
2. Confirm that the resolved issue was the candidate's final open blocker. If
   another blocker remains open, do not assign an agent yet.
3. Select only actionable issue items, not pull requests or discussions. Skip
   closed issues and issues already assigned to the Copilot coding agent.
4. Read the candidate issue body so the assignment is based on its complete,
   current requirements.

Assign each remaining unblocked issue, up to the configured safe-output limit,
using the `assign_to_agent` tool from the `safeoutputs` MCP server:

```text
safeoutputs/assign_to_agent(
  issue_number=<unblocked_issue_number>,
  agent="copilot",
  rationale="The merged pull request removed the issue's final blocker.",
  confidence="HIGH"
)
```

Use the exact numeric issue number and never pass a pull request number to this
tool. If no issue is clearly and fully unblocked, do not make an assignment.
