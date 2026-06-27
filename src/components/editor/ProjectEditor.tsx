import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SelfPortrait } from "../SelfPortrait";
import { CodeEditor } from "./CodeEditor";
import { FileListEditor } from "./FileListEditor";
import { useUnsavedGuard } from "../../hooks/useUnsavedGuard";
import { useProjectStore } from "../../store/ProjectStore";
import {
  addEntity,
  listEntityFiles,
  removeAgentFile,
  updateIdentity,
  type EntityKind,
} from "../../serializer/eveSerializer";
import { extractOpenRouterModelId } from "../../serializer/openRouterAgent";
import { themeForMotif } from "../../theme/personalityTheme";
import { usePersonalityTheme } from "../../theme/usePersonalityTheme";

type Section =
  | "identity"
  | "instructions"
  | "tools"
  | "channels"
  | "schedules"
  | "skills"
  | "subagents";

const SECTIONS: { id: Section; label: string; kind?: EntityKind }[] = [
  { id: "identity", label: "Identity" },
  { id: "instructions", label: "Instructions" },
  { id: "tools", label: "Tools", kind: "tools" },
  { id: "channels", label: "Channels", kind: "channels" },
  { id: "schedules", label: "Schedules", kind: "schedules" },
  { id: "skills", label: "Skills", kind: "skills" },
  { id: "subagents", label: "Subagents", kind: "subagents" },
];

function field(src: string, key: string): string {
  const m = src.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`));
  return m?.[1]?.trim() ?? "";
}

export function ProjectEditor() {
  const {
    project,
    draft,
    draftModel,
    dirty,
    loadDraft,
    setDraft,
    setDraftFile,
    discardDraft,
    saveDraft,
    buildProject,
    error,
    statusMessage,
    clearStatus,
    validationIssues,
    apiAvailable,
  } = useProjectStore();

  const [section, setSection] = useState<Section>("identity");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState<string | null>(null);

  useUnsavedGuard(dirty);

  useEffect(() => {
    if (project) loadDraft();
  }, [project, loadDraft]);

  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(clearStatus, 3000);
      return () => clearTimeout(t);
    }
  }, [statusMessage, clearStatus]);

  usePersonalityTheme(draftModel?.theme ?? themeForMotif("form"));

  const agentTs = draft?.files["agent.ts"] ?? "";
  const instructions = draft?.files["instructions.md"] ?? "";
  const identity = useMemo(() => {
    const introBody = instructions.replace(/^#\s+.*\n*/m, "").split(/^##\s+/m)[0].trim();
    const firstPara = introBody.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
    return {
      name: instructions.match(/^#\s+(.+)$/m)?.[1] ?? field(agentTs, "name"),
      model: extractOpenRouterModelId(agentTs) || field(agentTs, "model"),
      description: firstPara,
    };
  }, [agentTs, instructions]);

  const currentKind = SECTIONS.find((s) => s.id === section)?.kind;
  const entityFiles = draft && currentKind ? listEntityFiles(draft, currentKind) : [];

  useEffect(() => {
    if (section === "instructions") {
      setActiveFile("instructions.md");
    } else if (currentKind) {
      const files = draft ? listEntityFiles(draft, currentKind) : [];
      setActiveFile(files[0] ?? null);
    } else {
      setActiveFile(null);
    }
  }, [section, currentKind, draft]);

  if (!project || !draft) {
    return (
      <main className="app empty">
        <p>No project to edit.</p>
        <Link to="/">Back home</Link>
      </main>
    );
  }

  async function handleBuild() {
    setBuilding(true);
    setBuildLog(null);
    try {
      const result = await buildProject();
      const log = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      setBuildLog(log || (result.ok ? "Build succeeded." : "Build failed."));
    } catch (err) {
      setBuildLog(err instanceof Error ? err.message : "Build failed.");
    } finally {
      setBuilding(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDraft();
    } finally {
      setSaving(false);
    }
  }

  function handleIdentityChange(fields: Partial<typeof identity>) {
    setDraft(updateIdentity(draft!, { ...identity, ...fields }));
  }

  function handleAddEntity() {
    if (!currentKind || !draft) return;
    const slug = window.prompt(`New ${currentKind.slice(0, -1)} slug (e.g. my-tool):`);
    if (!slug?.trim()) return;
    try {
      const next = addEntity(draft, currentKind, slug.trim());
      setDraft(next);
      const files = listEntityFiles(next, currentKind);
      setActiveFile(files[files.length - 1] ?? null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not add file");
    }
  }

  function handleRemoveEntity(path: string) {
    if (!draft) return;
    if (!window.confirm(`Remove ${path}?`)) return;
    const next = removeAgentFile(draft, path);
    setDraft(next);
    if (currentKind) {
      const files = listEntityFiles(next, currentKind);
      setActiveFile(files[0] ?? null);
    }
  }

  const editorValue = activeFile ? draft.files[activeFile] ?? "" : "";
  const editorLanguage = activeFile?.endsWith(".md") ? "markdown" : "typescript";

  return (
    <main className="app editor-app">
      <header className="editor-topbar">
        <div className="wordmark">
          <Link to="/" className="wordmark-link">
            Aletheia
          </Link>
          <span className="wordmark-sub">editing agent/</span>
        </div>
        <div className="editor-actions">
          {dirty && <span className="dirty-pill">Unsaved</span>}
          <Link to="/" className="btn-ghost">
            View portrait
          </Link>
          <Link to="/run" className="btn-ghost">
            Run & deploy
          </Link>
          <Link to="/observe" className="btn-ghost">
            Observability
          </Link>
          <button type="button" className="btn-ghost" onClick={discardDraft} disabled={!dirty}>
            Discard
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleBuild}
            disabled={!apiAvailable || building || dirty}
            title={dirty ? "Save before building" : undefined}
          >
            {building ? "Building…" : "eve build"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={!dirty || !apiAvailable || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {!apiAvailable && (
        <p className="editor-banner warn">
          Saving requires the dev server. Run <code>pnpm dev</code> to write to disk.
        </p>
      )}
      {error && <p className="editor-banner error">{error}</p>}
      {statusMessage && <p className="editor-banner ok">{statusMessage}</p>}
      {validationIssues.length > 0 && (
        <p className="editor-banner warn">
          {validationIssues.map((i) => `${i.path}: ${i.message}`).join(" · ")}
        </p>
      )}
      {buildLog && (
        <pre className="build-log">{buildLog}</pre>
      )}

      <div className="editor-layout">
        <aside className="editor-sidebar">
          <nav className="editor-sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`editor-section-btn ${section === s.id ? "active" : ""}`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {section === "identity" && (
            <div className="identity-form">
              <label className="field">
                <span className="field-label">Slug</span>
                <input className="field-input" value={draft.id} readOnly />
              </label>
              <label className="field">
                <span className="field-label">Name</span>
                <input
                  className="field-input"
                  value={identity.name}
                  onChange={(e) => handleIdentityChange({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Model (OpenRouter id)</span>
                <input
                  className="field-input"
                  value={identity.model}
                  onChange={(e) => handleIdentityChange({ model: e.target.value })}
                  placeholder="anthropic/claude-sonnet-4"
                />
              </label>
              <label className="field">
                <span className="field-label">Description</span>
                <textarea
                  className="field-textarea"
                  rows={4}
                  value={identity.description}
                  onChange={(e) =>
                    handleIdentityChange({ description: e.target.value })
                  }
                />
              </label>
            </div>
          )}

          {currentKind && (
            <FileListEditor
              kind={currentKind}
              files={entityFiles}
              activeFile={activeFile}
              onSelect={setActiveFile}
              onAdd={handleAddEntity}
              onRemove={handleRemoveEntity}
            />
          )}
        </aside>

        <div className="editor-main">
          <div className="editor-preview">
            <p className="editor-preview-label">Live preview</p>
            {draftModel ? (
              <div className="editor-preview-inner">
                <SelfPortrait agent={draftModel} />
              </div>
            ) : (
              <p className="editor-preview-empty">Preview unavailable — check file syntax.</p>
            )}
          </div>

          {activeFile && (
            <div className="editor-code-pane">
              <div className="editor-code-header">
                <code>{activeFile}</code>
              </div>
              <CodeEditor
                key={activeFile}
                value={editorValue}
                language={editorLanguage}
                onChange={(v) => setDraftFile(activeFile, v)}
              />
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <span>
          Editing <code>agent/</code> — save writes to disk.
        </span>
      </footer>
    </main>
  );
}
