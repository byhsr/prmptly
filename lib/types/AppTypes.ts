export type Theme = "light" | "dark" | "system";

export interface AppConfig {
  base_path: string;
  theme?: Theme;
  model_path?: string;      // relative to base_path, set after first download
  has_model?: boolean;      // true after user downloads the model
}
