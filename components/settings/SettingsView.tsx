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
      <div className="w-48 border-r border-border p-4 space-y-1">
        {(Object.entries(TABS) as [TabKey, typeof TABS[TabKey]][]).map(([key, tab]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`block w-full text-left px-3 py-2 text-sm ${
              activeTab === key ? "bg-neutral-800 text-accent" : "text-neutral-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <ActiveComponent />
      </div>
    </div>
  )
}
