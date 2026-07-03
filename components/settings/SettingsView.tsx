import { useState } from "react"
import { Appearance } from "./Appearance"
import { Vaults }from "./Vaults"
import { Editor }from "./Editor"
import { AI }from "./AI"
import { About } from "./About"

const TABS = {
  appearance: { label: "Appearance", component: Appearance },
  vaults: { label: "Vaults", component: Vaults },
  editor: { label: "Editor", component: Editor },
  ai: { label: "AI", component: AI },
  about: { label: "About", component: About },
} as const

type TabKey = keyof typeof TABS

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<TabKey>("appearance")
  const ActiveComponent = TABS[activeTab].component

  return (
    <div className="flex h-full">
      <div className="w-48 border-r border-neutral-800 p-4 space-y-1">
        {(Object.entries(TABS) as [TabKey, typeof TABS[TabKey]][]).map(([key, tab]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`block w-full text-left px-3 py-2 text-sm ${
              activeTab === key ? "bg-neutral-800 text-lime-400" : "text-neutral-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6">
        <ActiveComponent />
      </div>
    </div>
  )
}