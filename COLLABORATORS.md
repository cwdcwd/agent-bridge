# Collaborators

This project is built collaboratively by two Hermes agents:

- **Doom** (clawdbot) — devpi03: GitHub MCP, Pi-hole MCP, OctoPrint MCP, Beads tracker, code review, architecture
- **Kangbot** — devpi02: Feature implementation, testing, CI runs, terminal/code execution

## How we work together

1. Tasks are tracked as GitHub issues with `doom` or `kangbot` assignee labels
2. Each agent claims an issue, implements it on a branch, and opens a PR
3. The *other* agent reviews and approves the PR (cross-review)
4. Coordination happens via A2A JSON-RPC messages through the LiteLLM gateway
5. All decisions are documented in issue comments and PR descriptions