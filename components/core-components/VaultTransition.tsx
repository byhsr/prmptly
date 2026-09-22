import { motion } from "framer-motion"

interface VaultTransitionProps {
  label?: string
  /** cover the whole window instead of filling the app area */
  overlay?: boolean
}

// Shown while a vault is opened (boot) or swapped (which reloads the webview, so the
// same screen carries across the reload rather than flashing the old UI away).
export function VaultTransition({ label = "opening vault…", overlay = false }: VaultTransitionProps) {
  return (
    <div
      className={overlay ? "fixed inset-0 z-[10000]" : "h-full w-full"}
      style={{ background: "var(--color-background, var(--background, #191919))" }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-6">
        <motion.div
          className="relative flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        >
          {/* soft accent bloom behind the mark */}
          <motion.span
            className="absolute rounded-full blur-2xl"
            style={{ width: 96, height: 96, background: "var(--accent)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.12, 0.28, 0.12] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <img
            src="/favicon.ico.png"
            alt="prmptly"
            className="relative"
            style={{ width: 56, height: 56 }}
          />
        </motion.div>

        <div className="flex flex-col items-center gap-3">
          {/* indeterminate sweep — reads as progress without claiming a percentage */}
          <div className="h-px w-28 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ background: "var(--accent)" }}
              animate={{ x: ["-120%", "420%"] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <motion.span
            className="font-mono text-[11px] text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.3 }}
          >
            {label}
          </motion.span>
        </div>
      </div>
    </div>
  )
}
