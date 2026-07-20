import { Link } from "react-router-dom";
import { SelfPortrait } from "../components/SelfPortrait";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
import { themeForMotif } from "../theme/personalityTheme";
import { usePersonalityTheme } from "../theme/usePersonalityTheme";
import { useProjectStore } from "../store/ProjectStore";

export function PortraitPage() {
  const { model, verified, loading, apiAvailable } = useProjectStore();

  usePersonalityTheme(model?.theme ?? themeForMotif("form"));

  if (loading) {
    return (
      <main className="app empty">
        <p>Loading agent…</p>
      </main>
    );
  }

  if (!model) {
    return (
      <main className="app empty">
        <p>
          No agent found. Point Aletheia at a folder containing an eve agent
          (<code>agent/agent.ts</code>).
        </p>
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
          <span className="wordmark-sub">see what an agent can do</span>
        </div>
        {apiAvailable && <WorkspaceSwitcher />}
        {apiAvailable && (
          <div className="topbar-actions">
            <Link to="/gallery" className="btn-ghost">
              Gallery
            </Link>
            <Link to="/manifesto" className="btn-ghost">
              Manifesto
            </Link>
            <Link to="/review" className="btn-primary">
              Capability review
            </Link>
          </div>
        )}
      </nav>

      <SelfPortrait agent={model} verified={verified} key={model.id} />

      <footer className="footer">
        <span>
          Read from <code>agent/</code> — the files are the truth.
        </span>
      </footer>
    </main>
  );
}
