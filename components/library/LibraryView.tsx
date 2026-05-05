
import { SquareAsterisk, Sparkle } from "lucide-react"
import { useState, useEffect } from "react"
import { SnippetModal } from "./SnippetModal"
import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { TabButton } from "../ui/TabButton"
import ContextSetupGate from "./EnableContext"
import { readConfig } from "@/lib/fs/fs"
import {motion} from "motion/react"

type LibraryTab = "snippets" | "context"

export const LibraryView = () => {
  const [activeTab, setActiveTab] = useState<LibraryTab>("snippets")
  const [createAsset, setCreateAsset] = useState<LibraryTab | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault()
        activeTab === "snippets" ? setCreateAsset("snippets") : setCreateAsset("context")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [activeTab])

  const buttonLabel = activeTab === "snippets" ? "new snippet" : "add context"
  return (
    <div className="w-full h-full flex flex-col text-sm">

      {createAsset === "snippets" ? <SnippetModal onClose={() => { setCreateAsset(null) }} onSave={() => { setCreateAsset(null) }} /> : ""}
      {/* Folder tab nav */}
      <div className="flex bg-surface px-4 items-end justify-between">

        <div className="flex  gap-0">
          {(["snippets", "context"] as LibraryTab[]).map((tab) => {
            const isActive = activeTab === tab
            const Icon = tab === "snippets" ? SquareAsterisk : Sparkle
            return (
              <TabButton
                key={tab}
                isActive={isActive}
                onClick={() => setActiveTab(tab)}
                className={cn("flex items-center justify-center", isActive ? "gap-2 px-4" : "gap-0 px-2")}
              >
                <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
                <span style={{
                  maxWidth: isActive ? 80 : 0,
                  opacity: isActive ? 1 : 0,
                  overflow: "hidden",
                  marginLeft: isActive ? 4 : 0,
                  transition: "max-width 0.15s ease, opacity 0.15s ease",
                }}>
                  {tab === "snippets" ? "Snippets" : "Context"}
                </span>
              </TabButton>
            )
          })}
        </div>


        <div className="flex  gap-4  text-[12px] p-2 px-6" >
          <Button variant="ghost" onClick={() => setCreateAsset(activeTab)}>
            {buttonLabel}
          </Button>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "snippets" && <SnippetsPanel />}
        {activeTab === "context" && <LocalRagPanel />}
      </div>

    </div>
  )
}

//  <div className="flex gap-0 ">
//           {(["snippets", "context"] as LibraryTab[]).map((tab) => {
//             const isActive = activeTab === tab
//             const Icon = tab === "snippets" ? SquareAsterisk : Sparkle
//             return (
//               <TabButton label="Snippets"
//                 isActive={activeTab === "snippets"}
//                 onClick={() => setActiveTab("snippets")}>
//                 {/* <button
//                 key={tab}
//                 onClick={() => setActiveTab(tab)}
//                 className={cn(
//                   "relative top-px flex items-center overflow-hidden whitespace-nowrap cursor-pointer rounded-t-3xl  transition-all duration-150",
//                   " border-secondary",
//                   "font-sans text-[11px]",
//                   isActive
//                     ? "gap-1.5 w-auto px-6 py-1.5 bg-background text-primary border-b-primary"
//                     : "gap-0 w-8 px-2 py-1.5 bg-secondary text-secondary border-b-secondary"
//                 )}
//               > */}
//                 <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
//                 <span style={{
//                   maxWidth: isActive ? 80 : 0,
//                   opacity: isActive ? 1 : 0,
//                   overflow: "hidden",
//                   transition: "max-width 0.15s ease, opacity 0.15s ease",
//                 }}>
//                   {tab === "snippets" ? "Snippets" : "Context"}
//                 </span>
//                 {/* </button> */}
//               </TabButton>
//             )
//           })}

//         </div>
const SnippetsPanel = ({activeAsset, creatingNew} : {activeAsset?: any, creatingNew?: boolean}) => {


  return <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4" style={{ color: "var(--color-text-secondary)" }}>
    <SquareAsterisk style={{ width: 24, height: 24 }} strokeWidth={1} />
    <span style={{ fontSize: 12 }}>No snippets yet</span>
  </div>
}
const LocalRagPanel = () => {
  const [hasModel, setHasModel] = useState<boolean | null>(null)

  useEffect(() => {
    readConfig().then(config => setHasModel(!!config.model))
  }, [])

  if (hasModel === null) return null // or a spinner
  if (!hasModel) return <div className="w-full h-full flex justify-center "><ContextSetupGate /></div> 

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4" style={{ color: "var(--color-text-secondary)" }}>
      <Sparkle style={{ width: 24, height: 24 }} strokeWidth={1} />
      <span style={{ fontSize: 12 }}>No context files yet</span>
    </div>
  )
}
{/*  */ }
{/* <ContextSetupGate /> */ }
