import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { useUpdateStore } from "@/hooks/store/updateStore"
import { Button } from "./Button"

export const UpdateNotice = () => {
    const { status, version, notes, progress, error, dismissed, install, dismiss } = useUpdateStore()

    const busy = status === "downloading" || status === "installing"
    // A failed install is worth surfacing; a failed background check is not.
    const visible =
        !dismissed &&
        (status === "available" || busy || (status === "error" && version !== null))

    const label =
        status === "available" ? "update available"
            : status === "downloading" ? "downloading update"
                : status === "installing" ? "installing — restarting"
                    : "update failed"

    return createPortal(
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="update-notice"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="fixed top-14 right-4 z-[9999] rounded-xl border border-border bg-surface p-3 shadow-lg"
                    style={{ width: "clamp(240px, 20vw, 320px)" }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-foreground">{label}</span>
                        {!busy && (
                            <button
                                onClick={dismiss}
                                aria-label="dismiss update notice"
                                className="text-muted transition-colors hover:text-foreground"
                            >
                                <X className="h-3 w-3" aria-hidden />
                            </button>
                        )}
                    </div>

                    {version && <p className="mt-1 font-mono text-[10px] text-muted">v{version}</p>}

                    {status === "available" && notes && (
                        <p className="mt-1 max-h-16 overflow-y-auto overflow-x-hidden font-mono text-[10px] text-muted">
                            {notes}
                        </p>
                    )}

                    {status === "error" && error && (
                        <p className="mt-1 break-words font-mono text-[10px] text-danger">{error}</p>
                    )}

                    {busy && (
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
                            <div
                                className="h-full bg-accent transition-[width] duration-200"
                                style={{ width: `${status === "installing" ? 100 : progress}%` }}
                            />
                        </div>
                    )}

                    {status === "available" && (
                        <motion.div
                            whileTap={{ scale: 0.88 }}
                            transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            className="mt-3"
                        >
                            <Button
                                variant="accent"
                                size="sm"
                                className="focus-ring w-full"
                                onClick={install}
                            >
                                update now
                            </Button>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    )
}
