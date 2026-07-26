import { useEffect, useState } from "react";
import { join } from "@tauri-apps/api/path";

import "./App.css";

import Dash from "../components/core-components/Dash";
import Onboarding from "@/components/core-components/Onboard";
import { TabBar } from "@/components/core-components/Tabbar";
import { SidebarNotifications } from "@/components/ui/Notifier";
import { SettingsModal } from "@/components/settings/SettingsModal";

import { initDB } from "@/lib/db";
import {
  readConfig,
  setupWorkspace,
  writeConfig,
} from "@/lib/fs/fs";
import { initWorkspace } from "@/lib/fs/fsHelpers";

import { useSettingsStore } from "@/hooks/store/settingsStore";
import { useTabViewStore } from "@/hooks/store/TabStore";
import { FONTS } from "@/lib/config/settings";

function App() {
  const [, setDarkMode] = useState(true);
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    async function loadTheme() {
      const config = await readConfig();

      const isDark = config?.theme !== "light";

      setDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
      if (config?.theme && config.theme !== "dark" && config.theme !== "light") {
        document.documentElement.dataset.theme = config.theme;
      }
    }

    loadTheme();
  }, []);

  // Apply font families
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-heading", FONTS[settings.fonts.heading]?.family ?? "Inter");
    root.style.setProperty("--font-body", FONTS[settings.fonts.body]?.family ?? "Inter");
    root.style.setProperty("--font-mono", FONTS[settings.fonts.mono]?.family ?? "'Geist Mono', monospace");

    // Update theme inline font-family too
    root.style.fontFamily = `var(--font-body)`;
  }, [settings.fonts]);

  // Apply heading sizes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--heading-h1", `${settings.headingSizes.h1}rem`);
    root.style.setProperty("--heading-h2", `${settings.headingSizes.h2}rem`);
    root.style.setProperty("--heading-h3", `${settings.headingSizes.h3}rem`);
  }, [settings.headingSizes]);

  // toggleTheme — kept for future use

  return (
    <main className="w-full">
      <nav className="overflow-clip">
        <TabBar />
      </nav>

      <section className="w-full">
        <AppFlow />
      </section>
    </main>
  );
}

export default App;

export const AppFlow = () => {
  const [dbReady, setDbReady] = useState(false);
  const [workspacePath, setWorkspacePath] = useState("");

  const { isSettingsOpen, setIsSettingsOpen } = useTabViewStore();

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const config = await readConfig();

      if (
        !config?.workspaceRoot ||
        !config?.activeWorkspace
      ) {
        setDbReady(true);
        return;
      }

      const workspacePath = await join(
        config.workspaceRoot,
        config.activeWorkspace
      );

      initWorkspace(workspacePath);

      await setupWorkspace(workspacePath);
      await initDB(workspacePath);

      setWorkspacePath(workspacePath);
      setDbReady(true);

      await useSettingsStore.getState().init();

      console.log("Workspace initialized:", workspacePath);
    } catch (err) {
      console.error("Bootstrap failed:", err);
    }
  }

  async function onDone(
    workspaceRoot: string,
    workspaceName = "default"
  ) {
    const workspacePath = await join(
      workspaceRoot,
      workspaceName
    );

    await writeConfig({
      onboarded: true,
      workspaceRoot,
      activeWorkspace: workspaceName,
    });

    initWorkspace(workspacePath);

    await setupWorkspace(workspacePath);
    await initDB(workspacePath);

    setWorkspacePath(workspacePath);
    setDbReady(true);

    await useSettingsStore.getState().init();
  }

  if (!dbReady) return <div>Loading...</div>;

  if (!workspacePath) {
    return <Onboarding onDone={onDone} />;
  }

  return (
    <>
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <SidebarNotifications />

      <Dash dbReady={dbReady} />
    </>
  );
};