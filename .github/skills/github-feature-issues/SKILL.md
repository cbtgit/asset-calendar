---
name: github-feature-issues
description: "Create and reconcile a feature issue and implementation sub-issues in GitHub. Use when publishing feature breakdowns, creating parent and child issues, linking sub-issues, adding blocked-by dependencies, or verifying a GitHub issue graph."
argument-hint: "Describe the feature, issue breakdown, and dependency graph to publish"
---

# Publish GitHub Feature Issues

Create a feature issue and its implementation issues in a repository, establish
actual GitHub parent/sub-issue relationships, add blocked-by dependencies, and
read the result back for verification.

## Inputs

Before writing, identify:

- The target repository, from the user's request or the current Git remote.
- The feature identifier and title.
- The feature scope, completion outcome, and explicit out-of-scope boundary.
- Each child issue's identifier, title, description, completion outcome, and
  dependencies.
- The dependency direction: an issue's `Depends on` entries are the issues
  that block it.
- Requested labels, or the repository's existing label conventions when the
  user has not specified them.

Do not invent product scope, GitHub metadata, labels, assignees, milestones, or
relationships that are not present in the feature contract. If an essential
part of the issue graph is ambiguous, ask before publishing.

## Procedure

### 1. Establish the write boundary

1. Read local repository instructions and the source feature specification.
2. Confirm the target repository from `git remote -v` or an explicit repository
   argument. Never infer a different repository from a similarly named project.
3. Confirm GitHub authentication and issue support with the available GitHub
   client.
4. Inspect existing issues and labels. Search exact feature and child titles
   before creating anything.
5. If an exact title already exists, do not create a duplicate. Report the
   existing issue and ask whether the user wants reconciliation or a new title.

### 2. Prepare the issue plan

Create a compact plan before any mutation:

```text
Parent: F0 - Feature title
Children:
  T01 - Child title - depends on: F03
  T02 - Child title - depends on: T01
  T03 - Child title - depends on: T01, T02
```

Keep each child within the requested feature boundary. A child issue should
contain:

- A concise description of the implementation work.
- A `Depends on` section naming its blockers.
- A `When this issue is done, the user can` outcome.
- A scope boundary when adjacent work is easy to accidentally include.

The parent issue should contain the feature contract, completion outcome, source
planning reference, and a note that the child issues will be attached as
sub-issues. A dependency written in the body is useful context but is not a
substitute for a GitHub blocked-by relationship.

### 3. Create and validate the parent

1. Create the parent feature issue with the repository's established feature
   labels. Prefer `gh issue create` with `--body-file -` for multiline bodies.
2. Record its issue number, URL, and internal numeric issue ID.
3. Read the issue back and verify title, state, labels, and body before creating
   children.
4. Add any dependency explicitly declared for the feature itself. The current
   issue is the blocked issue; the dependency issue is the blocker.

GitHub's relationship APIs require the internal numeric issue ID for writes,
not the human-facing issue number.

### 4. Create the child issues

Create child issues in dependency order when practical. For every child, record
its issue number, URL, and internal numeric issue ID. Use the repository's
existing child label convention and preserve the issue text from the approved
feature breakdown.

After creation, read all child issues back and verify that every expected child
exists exactly once with the intended title and labels. Stop and repair the
current slice if creation or validation fails; do not continue as though a
failed API call succeeded.

### 5. Establish the parent/sub-issue hierarchy

Use GitHub's sub-issue REST endpoint for each child:

```text
POST /repos/{owner}/{repo}/issues/{parent_number}/sub_issues
{"sub_issue_id": <child_internal_id>}
```

Do not rely on checklist links in the issue body as the hierarchy. After all
links are added, verify both:

- Listing sub-issues on the parent returns exactly the expected child issue
  numbers.
- Getting the parent for each child returns the intended parent number.

### 6. Add blocked-by relationships

For every declared `Depends on` edge, add a real blocked-by relationship:

```text
POST /repos/{owner}/{repo}/issues/{blocked_number}/dependencies/blocked_by
{"issue_id": <blocking_internal_id>}
```

The direction is important:

```text
current issue depends on blocker
current issue is blocked by blocker
```

Add only declared dependency edges. Do not treat parent/sub-issue membership as
an automatic blocked-by edge. If the feature contract says the parent depends
on an earlier feature, add that relationship to the parent as well.

Read back `/dependencies/blocked_by` for every parent and child and compare the
returned issue numbers with the planned graph. A successful HTTP response from
one request does not prove the complete graph is correct.

### 7. Report the result

Summarize:

- The parent issue link.
- Every child issue link.
- The verified parent/sub-issue relationship.
- The verified blocked-by graph, grouped by blocked issue.
- Any existing issues reused, unresolved ambiguity, or relationship that could
  not be created.

Do not claim completion until the final read-back matches the planned graph.
Mention unrelated local worktree changes but do not revert them.

## Failure and recovery rules

- Use fail-fast API handling. Never print a success message after a failed
  mutation.
- If a batch partially succeeds, query GitHub first and add only missing
  relationships. Do not create duplicate issues or duplicate links.
- If a relationship endpoint rejects input, confirm whether it expects an
  internal issue ID or issue number before retrying.
- Do not edit an existing issue body, labels, or relationships unless the user
  explicitly requested reconciliation.
- Never include tokens, passwords, SMTP credentials, or other secrets in issue
  bodies or command output.
- Do not close, assign, label, milestone, or comment on issues unless that is
  part of the user's request or the approved issue metadata.

## Completion checklist

- [ ] Target repository and authentication verified.
- [ ] Existing exact titles checked; duplicates avoided.
- [ ] Parent feature created and read back.
- [ ] All child issues created and read back.
- [ ] Every child attached as a sub-issue of the parent.
- [ ] Every child reports the intended parent.
- [ ] Every declared dependency has a blocked-by relationship.
- [ ] Final relationship read-back matches the planned graph.
- [ ] Final report includes clickable issue links and any residual limitations.
