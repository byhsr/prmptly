import { ContextBuilder } from "./context-builder";
import { getProvider } from "./provider";
import { useAIStore } from "./store";
import type { AgentRequest, AgentResponse, Conversation, ConversationMessage } from "./types";

// Import providers so they register themselves
import "./providers/openai";
import "./providers/claude";
import "./providers/gemini";
import "./providers/groq";
import "./providers/openrouter";

class AgentService {
  private contextBuilder = new ContextBuilder();

  async execute(req: AgentRequest): Promise<AgentResponse> {
    const settings = useAIStore.getState().settings;
    const provider = settings.providers.find((p) => p.id === settings.defaultProvider);
    if (!provider || !provider.apiKey) throw new Error("No provider configured");
    if (!settings.defaultModel) throw new Error("No default model selected");

    const built = this.contextBuilder.build(req);
    const impl = getProvider(provider);

    const response = await impl.generate({
      model: settings.defaultModel,
      messages: built.messages,
      temperature: req.stream ? undefined : settings.temperature,
      maxTokens: settings.maxTokens,
      signal: req.signal,
    });

    const conv = await this.saveToConversation(req, built.messages, response, provider.id, settings.defaultModel);
    return { content: response, conversationId: conv.id, provider: provider.id, model: settings.defaultModel, tokens: 0 };
  }

  async executeStream(
    req: AgentRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<AgentResponse> {
    const settings = useAIStore.getState().settings;
    const provider = settings.providers.find((p) => p.id === settings.defaultProvider);
    if (!provider || !provider.apiKey) throw new Error("No provider configured");
    if (!settings.defaultModel) throw new Error("No default model selected");

    const built = this.contextBuilder.build(req);
    const impl = getProvider(provider);
    let fullContent = "";

    for await (const chunk of impl.stream({
      model: settings.defaultModel,
      messages: built.messages,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      stream: true,
      signal,
    })) {
      if (chunk.type === "text" && chunk.content) {
        fullContent += chunk.content;
        onChunk(chunk.content);
      }
      if (chunk.type === "error" && chunk.error) {
        throw new Error(chunk.error);
      }
    }

    const conv = await this.saveToConversation(req, built.messages, fullContent, provider.id, settings.defaultModel);
    return { content: fullContent, conversationId: conv.id, provider: provider.id, model: settings.defaultModel, tokens: 0 };
  }

  private async saveToConversation(
    req: AgentRequest,
    messages: { role: string; content: string }[],
    response: string,
    providerId: string,
    model: string,
  ): Promise<Conversation> {
    const store = useAIStore.getState();
    let conv = store.activeConversation;

    if (!conv || (req.conversationId && req.conversationId !== conv.id)) {
      // Create new conversation
      conv = {
        id: crypto.randomUUID(),
        documentId: req.documentTitle ? req.documentTitle : undefined,
        title: req.action === "custom" ? "Custom request" : req.action.charAt(0).toUpperCase() + req.action.slice(1),
        messages: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      await store.addConversation(conv);
    }

    // Add user message
    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messages[messages.length - 1]?.content ?? "",
      provider: providerId,
      model,
      timestamp: new Date().toISOString(),
    };

    // Add assistant message
    const assistantMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response,
      provider: providerId,
      model,
      timestamp: new Date().toISOString(),
    };

    await store.addMessage(userMsg);
    await store.addMessage(assistantMsg);

    return store.activeConversation!;
  }
}

export const agent = new AgentService();
