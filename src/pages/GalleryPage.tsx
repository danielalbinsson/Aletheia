import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";
import heroDiff from "../../examples/gallery/capability-review-authority-expanded.jpg";
import portraitDesignQa from "../../examples/gallery/portrait-design-qa-agent.jpg";
import portraitSupportBot from "../../examples/gallery/portrait-support-bot.jpg";
import portraitCodeReviewer from "../../examples/gallery/portrait-code-reviewer.jpg";
import portraitResearch from "../../examples/gallery/portrait-research-assistant.jpg";

interface Entry {
  name: string;
  src: string;
  caption: string;
}

const ENTRIES: Entry[] = [
  {
    name: "design-qa-agent",
    src: portraitDesignQa,
    caption:
      "An orchestrator — no tools of its own; it directs three specialist subagents and reaches GitHub over MCP.",
  },
  {
    name: "support-bot",
    src: portraitSupportBot,
    caption:
      "Customer support with real reach: looks up customers and orders, escalates to a human, and asks approval before issuing a refund — it charges the payment method.",
  },
  {
    name: "code-reviewer",
    src: portraitCodeReviewer,
    caption:
      "Reviews code changes — reads a git diff, runs a security checklist, submits structured feedback. Reaches nothing outside itself.",
  },
  {
    name: "research-assistant",
    src: portraitResearch,
    caption:
      "Gathers and weighs sources — search, fetch, compare, and evaluate credibility before citing. Acts only when asked.",
  },
];

export function GalleryPage() {
  return (
    <main className="app gallery-app">
      <AppNav subtitle="gallery" />

      <header className="gallery-intro">
        <h1>Four agents, read by Aletheia</h1>
        <p>
          Each portrait is generated from the agent's own compiled manifest — no
          annotations, every fact <em>verified from build</em>. Point Aletheia at a
          folder of agents and this is what you see.
        </p>
      </header>

      <figure className="gallery-hero">
        <img
          className="gallery-shot"
          src={heroDiff}
          alt="Aletheia capability review flagging that an agent's authority expanded"
        />
        <figcaption className="gallery-cap">
          <span className="gallery-name">the moment that matters</span>
          Agents change. When a new version gains external reach, a delegation, or drops an
          approval gate, the review says so — <em>authority expanded, review required</em> —
          and asks a human to look. Routine changes pass quietly.
        </figcaption>
      </figure>

      <div className="gallery-grid">
        {ENTRIES.map((e) => (
          <figure className="gallery-card" key={e.name}>
            <img className="gallery-shot" src={e.src} alt={`Aletheia portrait of ${e.name}`} />
            <figcaption className="gallery-cap">
              <span className="gallery-name">{e.name}</span>
              {e.caption}
            </figcaption>
          </figure>
        ))}
      </div>
      <AppFooter />
    </main>
  );
}
