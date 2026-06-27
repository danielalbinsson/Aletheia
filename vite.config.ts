import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { projectApiPlugin } from "./src/server/projectApiPlugin";
import { EVE_DEV_PORT } from "./src/server/eveDevServer";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), projectApiPlugin(path.join(root, "agent"), root)],
  base: "./",
  server: {
    proxy: {
      "/eve": {
        target: `http://127.0.0.1:${EVE_DEV_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
