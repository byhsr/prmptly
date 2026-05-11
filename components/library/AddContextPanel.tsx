import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowLeft, Sparkles, FileText, Copy, Check, X } from "lucide-react"

const PREP_PROMPT = `Please clean and structure the following content for use as AI context. 
- Remove redundant or duplicate information
- Fix formatting issues
- Break into clear logical sections
- Keep all important facts, details, and relationships
- Output only the cleaned content, no commentary

Content:
`

interface Scope {
  id: string
  name: string
  count: number
}

interface AddContextPanelProps {
  scopes: Scope[]
  onSave: (scopeName: string, isNew: boolean, content: string) => Promise<void>
  onBack: () => void
}

export const AddContextPanel = ({ scopes, onSave, onBack }: AddContextPanelProps) => {
  const [scopeQuery, setScopeQuery] = useState("")
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
const [fileName, setFileName] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scopeInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLTextAreaElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filtered = scopes.filter(s =>
    s.name.toLowerCase().includes(scopeQuery.toLowerCase())
  )
  const showCreate = scopeQuery.trim().length > 0 && !scopes.find(
    s => s.name.toLowerCase() === scopeQuery.trim().toLowerCase()
  )

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleScopeSelect = (scope: Scope) => {
    setSelectedScope(scope)
    setScopeQuery(scope.name)
    setDropdownOpen(false)
  }

  const handleCreate = () => {
    const name = scopeQuery.trim()
    if (!name) return
    setSelectedScope({ id: "new", name, count: 0 })
    setDropdownOpen(false)
  }

  const handleFileRead = useCallback((file: File) => {
  if (!file.name.endsWith(".txt") && !file.name.endsWith(".md")) return
  const reader = new FileReader()
  reader.onload = e => {
    setContent(prev => prev + (prev ? "\n\n" : "") + (e.target?.result as string))
    setFileName(file.name)
  }
  reader.readAsText(file)
}, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    Array.from(e.dataTransfer.files).forEach(handleFileRead)
  }, [handleFileRead])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(handleFileRead)
    e.target.value = ""
  }

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(PREP_PROMPT)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!content.trim() || !scopeQuery.trim()) return
    setIsSaving(true)
    try {
      await onSave(scopeQuery.trim(), selectedScope?.id === "new" || !selectedScope, content.trim())
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = content.trim().length > 0 && scopeQuery.trim().length > 0 && !isSaving

  return (
    <motion.div
      className="w-full h-full flex flex-col p-8"

    >
        {/* main */}
    <div className="flex flex-col h-[90%] gap-4  ">
        {/* scope selector */}
        <div className="flex flex-col  min-w-[180px] gap-2" ref={wrapperRef}>
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted">scope</label>
        <div className="relative">
          <input
            ref={scopeInputRef}
            type="text"
            value={scopeQuery}
            onChange={e => {
              setScopeQuery(e.target.value)
              setSelectedScope(null)
              setDropdownOpen(true)
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="new scope or pick existing..."
            className="w-full px-3 p-3 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted/40 outline-none  transition-colors font-sans"
          />
          <AnimatePresence>
            {dropdownOpen && (filtered.length > 0 || showCreate) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute top-[calc(100%+8px)] left-2 right-2 z-20 bg-surface border-2 shadow-lg p-4 border-border rounded-xl overflow-hidden"
              >
                {filtered.map(scope => (
                  <button
                    key={scope.id}
                    onClick={() => handleScopeSelect(scope)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-border/30 transition-colors text-left"
                  >
                    <span>{scope.name}</span>
                    <span className="text-xs text-muted">{scope.count} {scope.count === 1 ? "item" : "items"}</span>
                  </button>
                ))}
                {showCreate && filtered.length > 0 && (
                  <div className="h-px bg-border mx-2" />
                )}
                {showCreate && (
                  <button
                    onClick={handleCreate}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-border/30 transition-colors text-left"
                  >
                    <span>+ create "{scopeQuery.trim()}"</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-col  gap-2 flex-1 min-h-0">
  <div className="flex items-center justify-between">
    <label className="text-[10px] font-medium uppercase tracking-widest text-muted">content</label>
    <button
      onClick={handleCopyPrompt}
      className="flex items-center gap-1.5 text-[11px] text-muted border border-border rounded-md px-2 py-1 hover:border-accent hover:text-accent transition-all"
    >
      {promptCopied ? <Check size={11} /> : <Sparkles size={11} />}
      {promptCopied ? "copied!" : "prep prompt"}
    </button>
  </div>

  <AnimatePresence mode="wait">
    {!content ? (
      /* ── Empty: textarea + drop zone ── */
      <motion.div
        key="empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative flex-1 min-h-0"
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <textarea
          ref={dropZoneRef}
          value={content}
          onChange={e => {
            setContent(e.target.value)
            setFileName(null)
          }}
          placeholder="paste your text here, or drop a .txt / .md file..."
          className="w-full  h-45 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted/40 outline-none transition-colors resize-none font-mono leading-relaxed"
          style={{ borderColor: isDragging ? "var(--accent)" : undefined }}
        />
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-xl bg-accent/5 border-2 border-dashed border-accent flex items-center justify-center pointer-events-none"
            >
              <div className="text-sm text-accent flex items-center gap-2">
                <FileText size={15} />
                drop to add
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    ) : (
      /* ── Filled: doc chip + optional preview ── */
      <motion.div
        key="filled"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className="flex flex-col gap-2 flex-1 min-h-0"
      >
        {/* Chip */}
        <button
          onClick={() => setPreviewOpen(p => !p)}
          className="flex items-center gap-2.5 px-3 py-6 rounded-xl bg-surface border border-border hover:border-muted/40 transition-all text-left group w-[30%]"
        >
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <FileText size={13} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">
              {fileName ?? "pasted text"}
            </div>
            <div className="text-[10px] text-muted">
              {content.length.toLocaleString()} chars
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted group-hover:text-foreground transition-colors">
              {previewOpen ? "hide" : "preview"}
            </span>
            <button
              onClick={e => {
                e.stopPropagation()
                setContent("")
                setFileName(null)
                setPreviewOpen(false)
              }}
              className="w-5 h-5 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-border/40 transition-all"
            >
              <X size={11} />
            </button>
          </div>
        </button>

        {/* Preview */}
        <AnimatePresence>
          {previewOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden flex-1 "
            >
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full h-full px-3 py-2.5 rounded-xl bg-surface border-border text-xs text-foreground outline-none focus:border-accent transition-colors resize-none font-mono leading-relaxed"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )}
  </AnimatePresence>

  <div className="flex items-center justify-between">
    <button
      onClick={() => fileInputRef.current?.click()}
      className="flex items-center gap-1.5 text-[11px] text-muted border border-border rounded-md px-2 py-1 hover:border-muted/40 hover:text-foreground transition-all"
    >
      <FileText size={11} />
      attach file
    </button>
  </div>

  <input
    ref={fileInputRef}
    type="file"
    accept=".txt,.md"
    multiple
    className="hidden"
    onChange={handleFileInput}
  />
</div>

    </div>

    
      {/* Footer */}
      <div className="flex items-center gap-4 justify-end ">
        <button
          onClick={onBack}
          className="text-sm px-4 py-2 rounded-xl border border-border text-muted hover:text-foreground hover:border-border/80 transition-all"
        >
          cancel
        </button>
        <motion.button
          onClick={handleSave}
          disabled={!canSave}
          whileTap={canSave ? { scale: 0.97 } : {}}
          className="text-sm px-5 py-2 rounded-xl bg-accent text-accent-foreground font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          {isSaving ? "saving..." : "save"}
        </motion.button>
      </div>
    </motion.div>
  )
}