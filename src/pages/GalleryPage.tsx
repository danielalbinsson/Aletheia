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
      "An orchestrator with no tools of its own; it directs three specialist subagents and reaches GitHub over MCP.",
  },
  {
    name: "support-bot",
    src: portraitSupportBot,
    caption:
      "Looks up customers and orders, escalates to a human, and asks approval before issuing a refund.",
  },
  {
    name: "code-reviewer",
    src: portraitCodeReviewer,
    caption:
      "Reviews code changes and reaches nothing outside itself.",
  },
  {
    name: "research-assistant",
    src: portraitResearch,
    caption:
      "Gathers sources and evaluates credibility; acts only when asked.",
  },
];

export function GalleryPage() {
  return (
    <main className="app gallery-app">
      <AppNav />

      <header className="gallery-intro">
        <h1>Four agents, read by Aletheia</h1>
        <p>
          Screenshots of example portraits, not live renders. Generated portraits
          you can fetch and verify:{" "}
          <a href="https://agentic-kit.dev/gallery">Agentic Kit gallery</a>.
        </p>
      </header>

      <figure className="gallery-hero">
        <img
          className="gallery-shot"
          src={heroDiff}
          alt="Aletheia authority diff flagging that an agent's authority expanded"
        />
        <figcaption className="gallery-cap">
          <span className="gallery-name">Authority expanded</span>
          When a new version gains reach, a delegation, or drops an approval gate, the
          authority diff flags it.
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
