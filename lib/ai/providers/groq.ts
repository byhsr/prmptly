import { registerProvider, OpenAICompatibleProvider } from "../provider";

registerProvider("groq", class extends OpenAICompatibleProvider {
  constructor(config: any) {
    super(config, "/openai/v1/chat/completions", "/openai/v1/models", {});
  }
});
