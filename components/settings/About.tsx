import { useEffect, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { Button } from "@/components/ui/Button"
import { useUpdateStore } from "@/hooks/store/updateStore"
import { cn } from "@/lib/utils"

// Dev builds have no published release to compare against, so the updater is
// deliberately inert there rather than reporting a permanent false negative.
const supported = !import.meta.env.DEV

export function About() {
    const [appVersion, setAppVersion] = useState("—")
    const status = useUpdateStore((s) => s.status)
    const latest = useUpdateStore((s) => s.version)
    const error = useUpdateStore((s) => s.error)
    const check = useUpdateStore((s) => s.check)

    useEffect(() => {
        getVersion().then(setAppVersion).catch(() => setAppVersion("—"))
    }, [])

    const checking = status === "checking"

    const statusLine =
        !supported ? "updates are disabled in development builds"
            : status === "checking" ? "checking…"
                : status === "current" ? "you're on the latest version"
                    : status === "available" ? `v${latest} is available — open the notice in the top right`
                        : status === "downloading" ? "downloading update…"
                            : status === "installing" ? "installing — the app will restart"
                                : status === "error" ? error ?? "update check failed"
                                    : null

    return (
        <div className="space-y-8 max-w-lg">
            <section>
                <h3 className="text-sm font-medium mb-3">prmptly</h3>
                <div className="space-y-2 text-xs text-muted">
                    <p>Version: <span className="text-foreground font-mono">{appVersion}</span></p>
                </div>
            </section>

            <section>
                <h3 className="text-sm font-medium mb-3">Updates</h3>
                <div className="space-y-3">
                    <Button
                        variant="flask"
                        size="md"
                        className="focus-ring"
                        disabled={checking || !supported}
                        onClick={() => check(true)}
                    >
                        {checking ? "checking…" : "check for updates"}
                    </Button>
                    {statusLine && (
                        <p className={cn("font-mono text-[11px]", status === "error" ? "text-danger" : "text-muted")}>
                            {statusLine}
                        </p>
                    )}
                </div>
            </section>
        </div>
    )
}
