import { Link } from "react-router-dom";
import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";
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
        <AppNav />
        <p>Loading agent…</p>
      </main>
    );
  }

  if (!model) {
    return (
      <main className="app empty">
        <AppNav />
        <p>
          No agent found. Point Aletheia at a folder containing an eve agent (
          <code>agent/agent.ts</code>).
        </p>
        <p className="empty-cta">
          <Link to="/" className="btn-ghost">
            About
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="app">
      <AppNav
        center={apiAvailable ? <WorkspaceSwitcher /> : undefined}
      />

      {!apiAvailable && (
        <p className="portrait-demo-note">
          Bundled demo, labeled <em>from source</em>. Inspect your own agents with the CLI or a
          local inspector.
        </p>
      )}

      <SelfPortrait agent={model} verified={verified} key={model.id} />

      <footer className="footer">
        <span>
          Read from <code>agent/</code>.
        </span>
      </footer>
      <AppFooter />
    </main>
  );
}
