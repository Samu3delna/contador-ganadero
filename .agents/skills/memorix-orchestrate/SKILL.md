---
name: memorix-orchestrate
description: Use when a main agent needs Memorix to coordinate explicit subagent work through tasks, handoffs, messages, file locks, or the orchestrate CLI.
---

# Memorix Orchestrate

Use Memorix coordination for explicit subagent workflows with joined identities, tasks, handoffs, messages, file locks, and orchestrated workers.

## Tool Router

| Situation | Prefer | CLI fallback |
|---|---|---|
| Run managed subagent execution | CLI | `memorix orchestrate --goal "<goal>" --agents claude:1,codex:1` |
| Register coordination identity when team MCP tools are available | `team_manage` action `join` | `memorix team join --agentType <agent>` |
| Create or inspect tasks when team MCP tools are available | `team_task` | `memorix task create|list|claim|complete` |
| Send or read coordination messages when team MCP tools are available | `team_message` | `memorix message send|broadcast|inbox` |
| Share structured handoff when team MCP tools are available | `memorix_handoff` | `memorix handoff send` |
| Avoid file conflicts when team MCP tools are available | `team_file_lock` | `memorix lock lock|unlock|status` |
| Poll joined coordination state when team MCP tools are available | `memorix_poll` | `memorix poll` |

## Boundaries

The standard setup uses the `lite` MCP profile. Coordination MCP tools are exposed only by `team` or `full`; use the CLI fallback for ordinary installations, or explicitly start the server with `--mode team`. Do not probe unavailable team tools in a loop.

- For ordinary memory, do not join coordination state.
- For production multi-agent execution, prefer `memorix orchestrate` so the main process owns planning, dispatch, retries, and verification gates.
- `memorix orchestrate` uses the current checkout for single-worker runs and task worktrees for parallel runs. Use `--isolated` to force worktree isolation, `--no-worktree` to disable it, `--allow-dirty` to run with uncommitted changes, and `--no-auto-merge` to preserve task worktrees for manual review.
- In worker prompts, use the worker agent ID returned by session start or team join; never use the coordinator ID as the worker identity.
