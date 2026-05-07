import { SquareAsterisk, X } from "lucide-react"
import { useState } from "react"
import {Button} from "../ui/button"
import { Snippet } from "@/lib/types/library"
import { cn } from "@/lib/utils"

// type SnippetModalProps = {
//   onClose: () => void
//   onSave: (data: { scope?: string; key: string; value: string }) => void
//   existingScopes?: string[]
// }

// export const SnippetModal = ({ onClose, onSave, existingScopes = [] }: SnippetModalProps) => {
//   const [scope, setScope] = useState("")
//   const [key, setKey] = useState("")
//   const [value, setValue] = useState("")

//   const handleSave = () => {
//     if (!key.trim() || !value.trim()) return
//     onSave({ scope: scope.trim() || undefined, key: key.trim(), value: value.trim() })
//     onClose()
//   }

//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === "Escape") onClose()
//     if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave()
//   }

//   const callsign = scope.trim()
//     ? `@${scope.trim()}:${key.trim()}`
//     : `@${key.trim()}`

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-2xl bg-black/20 "
//       onClick={(e) => e.target === e.currentTarget && onClose()}
//       onKeyDown={handleKeyDown}
//     >
//       <div
//         className="flex flex-col gap-4 rounded-2xl  bg-surface w-[70%] h-[60%]"
//       >
//         {/* Header */}
//         <div
//           className="flex items-center border-b p-4 justify-between"
//         >
//           <div className="flex items-center gap-2 border-b">
//             <SquareAsterisk style={{ width: 13, height: 13, color: "var(--color-accent)" }} />
//             <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
//               New Snippet
//             </span>
//           </div>
//           <button
//             onClick={onClose}
//             className="bg-accent p-1 text-black rounded-sm"
//           >
//             <X style={{ width: 13, height: 13 }} />
//           </button>
//         </div>

//         {/* Body */}
//         <div className="flex flex-col flex-1 gap-4 p-6 " >

//           {/* Scope + Key row */}
//           <div className="flex gap-2">
//             <Field label="Scope" optional style={{ flex: "0 0 140px" }}>
//               <input
//                 value={scope}
//                 onChange={(e) => setScope(e.target.value)}
//                 placeholder="global"
//                 list="scope-list"
//                 autoComplete="off"
//                 style={inputStyle}
//               />
//               <datalist id="scope-list">
//                 {existingScopes.map((s) => <option key={s} value={s} />)}
//               </datalist>
//             </Field>

//             <Field label="Key" style={{ flex: 1 }}>
//               <div style={{ position: "relative" }}>
//                 <input
//                   value={key}
//                   onChange={(e) => setKey(e.target.value)}
//                   placeholder="key-name"
//                   autoFocus
//                   style={{ ...inputStyle, paddingLeft: 20 }}
//                 />
//               </div>
//             </Field>
//           </div>

//           {/* Value */}
//           <Field label="Value">
//             <textarea
//               value={value}
//               onChange={(e) => setValue(e.target.value)}
//               placeholder="Snippet content…"
//               rows={6}
//               className="resize-none overflow-y-auto outline-0"
//             />
//           </Field>

//           {/* Callsign preview */}

//         </div>

//         {/* Footer */}
//         <div
//           className="flex items-center justify-between gap-2 p-4 "
//         >

//           <div className="border">

//             {/* <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginRight: "auto", fontFamily: "var(--font-mono)" }}>
//               ⌘↵ to save
//             </span> */}
//             <span style={{ color: "var(--color-accent)" }}>{callsign}</span>
//           </div>
//           <div className="flex gap-4">
//             <Button variant="ghost" onClick={onClose}>
//               Cancel
//             </Button>
//             <Button
//               onClick={handleSave}
//               // disabled={!key.trim() || !value.trim()}
//               variant="flask"
//             >
//               Save Snippet
//             </Button>


//           </div>

//         </div>
//       </div>
//     </div>
//   )
// }

type SnippetModalProps = {
  onClose: () => void
  onSave: (data: { scope?: string; key: string; value: string }) => void
  existingScopes?: string[]
  snippet?: Snippet
}

export const SnippetModal = ({ onClose, onSave, existingScopes = [], snippet }: SnippetModalProps) => {
  const isEditing = !!snippet

  const [scope, setScope] = useState(snippet?.scope ?? "")
  const [key, setKey] = useState(snippet?.key ?? "")
  const [value, setValue] = useState(snippet?.value ?? "")

  const handleSave = () => {
    if (!key.trim() || !value.trim()) return
    onSave({ scope: scope.trim().toLowerCase() || undefined, key: key.trim().toLowerCase(), value: value.trim() })
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose()
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave()
  }

  const callsign = scope.trim()
    ? `@${scope.trim().toLowerCase()}:${key.trim().toLowerCase()}`
    : `@${key.trim().toLowerCase()}`
.toLowerCase()
  return (
    <div
      className="w-full h-full flex items-center justify-center backdrop-blur-2xl bg-background"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col  rounded-2xl w-full h-full">

        {/* Header */}
        <div className="flex items-center border-b p-4 justify-between">
          <div className="flex items-center gap-2">
            <SquareAsterisk style={{ width: 13, height: 13, color: "var(--color-accent)" }} />
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
              {isEditing ? `Edit — ${snippet.key}` : "New Snippet"}
            </span>
          </div>
          <div>
            <div className="flex gap-4">
              <div className=" px-2 py-1 rounded">
                <span style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                  {callsign}
                </span>
              </div>
              
              <Button onClick={handleSave} variant="ghost">
                {isEditing ? "Update Snippet" : "Save Snippet"}
              </Button>
              <Button onClick={onClose} variant="danger">
                 <X className="w-3 h-3" />
              </Button>
              {/* <button onClick={onClose} className="bg-accent p-1 text-black rounded-sm">
                
              </button> */}
            </div>

          </div>


        </div>

        {/* Body */}
        <div className="flex bg-surface flex-col flex-1 gap-4 ">
          <div className="flex gap-2 border-b p-6 ">
            <Field label="Scope" optional className="text-muted text-sm">
              <input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="global"
                list="scope-list"
                autoComplete="off"
                style={{ textTransform: "lowercase" }}
                className="outline-0 text-foreground text-sm"
              />
              <datalist id="scope-list">
                {existingScopes.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>

            <Field label="Key" className="text-muted text-sm">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="key-name"
                autoFocus
                style={{ textTransform: "lowercase" }}
                className="outline-0 text-foreground text-sm"
              />
            </Field>
          </div >
          
          <div className="flex flex-col flex-1 gap-4 p-6 ">
           <Field label="Value" className="text-muted text-sm ">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Snippet content…"
              rows={6}
              className="resize-none overflow-y-auto text-foreground outline-0"
            />
          </Field>
          </div>
          
        </div>

        {/* Footer */}
      </div>
    </div>
  )
}
const Field = ({ label, optional, children, className }: {
  label: string
  optional?: boolean
  children: React.ReactNode
  className?: string
}) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <label style={{ textTransform: "uppercase", fontWeight: "300", letterSpacing: "0.06em", display: "flex", alignItems: "center", }}>
      {label}
      {optional && <span style={{ fontSize: 9, textTransform: "none", letterSpacing: 0, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 3, padding: "0 4px" }}>optional</span>}
    </label>
    {children}
  </div>
)



