---
name: memorix-memory
description: Use when prior workspace context, past decisions, solved bugs, handoff state, or durable project knowledge would help a coding task.
---

# Memorix Memory

Use Memorix as the shared memory layer for the active workspace when Memorix tools are available.

## Tool Router

| Situation | Prefer | CLI fallback |
|---|---|---|
| Starting a coding task and needing the best task-lensed project map | `memorix_project_context` with the user's task | `memorix context "<task>" --fallback --brief-json` |
| Continuing prior project work | `memorix_project_context` with the user's task | `memorix resume "<task>" --fallback --brief-json` |
| Need structured refs/freshness for code-bound memories | `memorix_context_pack` | `memorix codegraph context-pack --task "<topic>"` |
| Explicit memory graph question | `memorix_graph_context` | `memorix memory graph-context --query "<topic>"` |
| Specific past decision, bug, file, or change | `memorix_search` | `memorix memory search --query "<topic>"` |
| Need the full source for a search hit | `memorix_detail` | `memorix memory detail --id <id>` |
| Need the sequence around one memory | `memorix_timeline` | `memorix memory timeline --id <id>` |
| Check source and freshness for a memory | `memorix_evidence` | `memorix evidence list|get|events` |
| Record whether a memory helped, conflicted, or was corrected | `memorix_feedback` | `memorix feedback record|show|audit` |
| Track task requirements, decisions, verification, and outcome | `memorix_continuity` | `memorix continuity start|record|show|close` |
| Inspect or import controlled media | `memorix_media` | `memorix media import|attach|list|show|status` |
| Learned reusable project knowledge | `memorix_store` | `memorix memory store --type <type> --entity <name> --title "<title>" "<text>"` |
| Task or bug is complete/outdated | `memorix_resolve` | `memorix memory resolve --ids <ids>` |

## Search Rules

- Default first step for non-trivial coding work: call `memorix_project_context` before progress files, dev-log reads, ad-hoc file reads, or git archaeology. Pass the user's actual task so Memorix can choose a bugfix, feature, release, onboarding, refactor, docs, test, or general brief. Start by reading its suggested files.
- In Claude Code headless/print-mode, an initial MCP `pending` status is not a failure by itself. Prefer MCP first: use the client's tool discovery/dynamic loading to find `memorix_project_context` when it is not in the first visible tool list.
- Continuation fallback is mandatory: when the user asks to continue, resume, take over, or explain prior work and MCP cannot be called in this turn, run `memorix resume "<task>" --fallback --brief-json` exactly once before inspecting files, Git history, progress notes, or guessing. The absence of `.memorix` or visible memory files never proves project memory is empty. For a new task, use `memorix context "<task>" --fallback --brief-json` instead. Use `--json` only when a diagnostic needs the detailed legacy payload. If that one command fails, report it and proceed normally; do not probe help, enumerate commands, or chain broad searches.
- After a successful `memorix_project_context`, the brief is the default retrieval boundary. Do not call more Memorix retrieval tools after a complete brief. Use Context Pack, search, or detail only when the brief lacks a specific reference, freshness field, or fact needed for the task, or when the user explicitly asks for deeper history. In MCP, name that missing fact in `purpose` when intentionally expanding beyond the brief. Do not retrieve the same decision twice just to confirm an already-complete brief.
- If the user asks for read-only work or says not to modify files, do not call `memorix_store` just to record an assessment. Store only when the user explicitly asks to preserve it.
- Use `memorix_search` for a specific decision, bug, file, or prior change that the project context did not answer. Fetch detail only for a result you still need after the brief.
- Treat current code-bound memory as a map. Treat stale, suspect, or unbound memory as a lead that must be verified against the current code.
- Skip memory lookup for greetings, tiny one-off edits, or questions fully answered by the current file.
- If a fresh project has no memories, proceed normally and do not repeat the same empty search in the same turn.

## Autopilot Loop

1. Get the project context with the user's current task when it helps.
2. Read the suggested files/symbols before editing.
3. Use stale or unbound memory only as a warning or search lead.
4. Store durable decisions, fixes, and gotchas after the project state changes.
5. Resolve completed or obsolete memories so future briefs stay small.
6. For multi-step work, start a continuity ledger and pass its taskId back to memorix_project_context.

## Store Rules

| What to store | Type |
|---|---|
| Architecture or product decision | `decision` |
| Bug and fix that may recur | `problem-solution` |
| Non-obvious pitfall | `gotcha` |
| How a subsystem works | `how-it-works` |
| Important implementation change | `what-changed` |
| Accepted compromise | `trade-off` |

- Use concise titles, stable entity names, relevant `filesModified`, and `topicKey` for evolving topics.
- Do not store secrets, credentials, raw private transcripts, trivial commands, or routine file reads.
