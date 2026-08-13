import { Link } from "react-router-dom";
import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";
import { useProjectStore } from "../store/ProjectStore";

export function HomePage() {
  const { apiAvailable } = useProjectStore();

  return (
    <main className="app home-app">
      <AppNav />

      <article className="home prose">
        <header className="home-hero">
          <p className="home-epigraph">
            <em>Aletheia (ἀλήθεια): truth as unconcealment — bringing what is hidden into the open.</em>
          </p>
          <h1>See what an agent can do</h1>
          <p className="home-lede">
            You cloned an eve (Vercel) agent you didn't write. Before you run it, you'd like to know: what
            can it touch? What does it do on its own? What does it ask permission for? What is it{" "}
            <em>forbidden</em> from doing? Today the only way to answer that is to read the source.
          </p>
          <p className="home-lede">
            <strong>Aletheia reads it for you.</strong> Point it at any{" "}
            <a href="https://eve.dev" target="_blank" rel="noreferrer">
              eve
            </a>{" "}
            agent and it renders a <strong>self-portrait</strong> — a first-person page where the
            agent lays out its capabilities, its reach, what it does unprompted, and the powers it
            has given up — plus an <strong>authority diff</strong> that shows how that authority
            changed over time. It never runs the agent, never edits it, never deploys it. It only
            makes it legible.
          </p>
          <p className="home-tagline">Not a dashboard. Not a flowchart. A portrait you can trust.</p>
          <div className="home-cta">
            <Link to="/portrait" className="btn-primary">
              View demo portrait
            </Link>
            <Link to="/gallery" className="btn-ghost">
              Gallery
            </Link>
          </div>
        </header>

        <section>
          <h2>This site vs the local tool</h2>
          <p>
            You're on the <strong>hosted showcase</strong> — manifesto, gallery, and a bundled demo
            portrait rendered <em>from source</em>. The full inspector — browse any folder on your
            machine, read compiled manifests, switch agents — runs locally because browsers cannot
            read your disk.
          </p>
          {apiAvailable ? (
            <p className="home-note home-note-ok">
              Dev server detected — folder browsing and verified manifests are available in this
              session.
            </p>
          ) : (
            <p className="home-note">
              To inspect your own agents, run{" "}
              <code>npx @danielalbinsson/aletheia-cli portrait</code> in the agent
              directory. For the visual inspector, clone the repo and run{" "}
              <code>pnpm install && pnpm dev</code>.
            </p>
          )}
        </section>

        <section>
          <h2>Quickstart — for eve builders</h2>
          <p>Default path: run the CLI in your eve agent directory (Node 24+).</p>
          <pre className="home-code">
            <code>{`npx @danielalbinsson/aletheia-cli portrait
npx @danielalbinsson/aletheia-cli diff --baseline git:main
npx @danielalbinsson/aletheia-cli snapshot   # after intentional expansion; commit the file`}</code>
          </pre>
          <p>
            After an intentional authority expansion, acknowledge with{" "}
            <code>capability-change-ack</code>, run <code>snapshot</code>, and commit{" "}
            <code>agent/.aletheia/deployed-capabilities.json</code> on the same PR.
          </p>
          <p>
            <strong>Visual inspector</strong> — clone this repo for the Browse-folder UI:
          </p>
          <pre className="home-code">
            <code>{`git clone https://github.com/danielalbinsson/Aletheia.git
cd Aletheia
pnpm install
pnpm dev            # → http://localhost:5173`}</code>
          </pre>
          <p>
            Click <strong>Browse folder…</strong> and pick a directory. Aletheia scans for eve agents
            — any folder containing <code>agent/agent.ts</code> — and lists them in the Agent
            dropdown. Pick one; its portrait and authority diff render for that agent.
          </p>
          <p>
            Prefer a fixed target? Set <code>ALETHEIA_WORKSPACE</code> in <code>.env.local</code>.
            Requires Node 24+ and pnpm.
          </p>
        </section>

        <section>
          <h2>The honesty contract</h2>
          <p>
            A trust tool that lies is worse than none. Aletheia never presents a guess as a fact.
            Every claim carries its provenance:
          </p>
          <ul>
            <li>
              <strong>Verified from build.</strong> When the agent has a compiled manifest (
              <code>.eve/compile/compiled-agent-manifest.json</code>), the portrait reads eve's
              own record — tools, reach, schedules, disabled framework tools, subagents. Labelled{" "}
              <em>verified from build</em>.
            </li>
            <li>
              <strong>From source.</strong> Without a manifest, Aletheia falls back to a tolerant
              read of <code>agent/</code> and labels it <em>from source — build to verify</em>.
            </li>
            <li>
              <strong>Consent, honestly.</strong> Approval gates come from{" "}
              <code>agent/.aletheia/consent.json</code> when present — always{" "}
              <em>source-declared</em>, never build-verified until eve serializes them.
            </li>
          </ul>
        </section>

        <section>
          <h2>Authority diff — trust over time</h2>
          <p>
            The novel part isn't the picture; it's the <strong>diff</strong>. New external reach, a
            new schedule, a new delegation, a lifted restriction, or a model swap are flagged{" "}
            <em>needs your attention</em>. Routine changes pass quietly. The same diff runs
            headless as <code>aletheia diff</code> on pull requests.
          </p>
          <p>
            <Link to="/review">Open authority diff →</Link>
          </p>
        </section>

        <section>
          <h2>Explore</h2>
          <ul className="home-routes">
            <li>
              <Link to="/portrait">Portrait</Link> — the agent's self-portrait
            </li>
            <li>
              <Link to="/review">Authority diff</Link> — how its authority changed
            </li>
            <li>
              <Link to="/gallery">Gallery</Link> — example agents read by Aletheia
            </li>
            <li>
              <Link to="/manifesto">Manifesto</Link> — the POV behind the project
            </li>
          </ul>
        </section>
      </article>

      <AppFooter />
    </main>
  );
}
