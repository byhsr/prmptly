import { useEffect, useState } from "react";
import Dash from "../components/core-components/Dash"
import "./App.css";
import {  initDB } from "@/lib/db";
import { readConfig, setupWorkspace, writeConfig } from "@/lib/fs/fs";
import { initBasePath } from "@/lib/fs/fsHelpers";
import Onboarding from "@/components/core-components/Onboard";
import { TabBar } from "@/components/core-components/Tabbar";
import { SidebarNotifications } from "@/components/ui/Notifier";
import { useSettingsStore } from "@/hooks/store/settimgsStore";
import { useTabViewStore } from "@/hooks/store/TabStore";
import { SettingsModal } from "@/components/settings/SettingsModal";

function App() {
 const [darkMode, setDarkMode] = useState(true)
  console.log("saved layout on load:", localStorage.getItem("panel-layout"))
   useEffect(() => {
    async function loadTheme() {
      const config = await readConfig()

      const isDark = config?.theme !== "light"

      setDarkMode(isDark)

      document.documentElement.classList.toggle("dark", isDark)
    }

    loadTheme()
  }, [])

   async function toggleTheme() {
    const next = !darkMode

    setDarkMode(next)

    document.documentElement.classList.toggle("dark", next)

    await writeConfig({
      theme: next ? "dark" : "light",
    })
  }
  return (
    <main className="w-full ">
      <nav className="overflow-clip">
        <TabBar />
      </nav>
      <section className="w-full ">
        <AppFlow />
      </section>
    </main>
  );
}

export default App;


export const AppFlow = () => {
  const [dbReady, setDbReady] = useState(false)
  const [basePath, setBasePath] = useState("")
  const { isSettingsOpen, setIsSettingsOpen } = useTabViewStore()
  useEffect(() => {
    (async () => {
      try {
        const config = await readConfig()
        console.log("config:", config)
        if (!config?.base_path) {
          setDbReady(true)
          return
        }

        const basePath = config.base_path  // fixed: was basPath (typo) + shadowed state var
        console.log("basePath:", basePath)

        initBasePath(basePath)
        await initDB(basePath)
        await setupWorkspace(basePath)

        console.log("APP initialized with basePath:", basePath)

        setBasePath(basePath)
        setDbReady(true)

        useSettingsStore.getState().hydrate()

      } catch (e) {
        console.error("APP init failed", e)
      }
    })()
  }, [])

  const onDone = async (newPath : string) => {
      initBasePath(newPath)
      await initDB(newPath)
      await setupWorkspace(newPath)
      setBasePath(newPath)
  }

  if (!dbReady) return <div>wait</div>
  if (!basePath) return (
    <Onboarding onDone={() => onDone} />
  )
  return ( <div>
    {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    <SidebarNotifications />
    <Dash dbReady={dbReady} />
  </div> )

}


