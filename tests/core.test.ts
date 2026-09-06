import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentBridge } from "../src/core.js";

function mockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AgentBridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates with correct role", () => {
    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "Doom",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });
    expect(bridge.role).toBe("doom");
  });

  it("claimTask calls GitHub assign + A2A notify", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "doom",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.claimTask(3);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [assignUrl, assignInit] = fetchMock.mock.calls[0];
    expect(assignUrl).toContain("/issues/3");
    expect(assignInit.method).toBe("PATCH");
  });

  it("completeTask adds label and notifies peer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "doom",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.completeTask(3, 5);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [labelUrl, labelInit] = fetchMock.mock.calls[0];
    expect(labelUrl).toContain("/issues/3/labels");
    expect(labelInit.method).toBe("POST");
  });

  it("sendMessage delegates to A2A", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "kangbot",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.sendMessage("hey doom, need help with issue 3");

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.params.event).toBe("message");
    expect(body.params.data.text).toContain("hey doom");
  });

  it("blockTask adds blocked label and notifies peer with reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "kangbot",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.blockTask(7, "waiting on API spec from doom");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call: GitHub addLabel (POST to /labels)
    const [labelUrl, labelInit] = fetchMock.mock.calls[0];
    expect(labelUrl).toContain("/issues/7/labels");
    expect(labelInit.method).toBe("POST");
    const labelBody = JSON.parse(labelInit.body as string);
    expect(labelBody.labels).toEqual(["blocked"]);
    // Second call: A2A notify
    const a2aBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(a2aBody.params.event).toBe("task_blocked");
    expect(a2aBody.params.data.reason).toBe("waiting on API spec from doom");
    expect(a2aBody.params.data.issue).toBe(7);
  });

  it("unblockTask removes blocked label and notifies peer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "kangbot",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    await bridge.unblockTask(7);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call: GitHub removeLabel (DELETE to /labels/blocked)
    const [labelUrl, labelInit] = fetchMock.mock.calls[0];
    expect(labelUrl).toContain("/issues/7/labels/blocked");
    expect(labelInit.method).toBe("DELETE");
    // Second call: A2A notify
    const a2aBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(a2aBody.params.event).toBe("task_unblocked");
    expect(a2aBody.params.data.issue).toBe(7);
  });

  it("getTaskSummary returns empty-board message when no tasks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "kangbot",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    const summary = await bridge.getTaskSummary();

    expect(summary).toContain("📋 Task Board");
    expect(summary).toContain("No open tasks");
  });

  it("getTaskSummary groups tasks by status and shows counts", async () => {
    const issues = [
      {
        number: 1,
        title: "Implement feature A",
        body: "",
        labels: [{ name: "open" }],
        assignee: null,
      },
      {
        number: 2,
        title: "Fix bug B",
        body: "",
        labels: [{ name: "claimed" }],
        assignee: { login: "doom" },
      },
      {
        number: 3,
        title: "Refactor module C",
        body: "",
        labels: [{ name: "blocked" }],
        assignee: { login: "kangbot" },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(issues));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "kangbot",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    const summary = await bridge.getTaskSummary();

    // Header
    expect(summary).toContain("📋 Task Board");
    // Each status group
    expect(summary).toContain("OPEN (1)");
    expect(summary).toContain("CLAIMED (1)");
    expect(summary).toContain("BLOCKED (1)");
    // Each task
    expect(summary).toContain("#1 Implement feature A — unassigned");
    expect(summary).toContain("#2 Fix bug B — doom");
    expect(summary).toContain("#3 Refactor module C — kangbot");
    // Total line
    expect(summary).toContain("Total: 3 open tasks");
    expect(summary).toContain("Open: 1");
    expect(summary).toContain("Claimed: 1");
    expect(summary).toContain("Blocked: 1");
  });

  it("getTaskSummary omits empty status groups", async () => {
    const issues = [
      {
        number: 5,
        title: "Single task",
        body: "",
        labels: [{ name: "open" }],
        assignee: null,
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(issues));
    vi.stubGlobal("fetch", fetchMock);

    const bridge = new AgentBridge({
      repo: "owner/repo",
      agentName: "kangbot",
      peerEndpoint: "https://ai.lan/a2a/uuid",
      githubToken: "ghp_fake",
      a2aToken: "sk_fake",
    });

    const summary = await bridge.getTaskSummary();

    expect(summary).toContain("OPEN (1)");
    expect(summary).not.toContain("CLAIMED");
    expect(summary).not.toContain("BLOCKED");
    expect(summary).toContain("Total: 1 open task");
  });
});