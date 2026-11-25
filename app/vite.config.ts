import { defineConfig } from "vite";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: { outDir: "dist/client", emptyOutDir: true, assetsInlineLimit: 0 },
});
