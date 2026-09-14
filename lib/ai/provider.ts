import type { AIProviderConfig, GenerateRequest, StreamChunk } from "./types";

export interface AIProvider {
  generate(req: GenerateRequest): Promise<string>;
  stream(req: GenerateRequest): AsyncGenerator<StreamChunk>;
  listModels(): Promise<string[]>;
  testConnection(): Promise<boolean>;
}

// ── Registry ─────────────────────────────────────────

type ProviderCtor = new (config: AIProviderConfig) => AIProvider;
const registry = new Map<string, ProviderCtor>();

export function registerProvider(id: string, ctor: ProviderCtor) {
  registry.set(id, ctor);
}

export function getProvider(config: AIProviderConfig): AIProvider {
  const ctor = registry.get(config.id);
  if (!ctor) throw new Error(`Unknown provider: ${config.id}`);
  return new ctor(config);
}

export function getRegisteredProviders(): string[] {
  return [...registry.keys()];
}

// ── OpenAI-compatible base (used by OpenAI, Groq, OpenRouter) ──

export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    protected config: AIProviderConfig,
    protected apiPath = "/v1/chat/completions",
    protected modelListPath?: string,
    protected extraHeaders: Record<string, string> = {},
  ) {}

  async generate(req: GenerateRequest): Promise<string> {
    const res = await this.fetch(req, false);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const res = await this.fetch({ ...req, stream: true }, true);
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
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { yield { type: "done" }; return; }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text;
            if (content) yield { type: "text", content };
          } catch { /* skip malformed */ }
        }
      }
      yield { type: "done" };
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<string[]> {
    const path = this.modelListPath ?? "/v1/models";
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? data.models ?? []).map((m: any) => m.id ?? m.name).filter(Boolean);
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch { return false; }
  }

  private async fetch(req: GenerateRequest, isStream: boolean): Promise<Response> {
    return fetch(`${this.config.baseUrl}${this.apiPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.extraHeaders,
      },
      signal: req.signal,
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        stream: isStream,
      }),
    });
  }
}
