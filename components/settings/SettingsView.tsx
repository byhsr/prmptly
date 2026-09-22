import { useState } from "react"
import { Appearance } from "./Appearance"
import { Editor } from "./Editor"
import { General } from "./General"
import { About } from "./About"

const TABS = {
  appearance: { label: "Appearance", component: Appearance },
  editor: { label: "Editor", component: Editor },
  general: { label: "General", component: General },
  about: { label: "About", component: About },
} as const

type TabKey = keyof typeof TABS

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<TabKey>("appearance")
  const ActiveComponent = TABS[activeTab].component

  return (
    <div className="flex h-full">
      <div className="w-48 shrink-0 border-r border-border p-3 space-y-0.5">
        {(Object.entries(TABS) as [TabKey, typeof TABS[TabKey]][]).map(([key, tab]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              activeTab === key
                ? "bg-background text-foreground"
                : "text-muted hover:bg-background/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        <ActiveComponent />
      </div>
    </div>
  )
}
