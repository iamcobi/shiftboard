import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({ server: { entry: "server" } }),
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
    react(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
