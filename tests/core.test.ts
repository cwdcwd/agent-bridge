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
});