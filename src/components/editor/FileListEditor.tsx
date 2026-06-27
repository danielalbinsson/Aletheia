import type { EntityKind } from "../../serializer/eveSerializer";

interface FileListEditorProps {
  files: string[];
  activeFile: string | null;
  onSelect: (path: string) => void;
  onAdd: () => void;
  onRemove: (path: string) => void;
  kind: EntityKind;
}

const KIND_LABELS: Record<EntityKind, string> = {
  tools: "tool",
  channels: "channel",
  schedules: "schedule",
  subagents: "subagent",
  skills: "skill",
};

export function FileListEditor({
  files,
  activeFile,
  onSelect,
  onAdd,
  onRemove,
  kind,
}: FileListEditorProps) {
  return (
    <div className="file-list-editor">
      <div className="file-list-header">
        <span className="file-list-count">
          {files.length} {KIND_LABELS[kind]}
          {files.length === 1 ? "" : "s"}
        </span>
        <button type="button" className="btn-ghost" onClick={onAdd}>
          + Add
        </button>
      </div>
      <ul className="file-list">
        {files.map((path) => (
          <li key={path} className={path === activeFile ? "active" : ""}>
            <button type="button" className="file-list-item" onClick={() => onSelect(path)}>
              {path.split("/").pop()}
            </button>
            <button
              type="button"
              className="file-list-remove"
              aria-label={`Remove ${path}`}
              onClick={() => onRemove(path)}
            >
              ×
            </button>
          </li>
        ))}
        {files.length === 0 && (
          <li className="file-list-empty">No {KIND_LABELS[kind]} files yet.</li>
        )}
      </ul>
    </div>
  );
}
