import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import "@fontsource/cal-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@xyflow/react/dist/style.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
