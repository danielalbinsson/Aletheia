import type { AgentModel, Autonomy, Reach } from "../model";
import { Portrait } from "./Portrait";

/** The hero. An agent presenting itself in the first person. */
export function SelfPortrait({ agent }: { agent: AgentModel }) {
  const introParas = agent.intro.split(/\n\s*\n/).filter(Boolean);
  const actsOnOwn = agent.autonomy.filter((a) => a.consent === "acts-on-its-own");
  const asksFirst = agent.autonomy.filter((a) => a.consent === "asks-first");

  return (
    <article className="self-portrait">
      <div className="portrait-col">
        <Portrait agent={agent} />
        {agent.runsOn && <p className="runs-on">runs on {agent.runsOn}</p>}
      </div>

      <div className="intro-col">
        <header className="intro-head">
          <h1 className="agent-name">{agent.name}</h1>
          <p className="essence">{agent.essence}</p>
        </header>

        <div className="intro-body">
          {introParas.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <Section label="What I can do">
          <ul className="can-do">
            {agent.capabilities.map((c) => (
              <li key={c.source}>
                <span className="cap-label">{c.label}</span>
                <span className="cap-detail">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section label="What I can touch">
          <ul className="can-touch">
            {agent.reach.map((r) => (
              <ReachItem key={r.label} reach={r} />
            ))}
          </ul>
        </Section>

        <Section label="When I act on my own">
          <div className="autonomy">
            {actsOnOwn.length > 0 && (
              <div className="autonomy-group">
                <p className="autonomy-kind on-own">On my own</p>
                {actsOnOwn.map((a, i) => (
                  <AutonomyLine key={i} a={a} />
                ))}
              </div>
            )}
            {asksFirst.length > 0 && (
              <div className="autonomy-group">
                <p className="autonomy-kind asks">I ask you first</p>
                {asksFirst.map((a, i) => (
                  <AutonomyLine key={i} a={a} />
                ))}
              </div>
            )}
            {agent.autonomy.length === 0 && (
              <p className="autonomy-none">
                I only act when you ask. I never run on my own.
              </p>
            )}
          </div>
        </Section>
      </div>
    </article>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-label">{label}</h2>
      {children}
    </section>
  );
}

const ACCESS_GLYPH: Record<Reach["access"], string> = {
  read: "reads",
  write: "writes",
  "read-write": "reads + writes",
};

function ReachItem({ reach }: { reach: Reach }) {
  return (
    <li className={`reach-item kind-${reach.kind}`}>
      <span className="reach-dot" aria-hidden />
      <span className="reach-label">{reach.label}</span>
      <span className={`reach-access access-${reach.access}`}>
        {ACCESS_GLYPH[reach.access]}
      </span>
    </li>
  );
}

function AutonomyLine({ a }: { a: Autonomy }) {
  return (
    <p className="autonomy-line">
      <span className="autonomy-when">{a.when}</span>
      <span className="autonomy-does">{a.does}</span>
    </p>
  );
}
