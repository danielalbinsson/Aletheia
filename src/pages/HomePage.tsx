import { Link } from "react-router-dom";
import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";
import { useProjectStore } from "../store/ProjectStore";

const DOCS_QUICKSTART = `${import.meta.env.BASE_URL}docs/quickstart.md`;

export function HomePage() {
  const { apiAvailable } = useProjectStore();

  return (
    <main className="app home-app">
      <AppNav />

      <article className="home prose">
        <header className="home-hero">
          <h1>See what an agent can do</h1>
          <p className="home-lede">
            Aletheia is a local inspector for{" "}
            <a href="https://eve.dev" target="_blank" rel="noreferrer">
              eve
            </a>{" "}
            (Vercel) agents. It reads the agent's files and shows a first-person{" "}
            <strong>self-portrait</strong> — what it can do, touch, do on its own, and cannot — and
            an <strong>authority diff</strong> when that changes.
          </p>
        </header>

        <div className="home-split">
          <section>
            <h2>What it is</h2>
            <ul>
              <li>
                Inspector. Reads <code>agent/</code> and, when present, eve's compiled manifest.
              </li>
              <li>Local-first. The full tool runs on your machine. This site is a demo.</li>
              <li>
                Provenance. Facts from a build are <em>verified from build</em>. Everything else is{" "}
                <em>from source — build to verify</em>.
              </li>
            </ul>
          </section>
          <section>
            <h2>What it is not</h2>
            <ul>
              <li>It never runs, edits, or deploys the agent.</li>
              <li>This website cannot read your disk.</li>
              <li>
                Where eve does not expose a fact (approval gates, connection read/write), it leaves a
                gap.
              </li>
            </ul>
          </section>
        </div>

        <div className="home-cta">
          <Link to="/portrait" className="btn-primary">
            View demo portrait
          </Link>
          <Link to="/gallery" className="btn-ghost">
            See examples
          </Link>
        </div>

        <section>
          <h2>Use it</h2>
          <p>In the eve agent directory (Node 24+):</p>
          <pre className="home-code">
            <code>{`npx @danielalbinsson/aletheia-cli portrait
npx @danielalbinsson/aletheia-cli diff --baseline git:main
npx @danielalbinsson/aletheia-cli snapshot`}</code>
          </pre>
          <p>
            <a href={DOCS_QUICKSTART}>Visual inspector and PR gate</a>
            {" · "}
            <a href="https://github.com/danielalbinsson/Aletheia" target="_blank" rel="noreferrer">
              source
            </a>
          </p>
          {apiAvailable ? (
            <p className="home-note home-note-ok">
              Dev server detected. Folder browsing and verified manifests are available in this
              session.
            </p>
          ) : null}
        </section>
      </article>

      <AppFooter />
    </main>
  );
}
