import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchObservabilitySnapshot,
  type EveDiagnostic,
  type EveInfoSnapshot,
  type VercelObservabilityLinks,
} from "../../api/projectClient";
import { fetchSessionStream } from "../../lib/eveStream";
import {
  clearTrackedSessions,
  getTrackedSession,
  listTrackedSessions,
  replaceSessionEvents,
  type TrackedSession,
} from "../../lib/sessionObservability";
import { SessionTraceViewer } from "./SessionTraceViewer";
import { useProjectStore } from "../../store/ProjectStore";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(status: TrackedSession["status"]): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Active";
  }
}

export function ObservabilityPage() {
  const { project, apiAvailable } = useProjectStore();
  const [searchParams] = useSearchParams();
  const querySessionId = searchParams.get("session");
  const [sessions, setSessions] = useState<TrackedSession[]>(() => listTrackedSessions());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (querySessionId) return querySessionId;
    return listTrackedSessions()[0]?.sessionId ?? null;
  });
  const [inspectId, setInspectId] = useState("");
  const [events, setEvents] = useState<TrackedSession["events"]>([]);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<EveDiagnostic[]>([]);
  const [info, setInfo] = useState<EveInfoSnapshot | null>(null);
  const [vercelLinks, setVercelLinks] = useState<VercelObservabilityLinks | null>(null);

  const selected = sessions.find((s) => s.sessionId === selectedId) ?? null;

  const refreshSessions = useCallback(() => {
    const list = listTrackedSessions();
    setSessions(list);
    if (selectedId && !list.some((s) => s.sessionId === selectedId)) {
      setSelectedId(list[0]?.sessionId ?? null);
    }
  }, [selectedId]);

  const loadSnapshot = useCallback(async () => {
    if (!apiAvailable) return;
    try {
      const snapshot = await fetchObservabilitySnapshot();
      setDiagnostics(snapshot.diagnostics);
      setInfo(snapshot.info);
      setVercelLinks(snapshot.vercel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load observability data");
    }
  }, [apiAvailable]);

  useEffect(() => {
    refreshSessions();
    void loadSnapshot();
  }, [refreshSessions, loadSnapshot]);

  useEffect(() => {
    if (!selected) {
      setEvents([]);
      return;
    }
    setEvents(selected.events);
  }, [selected]);

  async function handleReplay(sessionId: string, preview?: string) {
    setLoadingStream(true);
    setError(null);
    try {
      const replayed = await fetchSessionStream(sessionId);
      replaceSessionEvents(sessionId, replayed, preview);
      refreshSessions();
      setSelectedId(sessionId);
      setEvents(replayed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not replay session — is the local agent running?"
      );
    } finally {
      setLoadingStream(false);
    }
  }

  async function handleInspect() {
    const id = inspectId.trim();
    if (!id) return;
    const known = getTrackedSession(id);
    setSelectedId(id);
    if (known?.events.length) {
      setEvents(known.events);
    }
    await handleReplay(id, known?.preview);
  }

  if (!project) {
    return (
      <main className="app empty">
        <p>No project loaded.</p>
        <Link to="/">Back home</Link>
      </main>
    );
  }

  const infoSummary =
    info?.ok && info.raw && typeof info.raw === "object"
      ? (info.raw as {
          status?: string;
          model?: string | null;
          tools?: string[];
          skills?: string[];
          diagnostics?: { errors: number; warnings: number } | null;
        })
      : null;

  return (
    <main className="app observe-app">
      <header className="editor-topbar">
        <div className="wordmark">
          <Link to="/" className="wordmark-link">
            Aletheia
          </Link>
          <span className="wordmark-sub">observability</span>
        </div>
        <div className="editor-actions">
          <Link to="/run" className="btn-ghost">
            Run & deploy
          </Link>
          <Link to="/edit" className="btn-ghost">
            Edit agent
          </Link>
        </div>
      </header>

      {!apiAvailable && (
        <p className="editor-banner warn">
          Discovery data requires <code>pnpm dev</code>. Session traces replay against the
          local agent when it is running.
        </p>
      )}
      {error && <p className="editor-banner error">{error}</p>}

      <div className="observe-grid">
        <aside className="observe-sidebar">
          <section className="runtime-panel observe-panel">
            <div className="observe-panel-head">
              <h2 className="runtime-heading">Sessions</h2>
              {sessions.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost observe-clear"
                  onClick={() => {
                    clearTrackedSessions();
                    setSessions([]);
                    setSelectedId(null);
                    setEvents([]);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <p className="runtime-desc">
              Sessions from test chat are tracked locally. Replay any session against a
              running <code>eve dev</code> server.
            </p>

            <form
              className="observe-inspect"
              onSubmit={(e) => {
                e.preventDefault();
                void handleInspect();
              }}
            >
              <input
                className="field-input"
                value={inspectId}
                onChange={(e) => setInspectId(e.target.value)}
                placeholder="Paste session id…"
              />
              <button type="submit" className="btn-ghost" disabled={!inspectId.trim()}>
                Inspect
              </button>
            </form>

            <ul className="observe-session-list">
              {sessions.length === 0 && (
                <li className="observe-session-empty">
                  No sessions yet.{" "}
                  <Link to="/run">Run a test chat</Link> to create one.
                </li>
              )}
              {sessions.map((session) => (
                <li key={session.sessionId}>
                  <button
                    type="button"
                    className={`observe-session-btn ${
                      selectedId === session.sessionId ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedId(session.sessionId);
                      setEvents(session.events);
                    }}
                  >
                    <span className="observe-session-preview">
                      {session.preview || session.sessionId}
                    </span>
                    <span className="observe-session-meta">
                      <code>{session.sessionId.slice(0, 12)}…</code>
                      <span className={`runtime-pill ${session.status === "failed" ? "pending" : session.status === "completed" || session.status === "waiting" ? "ok" : ""}`}>
                        {statusLabel(session.status)}
                      </span>
                      <span>{session.eventCount} events</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="runtime-panel observe-panel">
            <h2 className="runtime-heading">Discovery</h2>
            {infoSummary ? (
              <dl className="observe-discovery">
                <div>
                  <dt>Status</dt>
                  <dd>{infoSummary.status ?? "unknown"}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{infoSummary.model ?? "—"}</dd>
                </div>
                <div>
                  <dt>Tools</dt>
                  <dd>{infoSummary.tools?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Skills</dt>
                  <dd>{infoSummary.skills?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Diagnostics</dt>
                  <dd>
                    {infoSummary.diagnostics
                      ? `${infoSummary.diagnostics.errors} errors, ${infoSummary.diagnostics.warnings} warnings`
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="runtime-desc">
                Run <code>eve build</code> or <code>eve info</code> to populate discovery
                artifacts.
              </p>
            )}

            {diagnostics.length > 0 && (
              <ul className="observe-diagnostics">
                {diagnostics.map((d, i) => (
                  <li key={`${d.sourcePath}-${i}`} className={d.severity}>
                    <code>{d.sourcePath ?? "project"}</code>: {d.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="runtime-panel observe-panel">
            <h2 className="runtime-heading">Production traces</h2>
            <p className="runtime-desc">{vercelLinks?.agentRunsHint}</p>
            {vercelLinks?.linked && vercelLinks.projectName && (
              <p className="observe-vercel-project">
                Linked project: <code>{vercelLinks.projectName}</code>
              </p>
            )}
            {vercelLinks?.projectUrl && (
              <a
                className="btn-ghost observe-external"
                href={vercelLinks.projectUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Vercel dashboard
              </a>
            )}
          </section>
        </aside>

        <section className="runtime-panel observe-trace">
          <div className="observe-panel-head">
            <div>
              <h2 className="runtime-heading">Event trace</h2>
              {selected && (
                <p className="observe-trace-meta">
                  <code>{selected.sessionId}</code>
                  <span>·</span>
                  <span>{formatTime(selected.startedAt)}</span>
                </p>
              )}
            </div>
            {selected && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void handleReplay(selected.sessionId, selected.preview)}
                disabled={loadingStream}
              >
                {loadingStream ? "Replaying…" : "Replay stream"}
              </button>
            )}
          </div>

          <SessionTraceViewer
            events={events}
            loading={loadingStream}
            emptyMessage={
              selected
                ? "No cached events. Click Replay stream while the local agent is running."
                : "Select a session or paste a session id."
            }
          />
        </section>
      </div>
    </main>
  );
}
