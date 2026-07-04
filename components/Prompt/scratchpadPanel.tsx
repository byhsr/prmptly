"use client"

import { usePromptStore } from "@/hooks/store/PromptStore"

export function ScratchpadPanel() {
  const { scratchpadText, updateScratchpad } = usePromptStore()

  return (
    <div className="flex h-full flex-col p-4">
      <textarea
        value={scratchpadText}
        onChange={(e) => updateScratchpad(e.target.value)}
        placeholder="Brain dump here. Messy is fine."
        className="flex-1 w-full rounded-lg bg-background p-4 text-sm text-foreground placeholder:text-muted/60 focus:outline-none resize-none font-mono leading-relaxed"
      />
    </div>
  )
}