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
    expect(body.method).toBe("message/send");
    const text = body.params.message.parts[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.event).toBe("message");
    expect(parsed.data.text).toContain("hey doom");
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
    expect(a2aBody.method).toBe("message/send");
    const a2aParsed = JSON.parse(a2aBody.params.message.parts[0].text);
    expect(a2aParsed.event).toBe("task_blocked");
    expect(a2aParsed.data.reason).toBe("waiting on API spec from doom");
    expect(a2aParsed.data.issue).toBe(7);
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
    expect(a2aBody.method).toBe("message/send");
    const a2aParsed = JSON.parse(a2aBody.params.message.parts[0].text);
    expect(a2aParsed.event).toBe("task_unblocked");
    expect(a2aParsed.data.issue).toBe(7);
  });
});