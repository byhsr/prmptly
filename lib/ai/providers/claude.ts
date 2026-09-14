import { registerProvider } from "../provider";
import type { AIProvider } from "../provider";
import type { AIProviderConfig, GenerateRequest, StreamChunk } from "../types";

class ClaudeProvider implements AIProvider {
  private readonly STATIC_MODELS = [
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-20250514",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ];

  constructor(private config: AIProviderConfig) {}

  async generate(req: GenerateRequest): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: req.signal,
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 4096,
        system: req.messages.find((m) => m.role === "system")?.content,
        messages: req.messages.filter((m) => m.role !== "system"),
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: req.signal,
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 4096,
        stream: true,
        system: req.messages.find((m) => m.role === "system")?.content,
        messages: req.messages.filter((m) => m.role !== "system"),
      }),
    });
    if (!res.body) { yield { type: "error", error: "No response body" }; return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield { type: "text", content: parsed.delta.text };
            }
            if (parsed.type === "message_stop") {
              yield { type: "done" };
              return;
            }
          } catch { /* skip */ }
        }
      }
      yield { type: "done" };
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<string[]> {
    return this.STATIC_MODELS;
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch { return false; }
  }
}

registerProvider("claude", ClaudeProvider);
