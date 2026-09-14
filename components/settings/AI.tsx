import { useEffect, useState } from "react"
import { useAIStore } from "@/lib/ai/store"
import { aiService } from "@/services/service.ai"
import { getProvider } from "@/lib/ai/provider"
import type { AIProviderConfig } from "@/lib/ai/types"

export function AI() {
  const { settings, loaded, init, updateSettings, setApiKey, removeApiKey } = useAIStore()
  const [testingId, setTestingId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, boolean | null>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!loaded) init()
  }, [loaded, init])

  if (!loaded) return <div className="text-xs text-muted">Loading...</div>

  const availableModels: Record<string, string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    claude: ["claude-sonnet-4-20250514", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
    gemini: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro", "gemini-1.5-flash"],
    groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "deepseek-r1-distill-llama-70b"],
    openrouter: ["auto"],
  }

  async function testConnection(provider: AIProviderConfig) {
    setTestingId(provider.id)
    try {
      const impl = getProvider(provider)
      const ok = await impl.testConnection()
      setStatuses((s) => ({ ...s, [provider.id]: ok }))
    } catch {
      setStatuses((s) => ({ ...s, [provider.id]: false }))
    } finally {
      setTestingId(null)
    }
  }

  function startEditKey(provider: AIProviderConfig) {
    setEditingKey(provider.id)
    setKeyInputs((k) => ({ ...k, [provider.id]: provider.apiKey }))
  }

  function saveKey(providerId: string) {
    const key = keyInputs[providerId]?.trim()
    if (key) setApiKey(providerId, key)
    setEditingKey(null)
  }

  function removeKey(providerId: string) {
    removeApiKey(providerId)
    setStatuses((s) => ({ ...s, [providerId]: null }))
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Defaults */}
      <section>
        <h3 className="text-sm font-medium mb-3">Default Configuration</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="w-28 text-xs text-muted shrink-0">Provider</label>
            <select
              value={settings.defaultProvider}
              onChange={(e) => updateSettings({ defaultProvider: e.target.value, defaultModel: "" })}
              className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground outline-none"
            >
              {settings.providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="w-28 text-xs text-muted shrink-0">Model</label>
            <select
              value={settings.defaultModel}
              onChange={(e) => updateSettings({ defaultModel: e.target.value })}
              className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground outline-none"
            >
              <option value="">— Select —</option>
              {(availableModels[settings.defaultProvider] ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="w-28 text-xs text-muted shrink-0">Temperature</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={settings.temperature}
              onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
              className="flex-1 accent-accent"
            />
            <span className="w-8 text-xs font-mono text-right text-muted">{settings.temperature.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="w-28 text-xs text-muted shrink-0">Max Tokens</label>
            <input
              type="number"
              min={256}
              max={128000}
              step={256}
              value={settings.maxTokens}
              onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
              className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="streaming-toggle"
              checked={settings.streaming}
              onChange={(e) => updateSettings({ streaming: e.target.checked })}
              className="accent-accent"
            />
            <label htmlFor="streaming-toggle" className="text-xs text-muted">Enable streaming</label>
          </div>
        </div>
      </section>

      {/* System Prompt */}
      <section>
        <h3 className="text-sm font-medium mb-3">System Prompt</h3>
        <textarea
          value={settings.systemPrompt}
          onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
          rows={4}
          className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono text-foreground outline-none resize-y"
        />
      </section>

      {/* Providers */}
      <section>
        <h3 className="text-sm font-medium mb-3">Providers</h3>
        <div className="space-y-2">
          {settings.providers.map((p) => {
            const status = statuses[p.id]
            const isTesting = testingId === p.id
            const isEditing = editingKey === p.id
            return (
              <div key={p.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{p.label}</span>
                    {status === true && <span className="text-[10px] text-accent">✓ Connected</span>}
                    {status === false && <span className="text-[10px] text-red-400">✗ Failed</span>}
                    {status === null && !p.enabled && <span className="text-[10px] text-muted">Not configured</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.enabled && (
                      <button
                        onClick={() => testConnection(p)}
                        disabled={isTesting}
                        className="px-2 py-1 text-[10px] font-mono border border-border rounded hover:bg-background transition-colors disabled:opacity-40"
                      >
                        {isTesting ? "Testing..." : "Test"}
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      value={keyInputs[p.id] ?? ""}
                      onChange={(e) => setKeyInputs((k) => ({ ...k, [p.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") saveKey(p.id); if (e.key === "Escape") setEditingKey(null) }}
                      placeholder="sk-..."
                      type="password"
                      autoFocus
                      className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs font-mono outline-none"
                    />
                    <button onClick={() => saveKey(p.id)} className="px-2 py-1 text-[10px] font-mono text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors">Save</button>
                    <button onClick={() => setEditingKey(null)} className="px-2 py-1 text-[10px] font-mono text-muted border border-border rounded hover:bg-background transition-colors">Cancel</button>
                  </div>
                ) : p.enabled ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted">{aiService.maskKey(p.apiKey)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEditKey(p)} className="px-2 py-1 text-[10px] font-mono border border-border rounded hover:bg-background transition-colors">Edit</button>
                      <button onClick={() => removeKey(p.id)} className="px-2 py-1 text-[10px] font-mono text-red-400 border border-red-400/30 rounded hover:bg-red-500/10 transition-colors">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startEditKey(p)} className="px-3 py-1.5 text-[10px] font-mono text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors">+ Add API Key</button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
