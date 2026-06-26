import { useState, type CSSProperties } from "react";
import { agents } from "./parser";
import { SelfPortrait } from "./components/SelfPortrait";
import { themeForMotif } from "./theme/personalityTheme";
import { usePersonalityTheme } from "./theme/usePersonalityTheme";

export function App() {
  const [activeId, setActiveId] = useState(agents[0]?.id);
  const agent = agents.find((a) => a.id === activeId) ?? agents[0];

  usePersonalityTheme(agent?.theme ?? themeForMotif("form"));

  if (!agent) {
    return (
      <main className="app empty">
        <p>No agents found under <code>/agents</code>.</p>
      </main>
    );
  }

  return (
    <main className="app">
      <nav className="topbar">
        <div className="wordmark">
          Aletheia<span className="wordmark-sub">see your agent</span>
        </div>
        {agents.length > 1 && (
          <div className="agent-tabs" role="tablist">
            {agents.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={a.id === agent.id}
                className={`agent-tab ${a.id === agent.id ? "active" : ""}`}
                style={{ "--tab-accent": a.theme.accent } as CSSProperties}
                onClick={() => setActiveId(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </nav>

      <SelfPortrait agent={agent} key={agent.id} />

      <footer className="footer">
        <span>
          Read from <code>/agents/{agent.id}</code> — the files are the truth.
        </span>
      </footer>
    </main>
  );
}
