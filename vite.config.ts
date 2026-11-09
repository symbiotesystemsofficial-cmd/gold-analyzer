import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Static build only — Vercel serves dist/ as-is, no server, no rewrites.
// base "./" keeps asset URLs relative so the same build also works when
// served from a sub-path.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
