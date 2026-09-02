import { defineConfig } from "vite";
import { builtinModules } from "node:module";

const externals = [
  "vscode",
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
  /^@earendil-works\//,
];

export default defineConfig({
  build: {
    ssr: true,
    sourcemap: true,
    minify: false,
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/extension.ts",
      formats: ["es"],
      fileName: () => "extension.js",
    },
    rollupOptions: {
      external: externals,
    },
    target: "node22",
  },
  ssr: {
    external: externals,
  },
});
