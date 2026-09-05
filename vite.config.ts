import { fileURLToPath } from "url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The Studio SPA. Built into dist/studio, served by `boundary-guard studio`. */
export default defineConfig({
  root: "studio",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./studio/src", import.meta.url)) },
  },
  build: { outDir: "../dist/studio", emptyOutDir: true },
  server: {
    port: 5173,
    // `pnpm dev studio --no-open` on 8080 provides the API while Vite serves the SPA with HMR.
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
});
