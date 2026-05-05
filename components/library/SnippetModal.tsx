import { SquareAsterisk, X } from "lucide-react"
import { useState } from "react"
import { motion } from 'motion/react'
import { Button } from "../ui/button"

type SnippetModalProps = {
  onClose: () => void
  onSave: (data: { scope?: string; key: string; value: string }) => void
  existingScopes?: string[]
}

export const SnippetModal = ({ onClose, onSave, existingScopes = [] }: SnippetModalProps) => {
  const [scope, setScope] = useState("")
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")

  const handleSave = () => {
    if (!key.trim() || !value.trim()) return
    onSave({ scope: scope.trim() || undefined, key: key.trim(), value: value.trim() })
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose()
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave()
  }

  const callsign = scope.trim()
    ? `@${scope.trim()}:${key.trim()}`
    : `@${key.trim()}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-2xl bg-black/20 "
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div
        className="flex flex-col gap-4 rounded-2xl  bg-surface w-[70%] h-[60%]"
      >
        {/* Header */}
        <div
          className="flex items-center border-b p-4 justify-between"
        >
          <div className="flex items-center gap-2 border-b">
            <SquareAsterisk style={{ width: 13, height: 13, color: "var(--color-accent)" }} />
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
              New Snippet
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-accent p-1 text-black rounded-sm"
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 gap-4 p-6 " >

          {/* Scope + Key row */}
          <div className="flex gap-2">
            <Field label="Scope" optional style={{ flex: "0 0 140px" }}>
              <input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="global"
                list="scope-list"
                autoComplete="off"
                style={inputStyle}
              />
              <datalist id="scope-list">
                {existingScopes.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>

            <Field label="Key" style={{ flex: 1 }}>
              <div style={{ position: "relative" }}>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="key-name"
                  autoFocus
                  style={{ ...inputStyle, paddingLeft: 20 }}
                />
              </div>
            </Field>
          </div>

          {/* Value */}
          <Field label="Value">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Snippet content…"
              rows={6}
              className="resize-none overflow-y-auto outline-0"
            />
          </Field>

          {/* Callsign preview */}

        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-2 p-4 "
        >
       
          <div className="border">

            {/* <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginRight: "auto", fontFamily: "var(--font-mono)" }}>
              ⌘↵ to save
            </span> */}
            <span style={{ color: "var(--color-accent)" }}>{callsign}</span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              // disabled={!key.trim() || !value.trim()}
              variant="flask"
            >
              Save Snippet
            </Button>


          </div>

        </div>
      </div>
    </div>
  )
}

const Field = ({ label, optional, children, style }: {
  label: string
  optional?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
}) => (
  <div className="flex flex-col gap-2" style={style}>
    <label style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
      {label}
      {optional && <span style={{ fontSize: 9, textTransform: "none", letterSpacing: 0, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 3, padding: "0 4px" }}>optional</span>}
    </label>
    {children}
  </div>
)

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-background-primary)",
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: 6,
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  padding: "0 10px",
  height: 34,
  outline: "none",
}

const ghostBtnStyle: React.CSSProperties = {
  background: "none",
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: 6,
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "5px 12px",
  cursor: "pointer",
}