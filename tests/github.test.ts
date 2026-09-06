import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubClient } from "../src/github.js";

function mockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GitHubClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getOpenIssues fetches issues and excludes PRs", async () => {
    const issues = [
      { number: 1, title: "Task 1", body: "Do thing", labels: [], assignee: null },
      {
        number: 2,
        title: "A PR",
        body: "",
        labels: [],
        assignee: null,
        pull_request: { url: "https://api.github.com/repos/x/y/pulls/2" },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(issues));
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    const tasks = await client.getOpenIssues();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].issueNumber).toBe(1);
    expect(tasks[0].title).toBe("Task 1");
  });

  it("getOpenIssues parses assignee into AgentRole", async () => {
    const issues = [
      {
        number: 3,
        title: "Assigned task",
        body: "",
        labels: [{ name: "claimed" }],
        assignee: { login: "doom" },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(issues));
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    const tasks = await client.getOpenIssues();

    expect(tasks[0].assignedTo).toBe("doom");
    expect(tasks[0].status).toBe("claimed");
  });

  it("assignIssue sends PATCH with assignee and labels", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    await client.assignIssue(5, "kangbot", "claimed");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/5");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.assignee).toBe("kangbot");
    expect(body.labels).toEqual(["claimed"]);
  });

  it("addLabel sends POST to labels endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    await client.addLabel(7, "in-review");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues/7/labels");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.labels).toEqual(["in-review"]);
  });

  it("throws on API error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    await expect(client.getOpenIssues()).rejects.toThrow("GitHub API 404");
  });

  it("removeLabel sends DELETE to labels endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    await client.removeLabel(9, "blocked");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.github.com/repos/owner/repo/issues/9/labels/blocked",
    );
    expect(init.method).toBe("DELETE");
  });

  it("removeLabel is idempotent on 404 (label already absent)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    await expect(client.removeLabel(9, "blocked")).resolves.toBeUndefined();
  });

  it("removeLabel throws on non-404 errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient({ token: "ghp_fake", repo: "owner/repo" });
    await expect(client.removeLabel(9, "blocked")).rejects.toThrow(
      "GitHub API 403",
    );
  });
});