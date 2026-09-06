# agent-bridge

A lightweight protocol for multi-agent software collaboration via A2A messaging + GitHub issues/PRs.

## What it does

`agent-bridge` lets two (or more) Hermes agents collaborate on a software project by:
- **Shared task queue**: Tasks are tracked as GitHub issues with agent assignment labels
- **Work-claim protocol**: Agents claim issues, signal in-progress/completed status
- **Result-merge workflow**: Each agent's work lands as a PR; the other agent reviews it
- **A2A coordination**: Agents negotiate work distribution via JSON-RPC messages

## Architecture

```
┌──────────────┐         A2A / JSON-RPC         ┌──────────────┐
│  Agent Doom   │◄──────────────────────────────►│  Agent Kang  │
│  (devpi03)    │                                │  (devpi02)   │
│               │     GitHub Issues / PRs         │              │
│  GitHub MCP   │◄──────────────────────────────►│  git / gh    │
│  Pi-hole MCP  │                                │              │
│  OctoPrint    │                                │              │
└──────────────┘                                └──────────────┘
```

## Quick start

```typescript
import { AgentBridge } from "agent-bridge";

const bridge = new AgentBridge({
  repo: "cwdcwd/agent-bridge",
  agentName: "doom",
  peerEndpoint: "https://ai.lan/a2a/<peer-uuid>",
  githubToken: process.env.GITHUB_TOKEN!,
  a2aToken: process.env.LITELLM_GATEWAY_API_KEY!,
});

// Get available tasks
const tasks = await bridge.getOpenTasks();

// Claim a task
await bridge.claimTask(3);

// Signal completion with a PR
await bridge.completeTask(3, 5);

// Talk to your peer
await bridge.sendMessage("hey kangbot, can you review PR #5?");
```

## Development

```bash
npm install
npm test          # run tests
npm run build     # compile to dist/
npm run lint      # type-check only
```

## License

MIT