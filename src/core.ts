/**
 * AgentBridge — the main coordination class.
 * Combines GitHub issue tracking with A2A peer communication
 * to enable multi-agent software development.
 */

import { GitHubClient } from "./github.js";
import { A2AClient } from "./a2a.js";
import {
  type Task,
  type AgentRole,
  claim as claimTask,
} from "./models.js";

export interface AgentBridgeOptions {
  repo: string; // "owner/repo"
  agentName: string; // "doom" | "kangbot"
  peerEndpoint: string;
  githubToken: string;
  a2aToken?: string;
}

export class AgentBridge {
  readonly role: AgentRole;
  private gh: GitHubClient;
  private a2a: A2AClient;

  constructor(opts: AgentBridgeOptions) {
    this.role = opts.agentName.toLowerCase() as AgentRole;
    this.gh = new GitHubClient({ token: opts.githubToken, repo: opts.repo });
    this.a2a = new A2AClient({ endpoint: opts.peerEndpoint, token: opts.a2aToken });
  }

  /** Get all open, unassigned tasks from GitHub. */
  async getOpenTasks(): Promise<Task[]> {
    return this.gh.getOpenIssues();
  }

  /** Claim a task — assigns the issue and notifies the peer. */
  async claimTask(issueNumber: number): Promise<void> {
    await this.gh.assignIssue(issueNumber, this.role, "claimed");
    await this.a2a.notify("task_claimed", { issue: issueNumber, agent: this.role }, this.role);
  }

  /** Mark a task as in-review with a linked PR. */
  async completeTask(issueNumber: number, prNumber: number): Promise<void> {
    await this.gh.addLabel(issueNumber, "in-review");
    await this.a2a.notify(
      "task_in_review",
      { issue: issueNumber, pr: prNumber, agent: this.role },
      this.role,
    );
  }

  /** Mark a task as blocked and request help from the peer agent. */
  async blockTask(issueNumber: number, reason: string): Promise<void> {
    await this.gh.addLabel(issueNumber, "blocked");
    await this.a2a.notify(
      "task_blocked",
      { issue: issueNumber, agent: this.role, reason },
      this.role,
    );
  }

  /** Unblock a task — removes the blocked label so work can resume. */
  async unblockTask(issueNumber: number): Promise<void> {
    await this.gh.removeLabel(issueNumber, "blocked");
    await this.a2a.notify(
      "task_unblocked",
      { issue: issueNumber, agent: this.role },
      this.role,
    );
  }

  /** Send a freeform message to the peer agent. */
  async sendMessage(text: string): Promise<void> {
    await this.a2a.sendMessage(text, this.role);
  }
}