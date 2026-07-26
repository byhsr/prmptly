"use client"

import { usePromptStore } from "@/hooks/store/PromptStore"

export function ScratchpadPanel() {
  const { scratchpadText, updateScratchpad } = usePromptStore()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Scratchpad
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full p-4">
          <textarea
            value={scratchpadText}
            onChange={(e) => updateScratchpad(e.target.value)}
            placeholder="Brain dump here. Messy is fine."
            className="h-full w-full resize-none rounded-lg bg-background p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
