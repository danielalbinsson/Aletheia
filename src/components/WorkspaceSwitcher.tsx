import { useState } from "react";
import { useProjectStore } from "../store/ProjectStore";

/**
 * Point Aletheia at any eve agent: browse to a folder, then choose an agent to
 * inspect. Switching drives the portrait + capability review (read-only);
 * Edit/Run/Observe stay on the working project.
 */
export function WorkspaceSwitcher() {
  const {
    workspaces,
    scanWorkspaceRoot,
    pickWorkspaceFolder,
    selectWorkspace,
    loading,
  } = useProjectStore();
  const [rootInput, setRootInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);

  if (!workspaces) return null;

  const { agents, activePath, scanRoot } = workspaces;
  const discovered = agents.filter((a) => !a.isDefault).length;

  async function onBrowse() {
    setBusy(true);
    try {
      await pickWorkspaceFolder();
    } finally {
      setBusy(false);
    }
  }

  async function onManualScan(e: React.FormEvent) {
    e.preventDefault();
    if (!rootInput.trim()) return;
    setBusy(true);
    try {
      await scanWorkspaceRoot(rootInput.trim());
      setShowManual(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws-switcher">
      <label className="ws-select-label">
        <span className="ws-eyebrow">Inspecting</span>
        <select
          className="ws-select"
          value={activePath}
          disabled={loading}
          onChange={(e) => void selectWorkspace(e.target.value)}
        >
          {agents.map((a) => (
            <option key={a.path} value={a.path}>
              {a.name}
              {a.isDefault ? " — working project" : ""}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="btn-ghost ws-browse"
        onClick={() => void onBrowse()}
        disabled={busy}
      >
        {busy ? "Opening…" : discovered > 0 ? `${discovered} found · Browse…` : "Browse folder…"}
      </button>

      {scanRoot && (
        <span className="ws-scan-hint" title={scanRoot}>
          {scanRoot}
        </span>
      )}

      <button
        type="button"
        className="ws-manual-toggle"
        onClick={() => setShowManual((v) => !v)}
        aria-expanded={showManual}
      >
        type a path
      </button>

      {showManual && (
        <form className="ws-folder-form" onSubmit={onManualScan}>
          <input
            type="text"
            className="ws-folder-input"
            placeholder="Folder to scan, e.g. ~/Documents"
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy || !rootInput.trim()}>
            Scan
          </button>
        </form>
      )}
    </div>
  );
}
