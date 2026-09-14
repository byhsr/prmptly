import { useEffect, useState } from "react";
import { join } from "@tauri-apps/api/path";
import "./App.css";

import Dash from "../components/core-components/Dash";
import Onboarding from "@/components/core-components/Onboard";
import { TabBar } from "@/components/core-components/Tabbar";
import { SidebarNotifications } from "@/components/ui/Notifier";
import { SettingsModal } from "@/components/settings/SettingsModal";

import { ErrorBoundary } from "../components/core-components/ErrorBoundary";

import { initDB } from "@/lib/db";
import { readConfig, setupWorkspace, writeConfig } from "@/lib/fs/fs";
import { initWorkspace } from "@/lib/fs/fsHelpers";
import { useSettingsStore } from "@/hooks/store/settingsStore";
import { FONTS } from "@/lib/config/settings";
import { useTabViewStore } from "@/hooks/store/TabStore";

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav style={{ flexShrink: 0 }}>
        <ErrorBoundary><TabBar /></ErrorBoundary>
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <ErrorBoundary><AppFlow /></ErrorBoundary>
      </div>
    </div>
  );
}

export default App;

export const AppFlow = () => {
  const [dbReady, setDbReady] = useState(false);
  const [workspacePath, setWorkspacePath] = useState("");
  const { isSettingsOpen, setIsSettingsOpen } = useTabViewStore();
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => { bootstrap(); }, []);

  // Apply font + heading-size settings as CSS custom properties on <html>.
  // Inline styles on :root win over the @theme defaults, so font-sans / font-mono
  // utilities and the .smart-editor-content headings follow the settings.
  useEffect(() => {
    const root = document.documentElement.style;
    const family = (key: string) => FONTS[key]?.family ?? "";
    root.setProperty("--font-heading", family(settings.fonts.heading));
    root.setProperty("--font-body", family(settings.fonts.body));
    root.setProperty("--font-sans", family(settings.fonts.body));
    root.setProperty("--font-mono", family(settings.fonts.mono));
    root.setProperty("--heading-h1", `${settings.headingSizes.h1}rem`);
    root.setProperty("--heading-h2", `${settings.headingSizes.h2}rem`);
    root.setProperty("--heading-h3", `${settings.headingSizes.h3}rem`);
  }, [settings]);

  async function bootstrap() {
    try {
      const config = await readConfig();
      if (!config?.workspaceRoot || !config?.activeWorkspace) { setDbReady(true); return; }
      const wp = await join(config.workspaceRoot, config.activeWorkspace);
      initWorkspace(wp);
      await setupWorkspace(wp);
      await initDB(wp);
      setWorkspacePath(wp);
      setDbReady(true);
      await useSettingsStore.getState().init();
      document.documentElement.classList.toggle("dark", config?.theme !== "light");
      if (config?.theme && config.theme !== "dark" && config.theme !== "light")
        document.documentElement.dataset.theme = config.theme;
    } catch (err) { console.error("Bootstrap failed:", err); }
  }

  async function onDone(workspaceRoot: string, workspaceName = "default") {
    const wp = await join(workspaceRoot, workspaceName);
    await writeConfig({ onboarded: true, workspaceRoot, activeWorkspace: workspaceName });
    initWorkspace(wp); await setupWorkspace(wp); await initDB(wp);
    setWorkspacePath(wp); setDbReady(true);
    await useSettingsStore.getState().init();
  }

  if (!dbReady) return <div>Loading...</div>;
  if (!workspacePath) return <Onboarding onDone={onDone} />;

  return (
    <>
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      <SidebarNotifications />
      <Dash dbReady={dbReady} />
    </>
  );
};
