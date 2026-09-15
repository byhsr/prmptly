
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Copy, Check } from "lucide-react"
import { codeToHtml } from "shiki"
import { usePromptStore, OutputFormat } from "@/hooks/store/PromptStore"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

export function PromptPanel() {
  const reduced = usePrefersReducedMotion()
  const [copied, setCopied] = useState(false)
  const [highlighted, setHighlighted] = useState("")
  const { compiledOutput, outputFormat, setOutputFormat } = usePromptStore()

  useEffect(() => {
    if (!compiledOutput) return setHighlighted("")
    const lang =
      outputFormat === "json" ? "json" : outputFormat === "xml" ? "xml" : "markdown"
    codeToHtml(compiledOutput, {
      lang,
      theme: "vesper",
    }).then(setHighlighted)
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
          {(["plain", "json", "xml"] as OutputFormat[]).map((f) => (
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
            className="h-full overflow-y-auto rounded-lg bg-background p-4 text-sm font-mono leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:whitespace-pre-wrap [&_code]:break-words"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <pre className="h-full overflow-y-auto rounded-lg bg-background p-4 text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap break-words">
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