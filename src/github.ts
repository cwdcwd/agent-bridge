/**
 * GitHub client — wraps the GitHub REST API for issue/PR operations
 * needed by the agent-bridge protocol.
 */

import type { Task, TaskStatus, AgentRole } from "./models.js";
import { statusFromLabels } from "./models.js";

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string }>;
  assignee: { login: string } | null;
  pull_request?: unknown;
}

export interface GitHubClientOptions {
  token: string;
  repo: string; // "owner/repo"
}

export class GitHubClient {
  private token: string;
  private repo: string;
  private api = "https://api.github.com";

  constructor(opts: GitHubClientOptions) {
    this.token = opts.token;
    this.repo = opts.repo;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
    if (this.token) {
      h.Authorization = `Bearer ${this.token}`;
    }
    return h;
  }

  /** Fetch open issues (excludes PRs) and map them to Task objects. */
  async getOpenIssues(): Promise<Task[]> {
    const url = `${this.api}/repos/${this.repo}/issues?state=open&per_page=100`;
    const resp = await fetch(url, { headers: this.headers() });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);

    const issues = (await resp.json()) as GitHubIssue[];
    return issues
      .filter((issue) => !issue.pull_request)
      .map((issue) => {
        const labels = issue.labels.map((l) => l.name);
        const assigneeLogin = issue.assignee?.login?.toLowerCase();
        const assignedTo: AgentRole =
          assigneeLogin === "doom" || assigneeLogin === "kangbot"
            ? (assigneeLogin as AgentRole)
            : "unassigned";

        return {
          issueNumber: issue.number,
          title: issue.title,
          body: issue.body ?? "",
          status: statusFromLabels(labels) as TaskStatus,
          assignedTo,
          prNumber: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
  }

  /** Assign an issue to an agent and add a label. */
  async assignIssue(issueNumber: number, agent: AgentRole, label: string): Promise<void> {
    const url = `${this.api}/repos/${this.repo}/issues/${issueNumber}`;
    const resp = await fetch(url, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ assignee: agent, labels: [label] }),
    });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);
  }

  /** Add a label to an issue (preserves existing labels). */
  async addLabel(issueNumber: number, label: string): Promise<void> {
    const url = `${this.api}/repos/${this.repo}/issues/${issueNumber}/labels`;
    const resp = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ labels: [label] }),
    });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);
  }

  /** Remove a label from an issue. Succeeds silently if the label is absent. */
  async removeLabel(issueNumber: number, label: string): Promise<void> {
    const url = `${this.api}/repos/${this.repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`;
    const resp = await fetch(url, {
      method: "DELETE",
      headers: this.headers(),
    });
    // 404 means the label wasn't there — treat as success (idempotent)
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);
    }
  }

  /** Post a review on a pull request (approve, request_changes, or comment). */
  async postReview(
    prNumber: number,
    event: "approve" | "request_changes" | "comment",
    body: string,
  ): Promise<void> {
    const url = `${this.api}/repos/${this.repo}/pulls/${prNumber}/reviews`;
    const resp = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ event, body }),
    });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);
  }
}