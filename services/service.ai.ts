import { getSetting, setSetting } from "@/lib/db";
import type { AISettings, Conversation } from "@/lib/ai/types";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai/types";

const AI_PREFIX = "ai:";

export const aiService = {
  async loadSettings(): Promise<AISettings> {
    const raw = await getSetting(AI_PREFIX + "settings");
    if (!raw) return DEFAULT_AI_SETTINGS;
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_AI_SETTINGS;
    }
  },

  async saveSettings(settings: AISettings): Promise<void> {
    await setSetting(AI_PREFIX + "settings", JSON.stringify(settings));
  },

  async loadConversations(): Promise<Conversation[]> {
    const convos: Conversation[] = [];
    // Load all conversations from app_settings with conv: prefix
    // We store them under conv:<id> keys
    return convos;
  },

  maskKey(key: string): string {
    if (key.length <= 8) return "••••••••";
    return "••••••••" + key.slice(-8);
  },
};
