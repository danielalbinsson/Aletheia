import { Link } from "react-router-dom";
import { SelfPortrait } from "../components/SelfPortrait";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
import { themeForMotif } from "../theme/personalityTheme";
import { usePersonalityTheme } from "../theme/usePersonalityTheme";
import { useProjectStore } from "../store/ProjectStore";

export function PortraitPage() {
  const { model, verified, loading, apiAvailable, inspectingOther, workspaces } =
    useProjectStore();

  usePersonalityTheme(model?.theme ?? themeForMotif("form"));

  if (loading) {
    return (
      <main className="app empty">
        <p>Loading project…</p>
      </main>
    );
  }

  if (!model) {
    return (
      <main className="app empty">
        <p>
          No agent project found. Initialize <code>agent/</code> to get started.
        </p>
        {apiAvailable && (
          <Link to="/init" className="btn-primary empty-cta">
            Initialize agent project
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="app">
      <nav className="topbar">
        <div className="wordmark">
          <Link to="/" className="wordmark-link">
            Aletheia
          </Link>
          <span className="wordmark-sub">see your agent</span>
        </div>
        {apiAvailable && <WorkspaceSwitcher />}
        {apiAvailable && (
          <div className="topbar-actions">
            {inspectingOther ? (
              <span className="topbar-note" title="Edit, Run and Observe act on the working project. Switch back to it to use them.">
                Read-only inspection
              </span>
            ) : (
              <>
                <Link to="/run" className="btn-ghost">
                  Run
                </Link>
                <Link to="/observe" className="btn-ghost">
                  Observe
                </Link>
                <Link to="/edit" className="btn-ghost">
                  Edit
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      {inspectingOther && workspaces && (
        <p className="inspect-banner">
          Inspecting <strong>{model.name}</strong> — read-only. Edit, Run and Observe act on
          your working project.
        </p>
      )}

      <SelfPortrait agent={model} verified={verified} key={model.id} />

      <footer className="footer">
        <span>
          Read from <code>agent/</code> — the files are the truth.
        </span>
      </footer>
    </main>
  );
}
