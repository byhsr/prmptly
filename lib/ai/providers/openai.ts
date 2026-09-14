import { registerProvider, OpenAICompatibleProvider } from "../provider";

registerProvider("openai", class extends OpenAICompatibleProvider {
  constructor(config: any) {
    super(config, "/v1/chat/completions", undefined, {});
  }
});
