// stores/useTabsStore.ts
import { create } from "zustand"
import { Tab } from "@/components/core-components/Tabbar"
import { ViewType } from "@/lib/types/DashTypes"

type TabsState = {
  tabs: Tab[]
  activeTabId: string | null
  isDash : boolean
  sidebarOpen: boolean
  isSettingsOpen: boolean,
  setIsSettingsOpen: (v: boolean) => void
  setDash : () => void // this toggles off the sidebar collapse button if not on dash 
  setActiveView : (view : ViewType) => void
  setTabs: (tabs: Tab[]) => void
  setActiveTab: (id: string) => void
  addTab: (tab: Tab) => void
  closeTab: (id: string) => void
  activeView : ViewType
  toggleSidebar: () => void
}

export const useTabViewStore = create<TabsState>((set) => ({
  tabs: [],
  activeTabId: null,
  activeView : "home",
  sidebarOpen: true,
  isDash : false,
  isSettingsOpen: false,
  setIsSettingsOpen: (v: boolean) => set({ isSettingsOpen: v }),
  setDash : () => set({ isDash : true }),
  setActiveView : (view : ViewType) => set({ activeView : view }),
  setTabs: (tabs) => set({ tabs }),
  setActiveTab: (id) => set({ activeTabId: id }),

  addTab: (tab) =>
  set((state) => {
    const exists = state.tabs.find(t => t.id === tab.id)

    if (exists) {
      return {
        activeTabId: tab.id
      }
    }

    return {
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }
  }),

  closeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id)

      return {
        tabs: newTabs,
        activeTabId:
          state.activeTabId === id
            ? newTabs[newTabs.length - 1]?.id ?? null
            : state.activeTabId,
      }
    }),

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))