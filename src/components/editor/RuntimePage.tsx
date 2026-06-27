import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  deployProject,
  fetchDeployStatus,
  fetchDeployDiff,
  fetchDevStatus,
  startDevServer,
  stopDevServer,
  type DeployDiffResponse,
  type DeployLinkStatus,
  type EveDevStatus,
  type ModelCredentialStatus,
} from "../../api/projectClient";
import type { DiffEntry } from "../../parser/capabilityDiff";
import { chatWithEve, type EveSessionCursor } from "../../lib/eveSessionChat";
import { findFailureMessage } from "../../lib/eveStream";
import {
  appendSessionEvents,
  trackSessionStart,
} from "../../lib/sessionObservability";
import { useProjectStore } from "../../store/ProjectStore";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export function RuntimePage() {
  const { project, apiAvailable, dirty } = useProjectStore();
  const [devStatus, setDevStatus] = useState<
    (EveDevStatus & { credentials?: ModelCredentialStatus }) | null
  >(null);
  const [deployStatus, setDeployStatus] = useState<DeployLinkStatus | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployLog, setDeployLog] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [deployDiff, setDeployDiff] = useState<DeployDiffResponse | null>(null);
  const [diffAck, setDiffAck] = useState(false);
  const [devLog, setDevLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const sessionRef = useRef<EveSessionCursor | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!apiAvailable) return;
    try {
      const [dev, deploy] = await Promise.all([fetchDevStatus(), fetchDeployStatus()]);
      setDevStatus(dev);
      setDeployStatus(deploy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runtime status");
    }
  }, [apiAvailable]);

  // The capability diff runs `eve info`, so it's loaded on demand (mount + after
  // a deploy), not on the 5s status poll.
  const loadDiff = useCallback(async () => {
    if (!apiAvailable) return;
    try {
      const diff = await fetchDeployDiff();
      setDeployDiff(diff);
      setDiffAck(false);
    } catch (err) {
      setDeployDiff({
        ok: false,
        built: false,
        error: err instanceof Error ? err.message : "Could not load capability review",
      });
    }
  }, [apiAvailable]);

  useEffect(() => {
    void refreshStatus();
    void loadDiff();
    const interval = setInterval(() => void refreshStatus(), 5000);
    return () => clearInterval(interval);
  }, [refreshStatus, loadDiff]);

  // Whether the review gate must be acknowledged before deploying.
  const reviewBlocks =
    deployDiff?.ok === true &&
    (deployDiff.diff?.isInitial === true || deployDiff.diff?.hasElevated === true);

  async function handleStartDev() {
    setDevBusy(true);
    setError(null);
    setDevLog(null);
    try {
      const result = await startDevServer();
      setDevStatus(result.status);
      if (result.status.logTail) {
        setDevLog(result.status.logTail);
      }
      if (!result.ok) {
        setError(result.error ?? "Failed to start eve dev");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start eve dev");
    } finally {
      setDevBusy(false);
    }
  }

  async function handleStopDev() {
    setDevBusy(true);
    setError(null);
    try {
      const status = await stopDevServer();
      setDevStatus(status);
      setDevLog(null);
      sessionRef.current = null;
      setActiveSessionId(null);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop eve dev");
    } finally {
      setDevBusy(false);
    }
  }

  async function handleDeploy() {
    setDeployBusy(true);
    setDeployLog("");
    setDeployedUrl(null);
    setError(null);
    let streamed = "";
    try {
      const result = await deployProject((chunk) => {
        streamed += chunk;
        setDeployLog(streamed);
      });
      if (result.ok && result.deploymentUrl) {
        setDeployedUrl(result.deploymentUrl);
      }
      const summary = result.ok
        ? `\nDeployed${result.deploymentUrl ? ` to ${result.deploymentUrl}` : ""}.`
        : "\nDeploy failed.";
      setDeployLog((streamed.trim() || result.stderr || result.stdout) + summary);
      if (!result.ok) {
        setError(result.stderr || "eve deploy failed");
      }
      await refreshStatus();
      // The snapshot just moved to what we shipped — refresh the diff.
      await loadDiff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setDeployBusy(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || chatBusy || !devStatus?.ready) return;

    setInput("");
    setChatBusy(true);
    setError(null);

    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let streamed = "";
      const result = await chatWithEve(text, {
        session: sessionRef.current ?? undefined,
        signal: controller.signal,
        onDelta: (delta) => {
          streamed += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: streamed } : m
            )
          );
        },
      });
      sessionRef.current = result.session;
      setActiveSessionId(result.session.sessionId);
      trackSessionStart(result.session.sessionId, text);
      appendSessionEvents(result.session.sessionId, result.events);
      const failure = findFailureMessage(result.events);
      if (failure) {
        setError(failure);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: result.fullText || streamed, streaming: false }
              : m
          )
        );
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Chat failed";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setChatBusy(false);
    }
  }

  if (!project) {
    return (
      <main className="app empty">
        <p>No project loaded.</p>
        <Link to="/">Back home</Link>
      </main>
    );
  }

  return (
    <main className="app runtime-app">
      <header className="editor-topbar">
        <div className="wordmark">
          <Link to="/" className="wordmark-link">
            Aletheia
          </Link>
          <span className="wordmark-sub">run & deploy</span>
        </div>
        <div className="editor-actions">
          <Link to="/edit" className="btn-ghost">
            Edit agent
          </Link>
          <Link to="/observe" className="btn-ghost">
            Observability
          </Link>
          <Link to="/" className="btn-ghost">
            Portrait
          </Link>
        </div>
      </header>

      {!apiAvailable && (
        <p className="editor-banner warn">
          Runtime controls require <code>pnpm dev</code>.
        </p>
      )}
      {dirty && (
        <p className="editor-banner warn">
          You have unsaved edits. Save in the editor before testing or deploying.
        </p>
      )}
      {devStatus?.credentials && !devStatus.credentials.configured && (
        <p className="editor-banner warn">{devStatus.credentials.hint}</p>
      )}
      {error && <p className="editor-banner error">{error}</p>}

      <div className="runtime-grid">
        <section className="runtime-panel">
          <h2 className="runtime-heading">Local agent</h2>
          <p className="runtime-desc">
            Builds <code>agent/</code> then runs <code>eve start</code> on port{" "}
            {devStatus?.port ?? 3199}. Restart after editing agent files. Requires
            Node 24+.
          </p>
          <div className="runtime-status-row">
            <span
              className={`runtime-pill ${
                devStatus?.phase === "ready" || devStatus?.ready
                  ? "ok"
                  : devStatus?.phase === "failed"
                    ? "pending"
                    : devStatus?.phase === "starting" || devStatus?.running
                      ? "pending"
                      : ""
              }`}
            >
              {devStatus?.phase === "ready" || devStatus?.ready
                ? "Ready"
                : devStatus?.phase === "failed"
                  ? "Failed"
                  : devStatus?.phase === "starting" || devStatus?.running
                    ? "Starting…"
                    : "Stopped"}
            </span>
            {devStatus?.url && (
              <code className="runtime-url">{devStatus.url}</code>
            )}
          </div>
          <div className="runtime-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleStartDev()}
              disabled={!apiAvailable || devBusy || devStatus?.ready || dirty}
            >
              {devBusy ? "Starting…" : "Start local agent"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void handleStopDev()}
              disabled={!apiAvailable || devBusy || devStatus?.phase === "stopped"}
            >
              Stop
            </button>
          </div>
          {devLog && <pre className="build-log">{devLog}</pre>}
        </section>

        <section className="runtime-panel">
          <h2 className="runtime-heading">Deploy</h2>
          <p className="runtime-desc">
            Runs <code>eve deploy</code> to Vercel production. Link the project once in
            the terminal with <code>pnpm exec eve link</code>.
          </p>
          <div className="runtime-status-row">
            <span
              className={`runtime-pill ${deployStatus?.linked ? "ok" : "pending"}`}
            >
              {deployStatus?.linked ? "Linked" : "Not linked"}
            </span>
            {deployStatus?.projectName && (
              <code className="runtime-url">{deployStatus.projectName}</code>
            )}
          </div>
          <CapabilityReview diff={deployDiff} />

          {reviewBlocks && (
            <label className="diff-ack">
              <input
                type="checkbox"
                checked={diffAck}
                onChange={(e) => setDiffAck(e.target.checked)}
              />
              <span>
                {deployDiff?.diff?.isInitial
                  ? "I've reviewed the initial capabilities."
                  : "I've reviewed these capability changes."}
              </span>
            </label>
          )}

          <div className="runtime-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleDeploy()}
              disabled={
                !apiAvailable ||
                deployBusy ||
                !deployStatus?.linked ||
                dirty ||
                (reviewBlocks && !diffAck)
              }
            >
              {deployBusy ? "Deploying…" : "eve deploy"}
            </button>
          </div>
          {deployedUrl && (
            <p className="runtime-desc">
              Production:{" "}
              <a href={deployedUrl} target="_blank" rel="noreferrer">
                {deployedUrl}
              </a>
            </p>
          )}
          {deployLog && <pre className="build-log">{deployLog}</pre>}
        </section>
      </div>

      <section className="runtime-chat">
        <h2 className="runtime-heading">Test chat</h2>
        <p className="runtime-desc">
          Talk to the local agent via the eve HTTP API. Requires a running dev server.
        </p>
        <div className="chat-log">
          {messages.length === 0 && (
            <p className="chat-empty">Send a message to start a session.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              <span className="chat-role">{m.role === "user" ? "You" : "Agent"}</span>
              <p>{m.content || (m.streaming ? "…" : "")}</p>
            </div>
          ))}
        </div>
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <input
            className="field-input chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              devStatus?.ready ? "Message your agent…" : "Start the local agent first"
            }
            disabled={!devStatus?.ready || chatBusy}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!devStatus?.ready || chatBusy || !input.trim()}
          >
            {chatBusy ? "Sending…" : "Send"}
          </button>
        </form>
        {activeSessionId && (
          <p className="observe-chat-link">
            <Link to={`/observe?session=${encodeURIComponent(activeSessionId)}`}>
              View session trace →
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}

const CHANGE_GLYPH: Record<DiffEntry["change"], string> = {
  added: "+",
  removed: "−",
  changed: "~",
};

/** The pre-deploy capability review: what's changing about what the agent can do. */
function CapabilityReview({ diff }: { diff: DeployDiffResponse | null }) {
  if (!diff) return null;

  if (!diff.ok) {
    return (
      <p className="diff-note muted">
        {diff.error ?? "Build the agent to review capability changes before deploying."}
      </p>
    );
  }

  const d = diff.diff;
  if (!d) return null;

  if (d.isInitial) {
    return (
      <div className="capability-review">
        <p className="diff-note">
          First deploy — review what this agent will be able to do, touch, and decide.
        </p>
      </div>
    );
  }

  if (!d.hasChanges) {
    return <p className="diff-note muted">No capability changes since last deploy.</p>;
  }

  const elevated = d.entries.filter((e) => e.risk === "elevated");
  const routine = d.entries.filter((e) => e.risk === "routine");

  return (
    <div className="capability-review">
      {elevated.length > 0 && (
        <div className="diff-group elevated">
          <p className="diff-group-label">Needs your attention</p>
          {elevated.map((e, i) => (
            <DiffLine key={`e${i}`} entry={e} />
          ))}
        </div>
      )}
      {routine.length > 0 && (
        <div className="diff-group">
          <p className="diff-group-label">Other changes</p>
          {routine.map((e, i) => (
            <DiffLine key={`r${i}`} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiffLine({ entry }: { entry: DiffEntry }) {
  return (
    <p className={`diff-line ${entry.risk} change-${entry.change}`}>
      <span className="diff-glyph" aria-hidden>
        {CHANGE_GLYPH[entry.change]}
      </span>
      <span className="diff-summary">{entry.summary}</span>
    </p>
  );
}
