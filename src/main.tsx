import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Production ships without devtools, so the webview's native menu (refresh,
// print, inspect) offers end users nothing but a way out of the app. Dev keeps
// it for inspection. preventDefault only suppresses the native menu — the app's
// own onContextMenu handlers still fire.
if (!import.meta.env.DEV) {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
