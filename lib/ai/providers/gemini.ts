import { registerProvider } from "../provider";
import type { AIProvider } from "../provider";
import type { AIProviderConfig, GenerateRequest, StreamChunk } from "../types";

class GeminiProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  async generate(req: GenerateRequest): Promise<string> {
    const url = `${this.config.baseUrl}/v1beta/models/${req.model}:generateContent?key=${this.config.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: req.signal,
      body: JSON.stringify({
        contents: this.toGeminiMessages(req.messages),
        systemInstruction: this.toSystemInstruction(req.messages),
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
        },
      }),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const url = `${this.config.baseUrl}/v1beta/models/${req.model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: req.signal,
      body: JSON.stringify({
        contents: this.toGeminiMessages(req.messages),
        systemInstruction: this.toSystemInstruction(req.messages),
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
        },
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
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield { type: "text", content: text };
          } catch { /* skip */ }
        }
      }
      yield { type: "done" };
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<string[]> {
    const url = `${this.config.baseUrl}/v1beta/models?key=${this.config.apiKey}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      return (data.models ?? [])
        .filter((m: any) => m.name?.includes("gemini"))
        .map((m: any) => m.name.split("/").pop());
    } catch { return ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro"]; }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.config.baseUrl}/v1beta/models?key=${this.config.apiKey}`,
        { signal: AbortSignal.timeout(10000) },
      );
      return res.ok;
    } catch { return false; }
  }

  private toGeminiMessages(messages: GenerateRequest["messages"]) {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
  }

  private toSystemInstruction(messages: GenerateRequest["messages"]) {
    const sys = messages.find((m) => m.role === "system");
    return sys ? { parts: [{ text: sys.content }] } : undefined;
  }
}

registerProvider("gemini", GeminiProvider);
