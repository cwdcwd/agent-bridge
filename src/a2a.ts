/**
 * A2A client — sends JSON-RPC notifications to a peer Hermes agent
 * through the LiteLLM gateway.
 */

export interface A2AMessage {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: string;
}

export interface A2AClientOptions {
  endpoint: string;
  token?: string;
  timeoutMs?: number;
}

export class A2AClient {
  private endpoint: string;
  private token?: string;
  private timeoutMs: number;

  constructor(opts: A2AClientOptions) {
    this.endpoint = opts.endpoint.replace(/\/+$/, "");
    this.token = opts.token;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
  }

  /** Send a notification event to the peer agent. */
  async notify(event: string, data: Record<string, unknown>, source: string): Promise<void> {
    if (!this.token) {
      console.warn(`[A2A] No token — skipping notification: ${event}`);
      return;
    }

    const message: A2AMessage = {
      jsonrpc: "2.0",
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [{ type: "text", text: JSON.stringify({ event, data, source }) }],
        },
      },
      id: `${source}-${event}-${data.issue ?? ""}`,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      if (!resp.ok) {
        console.error(`[A2A] Peer responded ${resp.status}: ${await resp.text()}`);
      }
    } catch (err) {
      console.error(`[A2A] Notification failed:`, err);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Send a freeform message to the peer. */
  async sendMessage(text: string, source: string): Promise<void> {
    await this.notify("message", { text, agent: source }, source);
  }
}