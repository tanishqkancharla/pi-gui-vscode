import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [solid()],
  root: ".",
  base: "./",
  build: {
    outDir: "out",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve("src/webview/main.tsx"),
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "index[extname]",
      },
    },
  },
  server: {
    port: 43118,
    strictPort: true,
    host: "127.0.0.1",
  },
});
