import { useState } from "react";
import { useProjectStore } from "../store/ProjectStore";

/**
 * Point Aletheia at any eve agent: pick from the discovered agents, or open the
 * Folder popover to browse to / type a folder to scan. Switching drives the
 * whole app (portrait + authority diff).
 */
export function WorkspaceSwitcher() {
  const {
    workspaces,
    scanWorkspaceRoot,
    pickWorkspaceFolder,
    selectWorkspace,
    loading,
    error,
  } = useProjectStore();
  const [rootInput, setRootInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (!workspaces) return null;

  const { agents, activePath, scanRoot } = workspaces;
  const discovered = agents.filter((a) => !a.isDefault).length;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function onManualScan(e: React.FormEvent) {
    e.preventDefault();
    if (!rootInput.trim()) return;
    await run(async () => {
      await scanWorkspaceRoot(rootInput.trim());
      setOpen(false);
    });
  }

  return (
    <div className="ws-switcher">
      <label className="ws-select-label">
        <span className="ws-eyebrow">Agent</span>
        <select
          className="ws-select"
          value={activePath}
          disabled={loading}
          onChange={(e) => void selectWorkspace(e.target.value)}
        >
          {agents.map((a) => (
            <option key={a.path} value={a.path}>
              {a.name}
              {a.isDefault ? " — default" : ""}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="btn-ghost ws-folder-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Folder{discovered > 0 ? ` · ${discovered}` : ""}
      </button>

      {open && (
        <div className="ws-popover">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void run(pickWorkspaceFolder)}
          >
            {busy ? "Opening…" : "Browse…"}
          </button>
          <span className="ws-or">or</span>
          <form className="ws-path-form" onSubmit={onManualScan}>
            <input
              type="text"
              className="ws-folder-input"
              placeholder="Type a folder, e.g. ~/Documents"
              value={rootInput}
              onChange={(e) => setRootInput(e.target.value)}
            />
            <button type="submit" className="btn-ghost" disabled={busy || !rootInput.trim()}>
              Scan
            </button>
          </form>
          {scanRoot && (
            <p className="ws-scan-hint">
              Scanning {scanRoot} — {discovered} agent{discovered === 1 ? "" : "s"} found
            </p>
          )}
        </div>
      )}

      {error && <p className="ws-error">{error}</p>}
    </div>
  );
}
