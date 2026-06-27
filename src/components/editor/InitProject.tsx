import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createBlankProject } from "../../serializer/eveSerializer";
import { useProjectStore } from "../../store/ProjectStore";

export function InitProject() {
  const navigate = useNavigate();
  const { initProjectOnDisk, apiAvailable, error } = useProjectStore();
  const [submitting, setSubmitting] = useState(false);

  async function handleInit() {
    setSubmitting(true);
    try {
      const raw = createBlankProject();
      await initProjectOnDisk(raw);
      navigate("/edit");
    } catch {
      // error surfaced via store
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app create-agent">
      <header className="editor-topbar">
        <div className="wordmark">
          <Link to="/" className="wordmark-link">
            Aletheia
          </Link>
          <span className="wordmark-sub">initialize</span>
        </div>
      </header>

      {!apiAvailable && (
        <p className="editor-banner warn">
          Initialization requires the dev server. Run <code>pnpm dev</code> to write to{" "}
          <code>agent/</code>.
        </p>
      )}

      <div className="create-form">
        <h1 className="create-title">Initialize agent project</h1>
        <p className="create-lead">
          Creates the standard eve layout under <code>agent/</code> —{" "}
          <code>agent.ts</code>, <code>instructions.md</code>, and a starter tool.
        </p>

        {error && <p className="editor-banner error">{error}</p>}

        <div className="create-actions">
          <Link to="/" className="btn-ghost">
            Cancel
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={handleInit}
            disabled={!apiAvailable || submitting}
          >
            {submitting ? "Creating…" : "Initialize & edit"}
          </button>
        </div>
      </div>
    </main>
  );
}
