import { useEffect, useRef, type ReactNode } from "react"

// One inline create field shared by every sidebar tree, so creating a folder reads and
// behaves the same in quicks, prompts and skills. Enter commits, Escape or blur cancels.
export function InlineInput({
  depth = 0,
  placeholder = "Name...",
  icon,
  onConfirm,
  onCancel,
}: {
  depth?: number
  placeholder?: string
  icon?: ReactNode
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="flex items-center gap-1.5 px-2 py-1" style={{ paddingLeft: 8 + depth * 12 }}>
      {icon}
      <input
        ref={ref}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.repeat) {
            const val = ref.current?.value.trim()
            if (val) onConfirm(val)
            else onCancel()
          }
          if (e.key === "Escape") onCancel()
        }}
        onBlur={onCancel}
        className="flex-1 min-w-0 bg-background border border-border rounded px-1 py-0.5 text-[11px] font-mono text-foreground outline-none focus:border-foreground/40"
      />
    </div>
  )
}
