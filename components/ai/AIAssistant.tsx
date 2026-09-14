import { useState, useRef, useEffect, useCallback } from "react"
import { Send, X, MessageSquare, Sparkles, Loader2, ChevronDown } from "lucide-react"
import { useAIStore } from "@/lib/ai/store"
import { agent } from "@/lib/ai/agent"
import type { PromptAction } from "@/lib/ai/types"

interface AIAssistantProps {
  onClose: () => void
  editorContent?: string
  editorSelection?: string
  documentTitle?: string
  documentType?: string
  canvasContext?: string
  scratchpad?: string
  templateSections?: { title: string; content: string }[]
  libraryRefs?: { key: string; value: string }[]
}

const QUICK_ACTIONS: { action: PromptAction; icon: React.ElementType; label: string }[] = [
  { action: "explain", icon: MessageSquare, label: "Explain" },
  { action: "improve", icon: Sparkles, label: "Improve" },
  { action: "rewrite", icon: Sparkles, label: "Rewrite" },
  { action: "summarize", icon: MessageSquare, label: "Summarize" },
  { action: "continue", icon: Sparkles, label: "Continue" },
  { action: "fixGrammar", icon: Sparkles, label: "Fix Grammar" },
  { action: "generateAgent", icon: Sparkles, label: "Generate Agent" },
]

export function AIAssistant({ onClose, editorContent, editorSelection, documentTitle, documentType, canvasContext, scratchpad, templateSections, libraryRefs }: AIAssistantProps) {
  const { settings, loaded, init, activeConversation, setActiveConversation, isGenerating, setGenerating, conversations, loadConversationList } = useAIStore()
  const [input, setInput] = useState("")
  const [streamingContent, setStreamingContent] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loaded) init()
    loadConversationList()
  }, [loaded])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeConversation?.messages, streamingContent])

  const handleAction = useCallback(async (action: PromptAction, content?: string) => {
    if (isGenerating) return
    const text = content || editorContent || ""
    if (!text.trim()) return

    setGenerating(true)
    setStreamingContent("")
    abortRef.current = new AbortController()

    const shared = {
      action,
      content: text,
      selection: editorSelection,
      documentTitle,
      documentType,
      canvasContext,
      scratchpad,
      templateSections,
      libraryRefs,
      signal: abortRef.current.signal,
    }

    try {
      if (settings.streaming) {
        await agent.executeStream(
          { ...shared, onChunk: (chunk: string) => setStreamingContent((prev) => prev + chunk) },
          (chunk: string) => setStreamingContent((prev) => prev + chunk),
          abortRef.current.signal,
        )
      } else {
        const result = await agent.execute(shared)
        setStreamingContent(result.content)
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Agent error:", err)
      }
    } finally {
      setGenerating(false)
      setStreamingContent("")
      abortRef.current = null
    }
  }, [isGenerating, editorContent, editorSelection, documentTitle, documentType, canvasContext, scratchpad, templateSections, libraryRefs, settings.streaming])

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    handleAction("custom", input)
    setInput("")
  }, [input, handleAction])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setGenerating(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === "Escape") {
      if (isGenerating) handleCancel()
      else onClose()
    }
  }, [handleSend, handleCancel, isGenerating, onClose])

  const messages = activeConversation?.messages ?? []

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 32,
        bottom: 0,
        width: 320,
        background: "var(--surface, #222)",
        borderLeft: "1px solid var(--border, #2e2e2e)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Share Tech Mono', monospace",
      }}
      className="shadow-lg"
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid var(--border, #2e2e2e)" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--accent, #c8f135)", fontWeight: 600 }}>AI Assistant</span>
        <div className="flex items-center gap-1">
          {conversations.length > 0 && (
            <button
              onClick={() => setActiveConversation(null)}
              className="rounded p-1 text-muted hover:text-foreground hover:bg-background transition-colors"
              title="New conversation"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground hover:bg-background transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 8px", borderBottom: "1px solid var(--border, #2e2e2e)" }}>
        {QUICK_ACTIONS.map(({ action, icon: Icon, label }) => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-border rounded hover:bg-background transition-colors disabled:opacity-40"
            style={{ color: "var(--accent, #c8f135)" }}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {messages.length === 0 && !streamingContent && (
          <p className="text-[10px] text-muted text-center mt-8">Select an action or type a message</p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 8, padding: "6px 8px", borderRadius: 0, background: msg.role === "assistant" ? "var(--background, #181818)" : "transparent" }}>
            <span style={{ fontSize: 8, color: "var(--accent, #c8f135)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {msg.role}
            </span>
            <p style={{ fontSize: 10, color: "var(--foreground, #e8e8e8)", marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg.content}
            </p>
          </div>
        ))}

        {streamingContent && (
          <div style={{ marginBottom: 8, padding: "6px 8px", borderRadius: 0, background: "var(--background, #181818)" }}>
            <span style={{ fontSize: 8, color: "var(--accent, #c8f135)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              assistant
            </span>
            <p style={{ fontSize: 10, color: "var(--foreground, #e8e8e8)", marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {streamingContent}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isGenerating ? (
        <div style={{ padding: "8px", borderTop: "1px solid var(--border, #2e2e2e)" }}>
          <button
            onClick={handleCancel}
            className="flex items-center justify-center gap-2 w-full py-2 text-[10px] font-mono border border-red-400/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Cancel generation
          </button>
        </div>
      ) : (
        <div style={{ padding: "8px", borderTop: "1px solid var(--border, #2e2e2e)" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={2}
              style={{
                flex: 1,
                background: "var(--background, #181818)",
                border: "1px solid var(--border, #2e2e2e)",
                borderRadius: 0,
                padding: "5px 8px",
                color: "var(--foreground, #e8e8e8)",
                fontSize: 10,
                outline: "none",
                resize: "none",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex items-center justify-center px-2 border border-accent/30 rounded hover:bg-accent/10 transition-colors disabled:opacity-30"
              style={{ color: "var(--accent, #c8f135)" }}
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
