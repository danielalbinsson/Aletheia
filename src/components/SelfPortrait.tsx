import type { AgentModel, Autonomy, Capability, Reach } from "../model";
import { Portrait } from "./Portrait";

/**
 * The hero. An agent presenting itself in the first person.
 * `verified` is true when the trust facts came from a built agent's eve
 * manifest rather than the source-parsed fallback.
 */
export function SelfPortrait({
  agent,
  verified = false,
}: {
  agent: AgentModel;
  verified?: boolean;
}) {
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

        <Section
          label="What I can do"
          note={verified ? "verified from build" : "from source — build to verify"}
        >
          <ul className="can-do">
            {agent.capabilities.map((c) => (
              <CapabilityItem key={c.source} cap={c} />
            ))}
          </ul>
        </Section>

        <Section
          label="What I can touch"
          note={verified ? "verified from build" : "from source — build to verify"}
        >
          {agent.reach.length === 0 ? (
            <p className="reach-none">
              {verified
                ? "I reach nothing outside myself — no connections, no channels."
                : "Nothing declared yet."}
            </p>
          ) : (
            <ul className="can-touch">
              {agent.reach.map((r) => (
                <ReachItem key={r.label} reach={r} />
              ))}
            </ul>
          )}
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

function Section({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <h2 className="section-label">
        {label}
        {note && <span className="section-note">{note}</span>}
      </h2>
      {children}
    </section>
  );
}

function CapabilityItem({ cap }: { cap: Capability }) {
  return (
    <li>
      <span className="cap-label">
        {cap.label}
        {cap.requiresApproval === true && (
          <span className="cap-approval" title="Requires your approval before running">
            asks first
          </span>
        )}
        {cap.requiresApproval === false && (
          <span className="cap-approval auto" title="Runs without asking">
            no approval
          </span>
        )}
      </span>
      <span className="cap-detail">{cap.detail}</span>
      {cap.takes && <span className="cap-takes">takes: {cap.takes}</span>}
    </li>
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
      <span className="reach-label">
        {reach.label}
        {reach.detail && <span className="reach-detail">{reach.detail}</span>}
      </span>
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
