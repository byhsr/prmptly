"use client"

import { useState } from "react"
import { Canvas } from "../canvas/Canvas"
import { usePromptStore } from "@/hooks/store/PromptStore"
import { CanvasFlow } from "@/lib/types/canvas.types"

export function ScratchpadPanel() {
  const { scratchpadText, updateScratchpad } = usePromptStore()

  const [showCanvas, setShowCanvas] = useState(false)

  const [flow, setFlow] = useState<CanvasFlow>({
    nodes: [],
    edges: [],
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Scratchpad
        </span>

        <button
          onClick={() => setShowCanvas((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            showCanvas ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
              showCanvas ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {showCanvas ? (
          <Canvas
            initialFlow={flow}
            onChange={setFlow}
          />
        ) : (
          <div className="h-full p-4">
            <textarea
              value={scratchpadText}
              onChange={(e) => updateScratchpad(e.target.value)}
              placeholder="Brain dump here. Messy is fine."
              className="h-full w-full resize-none rounded-lg bg-background p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}