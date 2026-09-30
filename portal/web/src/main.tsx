import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app";

// The Vite entry (index.html), and the only module outside the layers: it
// mounts the app layer's public API and nothing else (ADR-027).
const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
