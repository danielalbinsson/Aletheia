import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { projectApiPlugin } from "./src/server/projectApiPlugin";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // ALETHEIA_WORKSPACE points the IDE at an external eve agent workspace to
  // view (the dir containing `agent/`, `.eve/`, `.aletheia/`). Defaults to the
  // bundled placeholder agent so the repo works out of the box.
  const env = loadEnv(mode, root, "");
  const workspaceRoot = env.ALETHEIA_WORKSPACE
    ? path.resolve(env.ALETHEIA_WORKSPACE)
    : root;
  const agentRoot = path.join(workspaceRoot, "agent");

  // Production (Vercel) ships under /aletheia so agentic-kit.dev/aletheia can
  // reverse-proxy the showcase. Local `pnpm dev` stays at `/`.
  const base = process.env.VERCEL ? "/aletheia/" : "/";

  return {
    plugins: [react(), projectApiPlugin(agentRoot, workspaceRoot)],
    base,
  };
});
