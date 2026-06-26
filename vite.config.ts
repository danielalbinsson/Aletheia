import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Aletheia is a fully static app. Agent directories under /agents are read at
// build time via import.meta.glob (see src/parser/loadAgents.ts), so the whole
// thing ships as a single static bundle — easy to host, easy to screenshot.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
