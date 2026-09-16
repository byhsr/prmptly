import { useEffect, useState } from "react";
import { join } from "@tauri-apps/api/path";
import "./App.css";

import Dash from "../components/core-components/Dash";
import Onboarding from "@/components/core-components/Onboard";
import { TabBar } from "@/components/core-components/Tabbar";
import { SidebarNotifications } from "@/components/ui/Notifier";
import { UpdateNotice } from "@/components/ui/UpdateNotice";
import { SettingsModal } from "@/components/settings/SettingsModal";

import { ErrorBoundary } from "../components/core-components/ErrorBoundary";

import { initDB } from "@/lib/db";
import { readConfig, setupWorkspace, writeConfig } from "@/lib/fs/fs";
import { initWorkspace } from "@/lib/fs/fsHelpers";
import { useSettingsStore } from "@/hooks/store/settingsStore";
import { FONTS } from "@/lib/config/settings";
import { useTabViewStore } from "@/hooks/store/TabStore";
import { useUpdateStore } from "@/hooks/store/updateStore";
import { useVaultStore } from "@/hooks/store/VaultStore";

function App() {
  // Kicked off from the shell rather than AppFlow so an available update still
  // surfaces while the user is sitting on onboarding.
  useEffect(() => {
    useUpdateStore.getState().check();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav style={{ flexShrink: 0 }}>
        <ErrorBoundary><TabBar /></ErrorBoundary>
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <ErrorBoundary><AppFlow /></ErrorBoundary>
      </div>
      <UpdateNotice />
    </div>
  );
}

export default App;

export const AppFlow = () => {
  const [dbReady, setDbReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState("");
  const { isSettingsOpen, setIsSettingsOpen } = useTabViewStore();
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => { bootstrap(); }, []);

  // Apply font + heading-size settings as CSS custom properties on <html>.
  // App.css maps font-sans -> var(--font-body) and font-mono -> var(--font-code) inside
  // `@theme inline`, so setting those two is what actually changes the rendered fonts.
  useEffect(() => {
    const root = document.documentElement.style;
    const setFont = (name: string, key: string) => {
      const family = FONTS[key]?.family;
      // Keep the :root default rather than writing an empty family
      if (family) root.setProperty(name, family);
    };
    setFont("--font-heading", settings.fonts.heading);
    setFont("--font-body", settings.fonts.body);
    setFont("--font-code", settings.fonts.mono);
    root.setProperty("--heading-h1", `${settings.headingSizes.h1}rem`);
    root.setProperty("--heading-h2", `${settings.headingSizes.h2}rem`);
    root.setProperty("--heading-h3", `${settings.headingSizes.h3}rem`);
  }, [settings]);

  async function bootstrap() {
    try {
      const config = await readConfig();
      if (!config?.workspaceRoot || !config?.activeWorkspace) { setDbReady(true); return; }

      // `activeWorkspace` holds a vault id, so resolve the path from the vault list. Older
      // configs only stored a folder name there — fall back to that and heal the config so
      // the switcher can list it.
      const vaults = config.workspaces ?? [];
      const known =
        vaults.find((v) => v.id === config.activeWorkspace) ??
        vaults.find((v) => v.name === config.activeWorkspace);
      const wp = known?.path ?? (await join(config.workspaceRoot, config.activeWorkspace));

      if (!known) {
        await writeConfig({
          workspaces: [
            ...vaults,
            {
              id: config.activeWorkspace,
              name: config.activeWorkspace,
              path: wp,
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }

      initWorkspace(wp);
      await setupWorkspace(wp);
      await initDB(wp);
      setWorkspacePath(wp);
      setDbReady(true);
      await useSettingsStore.getState().init();
      document.documentElement.classList.toggle("dark", config?.theme !== "light");
      if (config?.theme && config.theme !== "dark" && config.theme !== "light")
        document.documentElement.dataset.theme = config.theme;
    } catch (err) {
      // Never leave the app on the loading screen with no explanation — surface it.
      console.error("Bootstrap failed:", err);
      setBootError(err instanceof Error ? err.message : String(err));
      setDbReady(true);
    }
  }

  async function onDone(workspaceRoot: string, workspaceName = "default") {
    const wp = await join(workspaceRoot, workspaceName);
    // Register the first vault properly so the topbar switcher can list it
    const vault = {
      id: crypto.randomUUID(),
      name: workspaceName,
      path: wp,
      createdAt: new Date().toISOString(),
    };
    await writeConfig({
      onboarded: true,
      workspaceRoot,
      activeWorkspace: vault.id,
      workspaces: [vault],
    });
    // The vault switcher hydrates on mount, which already happened by now, so it
    // would stay hidden until a restart without this.
    await useVaultStore.getState().hydrate();
    initWorkspace(wp); await setupWorkspace(wp); await initDB(wp);
    setWorkspacePath(wp); setDbReady(true);
    await useSettingsStore.getState().init();
  }

  if (!dbReady) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="font-mono text-[11px] text-muted">opening vault…</span>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-foreground">Couldn't open this vault.</p>
        <p className="max-w-md font-mono text-[11px] text-muted">{bootError}</p>
        <button
          onClick={() => window.location.reload()}
          className="focus-ring rounded-xl border border-border bg-surface px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:bg-background hover:text-foreground"
        >
          try again
        </button>
      </div>
    );
  }

  if (!workspacePath) return <Onboarding onDone={onDone} />;

  return (
    <>
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      <SidebarNotifications />
      <Dash dbReady={dbReady} />
    </>
  );
};
