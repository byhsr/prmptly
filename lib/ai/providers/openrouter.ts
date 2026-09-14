import { registerProvider, OpenAICompatibleProvider } from "../provider";

registerProvider("openrouter", class extends OpenAICompatibleProvider {
  constructor(config: any) {
    super(config, "/api/v1/chat/completions", "/api/v1/models", {
      "HTTP-Referer": "https://pr0mptly.app",
      "X-Title": "Promptly",
    });
  }
});
