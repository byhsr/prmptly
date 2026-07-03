import { X, PanelLeftClose, PanelLeft, Home, FileText, Layout, Settings2Icon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTabViewStore } from "@/hooks/store/TabStore";
import { ViewType } from "@/lib/types/DashTypes";
export interface Tab {
  id: string;
  label: string;
  type: ViewType;
  isDirty?: boolean; // unsaved changes indicator
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}



const appWindow = getCurrentWindow()
// Tiny dot to indicate tab type 
function TabTypeDot({ type }: { type: ViewType }) {
  const colors: Record<ViewType, string> = {
    home: "transparent",
    prompt: "#c8f135",
    template: "#6ee7f7",
    library: "#a78bfa",
    settings: "#c8f135",
  };
  //   if (type === "home") return null;
  return (
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        backgroundColor: colors[type],
        display: "inline-block",
        flexShrink: 0,
        opacity: 0.85,
      }}
    />
  );
}




export function TabBar() {
  const { tabs, activeTabId, isDash, setActiveTab, closeTab, sidebarOpen, toggleSidebar , setActiveView, isSettingsOpen, setIsSettingsOpen} = useTabViewStore()
  return (
    <div  data-tauri-drag-region className="border-b min-h-8 p-2 w-full items-center flex justify-between">
      <div className="items-center flex ">
        {/* Drag region (ONLY LEFT) */}
        <div   
          className=" flex items-center shrink-0 h-full select-none"
          style={{ minWidth: 140, paddingLeft: 8, paddingRight: 12, gap: 8 }}
        >
          <button
            onClick={() => toggleSidebar()}
            className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-background transition-colors"
            style={{ flexShrink: 0 }}
          >
            {isDash && <div> {sidebarOpen ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeft className="h-3.5 w-3.5" />
            )}</div>}
          </button>
          <button
  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
  className={`rounded-lg p-1.5 transition-colors ${
    isSettingsOpen ? "text-primary bg-background" : "text-muted hover:text-foreground hover:bg-background"
  }`}
>
  <Settings2Icon className="h-3.5 w-3.5" />
</button>
          <span
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
              fontWeight: 800,
              color: "#c8f135",
              letterSpacing: "-0.5px",
              userSelect: "none",
            }}
          >
            prmptly
          </span>
        </div>

        {/* Tabs */}
        <div className="flex w-fit items-center px-2 gap-2 overflow-x-auto ">
          {tabs.map((tab) => {
            if (tab.type === "home") return
            const isActive = activeTabId === tab.id

            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setActiveView(tab.type)
                }}
                style={{ height: 28 }}
                className={`flex items-center bg-surface rounded-lg gap-1 px-3 cursor-pointer text-xs font-mono transition-colors
               ${isActive
                    ? " border-b border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
              >
                <span>{ isActive &&<TabTypeDot type={tab.type} />}</span>
                <span className="truncate ">{tab.label}</span>

                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  className="ml-1 w-3.5 h-3.5 rounded-sm flex items-center justify-center 
               text-muted-foreground hover:text-foreground hover:bg-muted-foreground/20 
               transition-colors"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 h-full ">

      </div>

      {/* Window controls */}
      <div
        className="flex justify-end items-center w-fitl shrink-0"
        style={{ paddingRight: 6, gap: 2 }}
      >
        <button
          onClick={() => appWindow.minimize()}
          className="flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
          style={{ width: 30, height: 26, fontSize: 15 }}
        >
          &#8211;
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
          style={{ width: 30, height: 26, fontSize: 10 }}
        >
          &#9633;
        </button>
        <button
          onClick={() => appWindow.close()}
          className="flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-red-500 transition-colors"
          style={{ width: 30, height: 26, fontSize: 14 }}
        >
          &#x2715;
        </button>
      </div>
    </div>
  )
}


