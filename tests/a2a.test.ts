import { describe, it, expect, vi, beforeEach } from "vitest";
import { A2AClient } from "../src/a2a.js";

describe("A2AClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("skips notification when no token is set", async () => {
    const client = new A2AClient({ endpoint: "https://example.com/a2a" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await client.notify("task_claimed", { issue: 1 }, "doom");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No token"));
  });

  it("sends a JSON-RPC message to the peer endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: "ok" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new A2AClient({
      endpoint: "https://ai.lan/a2a/uuid",
      token: "sk_test",
    });

    await client.notify("task_claimed", { issue: 1, agent: "doom" }, "doom");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.lan/a2a/uuid");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk_test");

    const body = JSON.parse(init.body as string);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("message/send");
    // The event data is embedded in the A2A message text as JSON
    const textContent = body.params.message.parts[0].text;
    const parsed = JSON.parse(textContent);
    expect(parsed.event).toBe("task_claimed");
    expect(parsed.source).toBe("doom");
  });

  it("strips trailing slashes from endpoint", () => {
    const client = new A2AClient({
      endpoint: "https://ai.lan/a2a/uuid/",
      token: "sk_test",
    });
    expect((client as unknown as { endpoint: string }).endpoint).toBe(
      "https://ai.lan/a2a/uuid",
    );
  });

  it("handles peer error responses gracefully", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const client = new A2AClient({
      endpoint: "https://ai.lan/a2a/uuid",
      token: "sk_test",
    });

    await client.notify("test", {}, "doom");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("handles network errors gracefully", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const client = new A2AClient({
      endpoint: "https://ai.lan/a2a/uuid",
      token: "sk_test",
    });

    await client.notify("test", {}, "doom");
    expect(errorSpy).toHaveBeenCalled();
  });
});