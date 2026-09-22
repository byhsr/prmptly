import { useEffect } from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { Tooltip } from "@/components/ui/Tooltip"
import { SettingsView } from "./SettingsView"

// Same overlay shell as the graph view: dim backdrop, bordered panel, header with a close
// button, and a short fade-in.
export function SettingsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.14 }}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col overflow-hidden rounded-xl border border-border"
        style={{
          width: "min(92vw, 960px)",
          height: "min(88vh, 680px)",
          background: "var(--color-surface, #0d0d0d)",
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
          <span className="text-sm font-medium text-foreground">settings</span>
          <Tooltip label="Close">
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-background hover:text-foreground"
              aria-label="Close settings"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>

        <div className="flex-1 min-h-0">
          <SettingsView />
        </div>
      </motion.div>
    </div>
  )
}
