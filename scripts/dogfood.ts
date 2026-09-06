/**
 * dogfood.ts — Use agent-bridge to coordinate with kangbot.
 *
 * This script uses the @cwdcwd/agent-bridge library we built to:
 * 1. Fetch the task board from GitHub issues
 * 2. Create new issues for the next round of work
 * 3. Send A2A messages to kangbot to assign work
 *
 * This is the dogfooding moment: the library coordinating its own development.
 */

import { AgentBridge } from "../src/index.js";

// Unauthenticated GitHub API works for public repos (60 req/hour).
// Set GITHUB_TOKEN env var to get 5000 req/hour if available.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const A2A_TOKEN = process.env.LITELLM_GATEWAY_API_KEY ?? "";
const KANGBOT_ENDPOINT = "https://ai.lan/a2a/2e54df2d-1f90-41b7-9de2-3bca2ab680c7";

async function main() {
  const bridge = new AgentBridge({
    repo: "cwdcwd/agent-bridge",
    agentName: "doom",
    peerEndpoint: KANGBOT_ENDPOINT,
    githubToken: GITHUB_TOKEN,
    a2aToken: A2A_TOKEN,
  });

  // 1. Show current task board
  console.log("=== Task Board ===");
  const board = await bridge.getTaskBoard();
  console.log("Open:", board.open.length);
  console.log("Claimed:", board.claimed.length);
  console.log("In Progress:", board.in_progress.length);
  console.log("In Review:", board.in_review.length);
  console.log("Blocked:", board.blocked.length);
  for (const t of board.open) {
    console.log("  #" + t.issueNumber + ": " + t.title);
  }
  for (const t of board.claimed) {
    console.log("  #" + t.issueNumber + ": " + t.title + " (claimed by " + t.assignedTo + ")");
  }

  // 2. Ping kangbot via A2A
  console.log("\n=== Pinging kangbot ===");
  await bridge.sendMessage("Kangbot, dogfooding check. All 4 original issues are done. Reply with your current status.");

  console.log("Done. Check GitHub for kangbot's response.");
}

main().catch(console.error);