import { useEffect, useState } from "react"
import { readConfig } from "@/lib/fs/fs"
import type { AppConfig } from "@/lib/types/AppTypes"
import { listDocuments } from "@/lib/db/document"

export function General() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [promptCount, setPromptCount] = useState(0)

  useEffect(() => {
    readConfig().then(setConfig)
    listDocuments().then((d) => setPromptCount(d.length))
  }, [])

  return (
    <div className="space-y-8 max-w-lg">
      {/* Workspace */}
      <section>
        <h3 className="text-sm font-medium mb-3">Workspace</h3>
        <div className="space-y-2 text-xs text-muted">
          <p>Active workspace: <span className="text-foreground font-mono">{config?.activeWorkspace || "—"}</span></p>
          <p>Workspace root: <span className="text-foreground font-mono">{config?.workspaceRoot || "—"}</span></p>
          <p>Total documents: <span className="text-foreground font-mono">{promptCount}</span></p>
        </div>
      </section>

      {/* Default document */}
      <section>
        <h3 className="text-sm font-medium mb-3">Default Document</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1">Default name template</label>
            <input
              defaultValue="Untitled"
              className="w-full bg-transparent border border-border rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-foreground/30"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
