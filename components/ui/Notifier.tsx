import { useNotifications } from "@/hooks/store/SidebarStore"
import { X } from "lucide-react"
import { createPortal } from "react-dom"
import {AnimatePresence, motion} from "motion/react"
import { cn } from "@/lib/utils"

export const SidebarNotifications = () => {
    const { notifications, dismiss } = useNotifications()

    if (!notifications.length) return null

    return createPortal(
        <div className="fixed top-14 right-4 z-[9999] flex flex-col gap-2"
            style={{ width: "clamp(240px, 20vw, 320px)" }}
        >
            <AnimatePresence>
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={cn('flex items-center justify-between gap-2 p-4 rounded-lg border border-border', n.error ? "bg-red-500" : "bg-background")}
                    >
                        <span className={`text-xs font-mono ${n.error ? "text-danger" : "text-muted-foreground"}`}>
                            {n.message}
                        </span>
                        <button
                            onClick={() => dismiss(n.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>,
        document.body
    )
}