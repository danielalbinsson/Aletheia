import type {
  AgentModel,
  Autonomy,
  Capability,
  Reach,
  Restriction,
  Subagent,
} from "../model";
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
          {agent.capabilities.length === 0 ? (
            <p className="can-do-none">
              {agent.subagents.length > 0
                ? "I hold no tools myself — I direct the team below."
                : verified
                  ? "I have no tools or skills of my own."
                  : "Nothing declared yet."}
            </p>
          ) : (
            <ul className="can-do">
              {agent.capabilities.map((c) => (
                <CapabilityItem key={c.source} cap={c} />
              ))}
            </ul>
          )}
          {agent.capabilities.some((c) => c.consent === "asks-first") && (
            <p className="consent-note">
              “asks first” is declared in source (agent/.aletheia/consent.json), not
              the build manifest — eve doesn’t serialize approval, so this one fact
              can’t be build-verified.
            </p>
          )}
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

        {agent.restrictions.length > 0 && (
          <Section
            label="What I cannot do"
            note={verified ? "verified from build" : "from source — build to verify"}
          >
            <ul className="cannot-do">
              {agent.restrictions.map((r) => (
                <RestrictionItem key={r.tool} restriction={r} />
              ))}
            </ul>
          </Section>
        )}

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

        {agent.subagents.length > 0 && (
          <Section
            label="Who I delegate to"
            note={verified ? "verified from build" : "from source — build to verify"}
          >
            <ul className="subagents">
              {agent.subagents.map((s) => (
                <SubagentItem key={s.name} sub={s} />
              ))}
            </ul>
          </Section>
        )}
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
        {cap.consent === "asks-first" && (
          <span
            className="cap-consent"
            title={cap.consentReason ?? "Requires your approval before running."}
          >
            asks first
          </span>
        )}
      </span>
      <span className="cap-detail">{cap.detail}</span>
      {cap.consentReason && <span className="cap-consent-why">{cap.consentReason}</span>}
      {cap.takes && <span className="cap-takes">takes: {cap.takes}</span>}
    </li>
  );
}

const ACCESS_GLYPH: Record<NonNullable<Reach["access"]>, string> = {
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
      {reach.access && (
        <span className={`reach-access access-${reach.access}`}>
          {ACCESS_GLYPH[reach.access]}
        </span>
      )}
    </li>
  );
}

function SubagentItem({ sub }: { sub: Subagent }) {
  return (
    <li className="subagent">
      <div className="subagent-head">
        <span className="subagent-name">{sub.name}</span>
        {sub.runsOn && <span className="subagent-model">{sub.runsOn}</span>}
      </div>
      {sub.description && <p className="subagent-desc">{sub.description}</p>}
      {sub.capabilities.length > 0 && (
        <ul className="subagent-caps">
          {sub.capabilities.map((c) => (
            <li key={c.source}>
              <span className="cap-label">{c.label}</span>
              {c.detail && <span className="cap-detail">{c.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {sub.reach.length > 0 && (
        <ul className="subagent-reach">
          {sub.reach.map((r) => (
            <li key={r.label} className={`reach-item kind-${r.kind}`}>
              <span className="reach-dot" aria-hidden />
              <span className="reach-label">
                {r.label}
                {r.detail && <span className="reach-detail">{r.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RestrictionItem({ restriction }: { restriction: Restriction }) {
  return (
    <li className="cannot-item">
      <span className="cannot-glyph" aria-hidden>
        ✕
      </span>
      <span className="cannot-label">
        I cannot {restriction.label}
        <span className="cannot-tool">{restriction.tool} disabled</span>
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
