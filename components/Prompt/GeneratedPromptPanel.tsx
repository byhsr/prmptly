
import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { Copy, Check } from "lucide-react"
import { usePromptStore, OutputFormat } from "@/hooks/store/PromptStore"
import { buildOutput } from "@/lib/editor/outputs"
import { getHighlighter, HIGHLIGHT_THEME, SHIKI_BLOCK_CLASS, type HighlightLang } from "@/lib/editor/highlighter"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import { cn } from "@/lib/utils"

export function PromptPanel() {
  const reduced = usePrefersReducedMotion()
  const [copied, setCopied] = useState(false)
  const [highlighted, setHighlighted] = useState("")
  const { body, outputFormat, setOutputFormat } = usePromptStore()

  // Derived on demand rather than stored — no per-keystroke serialization.
  const compiledOutput = useMemo(() => buildOutput(body, outputFormat), [body, outputFormat])

  useEffect(() => {
    if (!compiledOutput) {
      setHighlighted("")
      return
    }
    const lang: HighlightLang =
      outputFormat === "json" ? "json" : outputFormat === "xml" ? "xml" : "markdown"

    let live = true
    getHighlighter()
      .then((hl) => hl.codeToHtml(compiledOutput, { lang, theme: HIGHLIGHT_THEME }))
      .then((html) => {
        if (live) setHighlighted(html)
      })
    return () => {
      live = false
    }
  }, [compiledOutput, outputFormat])

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
          {(["markdown", "json", "xml"] as OutputFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setOutputFormat(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${outputFormat === f
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
        {highlighted ? (
          <div
            className={cn(
              SHIKI_BLOCK_CLASS,
              "h-full overflow-y-auto overflow-x-hidden rounded-lg bg-background p-4"
            )}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <pre className="h-full overflow-y-auto overflow-x-hidden rounded-lg bg-background p-4 text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap break-words">
            {compiledOutput || (
              <span className="text-muted">
                Fill in the builder to see your prompt here.
              </span>
            )}
          </pre>
        )}

        {/* Copy Button — same treatment as the quicks save bar */}
        <motion.button
          onClick={handleCopy}
          disabled={!compiledOutput}
          whileHover={reduced ? undefined : { scale: 1.05 }}
          whileTap={reduced ? undefined : { scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="focus-ring absolute bottom-18 right-8 inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 font-mono text-[11px] text-muted shadow-lg transition-colors hover:text-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? (
            <>
              <Check size={11} className="text-accent" aria-hidden="true" />
              copied
            </>
          ) : (
            <>
              <Copy size={11} aria-hidden="true" />
              copy
            </>
          )}
        </motion.button>
      </div>
    </div>
  )
}