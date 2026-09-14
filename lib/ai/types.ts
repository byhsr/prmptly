// ── Provider config ──────────────────────────────────

export interface AIProviderConfig {
  id: string;
  label: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
}

// ── AI settings ──────────────────────────────────────

export interface AISettings {
  defaultProvider: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
  systemPrompt: string;
  providers: AIProviderConfig[];
}

export const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  { id: "openai", label: "OpenAI", apiKey: "", baseUrl: "https://api.openai.com", enabled: false },
  { id: "claude", label: "Anthropic Claude", apiKey: "", baseUrl: "https://api.anthropic.com", enabled: false },
  { id: "gemini", label: "Google Gemini", apiKey: "", baseUrl: "https://generativelanguage.googleapis.com", enabled: false },
  { id: "groq", label: "Groq", apiKey: "", baseUrl: "https://api.groq.com", enabled: false },
  { id: "openrouter", label: "OpenRouter", apiKey: "", baseUrl: "https://openrouter.ai", enabled: false },
];

export const DEFAULT_AI_SETTINGS: AISettings = {
  defaultProvider: "openai",
  defaultModel: "",
  temperature: 0.7,
  maxTokens: 4096,
  streaming: true,
  systemPrompt: "You are a helpful AI assistant integrated into a writing workspace called Promptly.",
  providers: DEFAULT_PROVIDERS,
};

// ── Request / response types ─────────────────────────

export interface GenerateRequest {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface StreamChunk {
  type: "text" | "done" | "error";
  content?: string;
  error?: string;
}

// ── Conversation types ───────────────────────────────

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider: string;
  model: string;
  timestamp: string;
  tokens?: number;
}

export interface Conversation {
  id: string;
  documentId?: string;
  title: string;
  messages: ConversationMessage[];
  created: string;
  updated: string;
}

// ── Agent request types ──────────────────────────────

export type PromptAction =
  | "explain"
  | "improve"
  | "rewrite"
  | "continue"
  | "summarize"
  | "expand"
  | "shorten"
  | "fixGrammar"
  | "translate"
  | "generatePrompt"
  | "generateTemplate"
  | "generateAgent"
  | "custom";

export interface AgentRequest {
  action: PromptAction;
  content: string;
  selection?: string;
  documentTitle?: string;
  documentType?: string;
  templateTitle?: string;
  templateSections?: { title: string; content: string }[];
  workspacePath?: string;
  scratchpad?: string;
  canvasContext?: string;
  libraryRefs?: { key: string; value: string }[];
  systemPromptOverride?: string;
  conversationId?: string;
  stream?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
}

export interface AgentResponse {
  content: string;
  conversationId: string;
  provider: string;
  model: string;
  tokens: number;
}
