import { create } from "zustand";
import type { AISettings, Conversation, AIProviderConfig } from "./types";
import { DEFAULT_AI_SETTINGS } from "./types";
import { aiService } from "@/services/service.ai";
import { loadConversations, saveConversation, deleteConversation } from "@/lib/db/conversations";

interface AIState {
  settings: AISettings;
  loaded: boolean;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  isGenerating: boolean;

  init: () => Promise<void>;
  updateSettings: (partial: Partial<AISettings>) => Promise<void>;
  setProvider: (providerId: string, updates: Partial<AIProviderConfig>) => Promise<void>;
  setApiKey: (providerId: string, apiKey: string) => Promise<void>;
  removeApiKey: (providerId: string) => Promise<void>;
  setGenerating: (v: boolean) => void;
  setActiveConversation: (conv: Conversation | null) => void;
  addConversation: (conv: Conversation) => Promise<void>;
  addMessage: (msg: Conversation["messages"][0]) => Promise<void>;
  clearConversations: () => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
  loadConversationList: (documentId?: string) => Promise<void>;
}

export const useAIStore = create<AIState>((set, get) => ({
  settings: DEFAULT_AI_SETTINGS,
  loaded: false,
  conversations: [],
  activeConversation: null,
  isGenerating: false,

  init: async () => {
    const settings = await aiService.loadSettings();
    set({ settings, loaded: true });
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial };
    set({ settings: next });
    await aiService.saveSettings(next);
  },

  setProvider: async (providerId, updates) => {
    const providers = get().settings.providers.map((p) =>
      p.id === providerId ? { ...p, ...updates } : p,
    );
    const next = { ...get().settings, providers };
    set({ settings: next });
    await aiService.saveSettings(next);
  },

  setApiKey: async (providerId, apiKey) => {
    await get().setProvider(providerId, { apiKey, enabled: true });
  },

  removeApiKey: async (providerId) => {
    await get().setProvider(providerId, { apiKey: "", enabled: false });
  },

  setGenerating: (v) => set({ isGenerating: v }),

  setActiveConversation: (conv) => set({ activeConversation: conv }),

  addConversation: async (conv) => {
    await saveConversation(conv);
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversation: conv,
    }));
  },

  addMessage: async (msg) => {
    const conv = get().activeConversation;
    if (!conv) return;
    const updated = {
      ...conv,
      messages: [...conv.messages, msg],
      updated: new Date().toISOString(),
    };
    await saveConversation(updated);
    set({ activeConversation: updated, conversations: get().conversations.map((c) => c.id === updated.id ? updated : c) });
  },

  clearConversations: async () => {
    const { deleteConversation } = await import("@/lib/db/conversations");
    for (const c of get().conversations) {
      await deleteConversation(c.id);
    }
    set({ conversations: [], activeConversation: null });
  },

  removeConversation: async (id) => {
    await deleteConversation(id);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversation: s.activeConversation?.id === id ? null : s.activeConversation,
    }));
  },

  loadConversationList: async (documentId) => {
    const convos = await loadConversations(documentId);
    set({ conversations: convos });
  },
}));
