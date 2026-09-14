import type { AgentRequest } from "./types";
import { useAIStore } from "./store";

export interface BuiltPrompt {
  system: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
}

const ACTION_PROMPTS: Record<string, string> = {
  explain: "Explain the following content clearly and concisely:\n\n{content}",
  improve: "Improve the following content for clarity, tone, and structure:\n\n{content}",
  rewrite: "Rewrite the following content in a different style:\n\n{content}",
  continue: "Continue writing from where the following content ends. Maintain the same style and tone:\n\n{content}",
  summarize: "Provide a concise summary of the following content:\n\n{content}",
  expand: "Expand the following content with more details and examples:\n\n{content}",
  shorten: "Shorten the following content while preserving key information:\n\n{content}",
  fixGrammar: "Fix any grammar, spelling, and punctuation errors. Preserve the original meaning and style:\n\n{content}",
  translate: "Translate the following content to {target_language}:\n\n{content}",
  generatePrompt: "Based on the following context, generate an effective AI prompt:\n\n{content}",
  generateTemplate: "Create a reusable template structure based on the following content:\n\n{content}",
  generateAgent:
    "You are designing an agent workflow based on the canvas flow and context below.\n" +
    "Each node type means:\n" +
    "  - AGENT: An AI agent with a model and system prompt.\n" +
    "  - ACTION: A discrete action/tool (read_file, call_api, etc.) with parameters.\n" +
    "  - CONDITION: A conditional branch with operator (equals, contains, gt, lt, exists), field, and value.\n" +
    "  - NOTE: Freeform annotations.\n\n" +
    "From the canvas, generate a complete agent implementation proposal.\n" +
    "Include:\n" +
    "  1. Agent architecture overview\n" +
    "  2. Each node's role and how they connect\n" +
    "  3. How to implement this as runnable code or prompts\n" +
    "  4. Suggested tools, models, and configuration\n\n" +
    "Canvas Flow:\n{canvas}\n\n" +
    "Additional Context:\n{content}",
};

export class ContextBuilder {
  build(req: AgentRequest): BuiltPrompt {
    const settings = useAIStore.getState().settings;
    const systemPrompt = req.systemPromptOverride || settings.systemPrompt;

    // ── Build rich context block ──
    const contextParts: string[] = [];

    if (req.documentTitle) contextParts.push(`Document: ${req.documentTitle}`);
    if (req.documentType) contextParts.push(`Type: ${req.documentType}`);

    if (req.templateTitle) {
      contextParts.push(`Template: ${req.templateTitle}`);
    }

    if (req.templateSections && req.templateSections.length > 0) {
      const sectionList = req.templateSections
        .map((s) => `  - ${s.title}: ${s.content.slice(0, 200)}`)
        .join("\n");
      contextParts.push(`Template Sections:\n${sectionList}`);
    }

    if (req.scratchpad) {
      const trimmed = req.scratchpad.slice(0, 2000);
      contextParts.push(`Scratchpad:\n${trimmed}`);
    }

    if (req.canvasContext) {
      contextParts.push(`Agent Canvas:\n${req.canvasContext}`);
    }

    if (req.libraryRefs && req.libraryRefs.length > 0) {
      const refs = req.libraryRefs
        .map((r) => `  @${r.key}: ${r.value.slice(0, 300)}`)
        .join("\n");
      contextParts.push(`Library References:\n${refs}`);
    }

    // ── Build user prompt ──
    const actionTemplate = ACTION_PROMPTS[req.action];
    let userContent = req.content;

    if (req.action === "generateAgent") {
      userContent = actionTemplate
        .replace("{canvas}", req.canvasContext || "(no canvas)")
        .replace("{content}", req.content || "");
    } else if (actionTemplate) {
      userContent = actionTemplate.replace("{content}", req.content);
    } else if (req.action === "custom" && req.content) {
      userContent = req.content;
    }

    // Prepend context if present
    if (contextParts.length > 0) {
      userContent = `[Context]\n${contextParts.join("\n---\n")}\n\n${userContent}`;
    }

    // ── Build messages ──
    const messages: BuiltPrompt["messages"] = [];
    messages.push({ role: "system", content: systemPrompt });

    const activeConv = useAIStore.getState().activeConversation;
    if (activeConv && req.conversationId === activeConv.id) {
      const recent = activeConv.messages.slice(-6);
      for (const msg of recent) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: userContent });

    return { system: systemPrompt, messages };
  }
}
