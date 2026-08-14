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
                An inspector. Reads <code>agent/</code> and, when present, eve's compiled manifest.
              </li>
              <li>Local-first. The full tool runs on your machine. This site is a demo.</li>
              <li>
                Labeled. Facts from a build are <em>verified from build</em>. Everything else is{" "}
                <em>from source — build to verify</em>.
              </li>
            </ul>
          </section>
          <section>
            <h2>What it is not</h2>
            <ul>
              <li>A runtime. It never runs, edits, or deploys the agent.</li>
              <li>This website. Browsers cannot read your disk.</li>
              <li>
                A guess. Where eve does not expose a fact — approval gates, connection read/write —
                Aletheia leaves a gap.
              </li>
            </ul>
          </section>
        </div>

        <div className="home-cta">
          <Link to="/portrait" className="btn-primary">
            View demo portrait
          </Link>
          <Link to="/gallery" className="btn-ghost">
            Gallery
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
            Visual inspector and PR gate:{" "}
            <a href={DOCS_QUICKSTART}>quickstart</a>
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
