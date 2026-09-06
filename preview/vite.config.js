import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served by ../server.js under /preview/ locally; for GitHub Pages use GITHUB_PAGES base.
const isGH = process.env.GITHUB_PAGES === "true";
export default defineConfig({
  base: isGH ? "/design-system-viewer/preview/" : "/preview/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: true },
  server: {
    port: 4174,
    // `npm run dev` here needs the token API from the main server.
    proxy: { "/api": "http://localhost:4173" },
  },
});
