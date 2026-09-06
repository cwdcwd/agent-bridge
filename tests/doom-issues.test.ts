import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentBridge } from "../src/core.js";
import type { TaskBoard } from "../src/core.js";

function mockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Issue #4: getTaskBoard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("groups tasks by status", async () => {
    const issues = [
      { number: 1, title: "Open task", body: "", labels: [], assignee: null },
      { number: 2, title: "Claimed", body: "", labels: [{ name: "claimed" }], assignee: { login: "doom" } },
      { number: 3, title: "Blocked", body: "", labels: [{ name: "blocked" }], assignee: { login: "kangbot" } },
      { number: 4, title: "In review", body: "", labels: [{ name: "in-review" }], assignee: { login: "doom" } },
    ];
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(issues));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "doom",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    const board: TaskBoard = await bridge.getTaskBoard();

    expect(board.open).toHaveLength(1);
    expect(board.open[0].title).toBe("Open task");
    expect(board.claimed).toHaveLength(1);
    expect(board.claimed[0].title).toBe("Claimed");
    expect(board.blocked).toHaveLength(1);
    expect(board.blocked[0].title).toBe("Blocked");
    expect(board.in_review).toHaveLength(1);
    expect(board.in_review[0].title).toBe("In review");
    expect(board.in_progress).toHaveLength(0);
  });

  it("returns empty board when no issues", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "doom",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    const board = await bridge.getTaskBoard();

    expect(board.open).toHaveLength(0);
    expect(board.claimed).toHaveLength(0);
    expect(board.in_progress).toHaveLength(0);
    expect(board.in_review).toHaveLength(0);
    expect(board.blocked).toHaveLength(0);
  });
});

describe("Issue #2: reviewPR", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts an approval review and notifies peer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "doom",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.reviewPR(5, "approve", "Looks good!");

    // Two calls: POST review, POST A2A notification
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [reviewUrl, reviewInit] = fetchMock.mock.calls[0];
    expect(reviewUrl).toContain("/pulls/5/reviews");
    expect(reviewInit.method).toBe("POST");
    const body = JSON.parse(reviewInit.body as string);
    expect(body.event).toBe("approve");
    expect(body.body).toBe("Looks good!");
  });

  it("posts a request_changes review", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "kangbot",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.reviewPR(7, "request_changes", "Please fix the types");

    const [reviewUrl, reviewInit] = fetchMock.mock.calls[0];
    expect(reviewUrl).toContain("/pulls/7/reviews");
    const body = JSON.parse(reviewInit.body as string);
    expect(body.event).toBe("request_changes");
    expect(body.body).toBe("Please fix the types");
  });

  it("posts a comment review", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "doom",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.reviewPR(10, "comment", "Nice approach");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.event).toBe("comment");
  });
});