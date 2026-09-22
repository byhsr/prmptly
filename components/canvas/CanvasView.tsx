import { useCallback, useEffect, useRef, useState } from "react"
import { Shapes } from "lucide-react"
import { useCanvasStore } from "@/hooks/store/canvasStore"
import { canvasService } from "@/services/service.canvas"
import type { CanvasDocument } from "@/lib/types/canvasDoc"

const WRITE_DEBOUNCE_MS = 800
const REVEAL_FALLBACK_MS = 2500

// ark ships its own dark/light tokens; anything custom (cyberpunk) reads as dark.
function arkTheme(): "dark" | "light" {
  const el = document.documentElement
  if (el.dataset.theme === "light") return "light"
  if (el.dataset.theme === "dark") return "dark"
  return el.classList.contains("dark") ? "dark" : "light"
}

export function CanvasView() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const selectedCanvasId = useCanvasStore((s) => s.selectedCanvasId)
  const load = useCanvasStore((s) => s.load)

  // ark is only ready after its async boot() resolves
  const arkReady = useRef(false)
  const loadedId = useRef<string | null>(null)
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ark boots to whatever is in its own localStorage; hold the frame back until the
  // vault doc has been handed over so the stale document never flashes.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (hydrated) return
    const t = setTimeout(() => setHydrated(true), REVEAL_FALLBACK_MS)
    return () => clearTimeout(t)
  }, [hydrated])

  const postToArk = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ source: "prmptly", ...msg }, "*")
  }, [])

  const loadCanvas = useCallback(async () => {
    if (!arkReady.current) return
    const id = useCanvasStore.getState().selectedCanvasId
    if (!id) return

    const doc = await canvasService.read(id)
    loadedId.current = id
    postToArk({ type: "ark:load", doc })
    setHydrated(true)
  }, [postToArk])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data
      if (!data || data.source !== "ark") return

      if (data.type === "ark:ready") {
        arkReady.current = true
        postToArk({ type: "ark:theme", theme: arkTheme() })
        loadCanvas()
        return
      }

      if (data.type === "ark:change" && data.doc) {
        // Write against the canvas that was loaded when the edit happened, so a quick
        // switch can't land the doc on the wrong file.
        const id = loadedId.current
        if (!id) return

        if (writeTimer.current) clearTimeout(writeTimer.current)
        writeTimer.current = setTimeout(async () => {
          await canvasService.write(id, data.doc as CanvasDocument)
          // keep the sidebar's updated_at ordering fresh
          useCanvasStore.getState().load()
        }, WRITE_DEBOUNCE_MS)
      }
    }

    window.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("message", onMessage)
      if (writeTimer.current) clearTimeout(writeTimer.current)
    }
  }, [postToArk, loadCanvas])

  useEffect(() => {
    loadCanvas()
  }, [selectedCanvasId, loadCanvas])

  if (!selectedCanvasId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-muted">
        <Shapes style={{ width: 24, height: 24 }} strokeWidth={1} />
        <span style={{ fontSize: 12 }}>no canvas selected — create one from the sidebar</span>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <iframe
        ref={iframeRef}
        src="/ark/index.html"
        title="Canvas"
        className="h-full w-full border-0 transition-opacity duration-150"
        style={{ opacity: hydrated ? 1 : 0 }}
      />
      {!hydrated && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[11px] text-muted">opening canvas…</span>
        </div>
      )}
    </div>
  )
}
