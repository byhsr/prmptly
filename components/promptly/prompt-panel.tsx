"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { usePromptStore, OutputFormat } from "@/hooks/store/PromptStore"

type Format = "plain" | "json" | "xml"

export function PromptPanel() {
  const [copied, setCopied] = useState(false)
  const { compiledOutput, outputFormat, setOutputFormat, sections } = usePromptStore()

  const formats = sections.length ? (["plain", "json", "xml"] as OutputFormat[]) : (["plain"] as OutputFormat[])


  const handleCopy = async () => {
    await navigator.clipboard.writeText(compiledOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Format Selector */}
      <div className="border-b border-border p-4">
        <div className="inline-flex rounded-lg bg-background p-1">
          {(["plain", "json", "xml"] as OutputFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setOutputFormat(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                outputFormat === f
                  ? "bg-border text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Block */}
      <div className="relative flex-1 overflow-hidden p-4">
        <pre className="h-full overflow-y-auto rounded-lg bg-background p-4 text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap break-words">
          {compiledOutput || <span className="text-muted">Fill in the builder to see your prompt here.</span>}
        </pre>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          disabled={!compiledOutput}
          className="absolute bottom-8 right-8 flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-accent" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}