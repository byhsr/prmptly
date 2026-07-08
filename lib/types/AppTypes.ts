export type Theme = "light" | "dark" | "system";

export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface AppConfig {
  onboarded: boolean;

  // Parent directory containing all workspaces
  workspaceRoot: string;

  // Active workspace id
  activeWorkspace: string;

  // Known workspaces
  workspaces: Workspace[];

  // App-wide settings
  theme?: Theme;
}