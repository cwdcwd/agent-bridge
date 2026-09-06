/**
 * AgentBridge — the main coordination class.
 * Combines GitHub issue tracking with A2A peer communication
 * to enable multi-agent software development.
 */

import { GitHubClient } from "./github.js";
import { A2AClient } from "./a2a.js";
import {
  type Task,
  type TaskStatus,
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

  /** Get a task board view — all open tasks grouped by status. */
  async getTaskBoard(): Promise<TaskBoard> {
    const tasks = await this.gh.getOpenIssues();
    const board: TaskBoard = {
      open: [],
      claimed: [],
      in_progress: [],
      in_review: [],
      blocked: [],
    };
    for (const task of tasks) {
      switch (task.status) {
        case "open":
          board.open.push(task);
          break;
        case "claimed":
          board.claimed.push(task);
          break;
        case "in_progress":
          board.in_progress.push(task);
          break;
        case "in_review":
          board.in_review.push(task);
          break;
        case "blocked":
          board.blocked.push(task);
          break;
        case "done":
          // done tasks are closed on GitHub, won't appear in open issues
          break;
      }
    }
    return board;
  }

  /**
   * Return a human-readable summary of the task board.
   *
   * Fetches all open tasks from GitHub and groups them by status,
   * listing each task with its issue number, title, assignee, and PR
   * link (if any). The summary ends with a status breakdown count.
   */
  async getTaskSummary(): Promise<string> {
    const tasks = await this.getOpenTasks();

    if (tasks.length === 0) {
      return "📋 Task Board\n\nNo open tasks. 🎉";
    }

    const statuses: TaskStatus[] = [
      "open",
      "claimed",
      "in_progress",
      "in_review",
      "blocked",
    ];

    const byStatus: Record<string, Task[]> = {};
    for (const s of statuses) {
      byStatus[s] = tasks.filter((t) => t.status === s);
    }

    const lines: string[] = ["📋 Task Board", ""];

    for (const s of statuses) {
      const group = byStatus[s];
      if (group.length === 0) continue;

      const label = s.replace(/_/g, " ").toUpperCase();
      lines.push(`■ ${label} (${group.length})`);

      for (const t of group) {
        const assignee = t.assignedTo === "unassigned" ? "unassigned" : t.assignedTo;
        const pr = t.prNumber ? ` · PR #${t.prNumber}` : "";
        lines.push(`  #${t.issueNumber} ${t.title} — ${assignee}${pr}`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push(
      `Total: ${tasks.length} open task${tasks.length === 1 ? "" : "s"}` +
        ` | Open: ${byStatus.open.length}` +
        ` | Claimed: ${byStatus.claimed.length}` +
        ` | In Progress: ${byStatus.in_progress.length}` +
        ` | In Review: ${byStatus.in_review.length}` +
        ` | Blocked: ${byStatus.blocked.length}`,
    );

    return lines.join("\n");
  }

  /** Review a PR — fetches the diff and posts a review (approve/request_changes/comment). */
  async reviewPR(
    prNumber: number,
    event: "approve" | "request_changes" | "comment",
    body: string,
  ): Promise<void> {
    await this.gh.postReview(prNumber, event, body);
    await this.a2a.notify(
      "pr_reviewed",
      { pr: prNumber, event, reviewer: this.role },
      this.role,
    );
  }
}

export interface TaskBoard {
  open: Task[];
  claimed: Task[];
  in_progress: Task[];
  in_review: Task[];
  blocked: Task[];
}