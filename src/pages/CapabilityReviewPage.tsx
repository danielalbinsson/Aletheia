import { useCallback, useEffect, useState } from "react";
import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
import { fetchReview, type CapabilityReviewResponse } from "../api/projectClient";
import { useProjectStore } from "../store/ProjectStore";
import type { DiffEntry } from "../parser/capabilityDiff";
import {
  delegateDisplayName,
  executeAndReachHeading,
  groupCapabilities,
  type InventoryCap,
  type InventoryReach,
} from "./inventoryGroups";

const GLYPH: Record<DiffEntry["change"], string> = {
  added: "＋",
  removed: "－",
  changed: "～",
};

const CLI_DIFF = "npx @danielalbinsson/aletheia-cli diff --baseline git:main";
const DOCS_QUICKSTART = `${import.meta.env.BASE_URL}docs/quickstart.md`;

function verdictLine(r: CapabilityReviewResponse): { headline: string; tone: string } {
  if (!r.diff) return { headline: "No authority changes to show.", tone: "routine" };
  if (r.diff.isInitial) {
    return { headline: "First snapshot: this is the agent's initial authority.", tone: "elevated" };
  }
  if (!r.diff.hasChanges) {
    return { headline: "No authority changes since the last snapshot.", tone: "routine" };
  }
  if (r.diff.hasElevated) {
    return { headline: "Authority expanded: review required.", tone: "elevated" };
  }
  return { headline: "Routine authority changes only.", tone: "routine" };
}

function provenanceSuffix(label: string): string {
  return `${label} (from source)`;
}

function CapabilityInventory({
  capabilities,
  reach,
  fromSource,
}: {
  capabilities: InventoryCap[];
  reach: InventoryReach[];
  fromSource: boolean;
}) {
  const { delegates, writeShell, other } = groupCapabilities(capabilities);
  const heading = (label: string) => (fromSource ? provenanceSuffix(label) : label);
  const executeHeading = executeAndReachHeading(writeShell.length, reach.length);

  return (
    <div className="review-group">
      {delegates.length > 0 && (
        <>
          <h2>{heading("Delegates")}</h2>
          <ul className="review-list">
            {delegates.map((c, i) => (
              <li key={c.source ?? `delegate-${i}`}>{delegateDisplayName(c.label)}</li>
            ))}
          </ul>
        </>
      )}
      {other.length > 0 && (
        <>
          <h2>{heading("It can")}</h2>
          <ul className="review-list">
            {other.map((c, i) => (
              <li key={c.source ?? `other-${i}`}>{c.label}</li>
            ))}
          </ul>
        </>
      )}
      {(writeShell.length > 0 || reach.length > 0) && (
        <>
          <h2 className="review-elevated-head">{heading(executeHeading)}</h2>
          <ul className="review-list review-list-execute">
            {writeShell.map((c, i) => (
              <li key={c.source ?? `exec-${i}`}>{c.label}</li>
            ))}
            {reach.map((r, i) => (
              <li key={r.label + i}>
                {r.label}
                {r.detail ? ` (${r.detail})` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function InspectNextSteps() {
  return (
    <div className="review-next">
      <p>To see how authority changed, run this in the eve agent directory:</p>
      <pre className="home-code review-next-code">
        <code>{CLI_DIFF}</code>
      </pre>
      <p className="review-next-links">
        <a href={DOCS_QUICKSTART}>CLI and PR gate</a>
        {" · "}
        Local inspector:{" "}
        <a
          href="https://github.com/danielalbinsson/Aletheia"
          target="_blank"
          rel="noreferrer"
          aria-label="Clone Aletheia (opens in a new tab)"
        >
          clone the repo
        </a>
        , then <code>pnpm dev</code>
      </p>
    </div>
  );
}

export function CapabilityReviewPage() {
  const { model, apiAvailable, loading: storeLoading } = useProjectStore();
  const [review, setReview] = useState<CapabilityReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Wait until ProjectStore has probed the inspection API. On the static
    // showcase there is no /api — fetching would get HTML and blow up as JSON.
    if (storeLoading) return;

    setLoading(true);
    setError(null);
    try {
      if (!apiAvailable) {
        // Hosted demo: current capabilities from source, not a change review.
        setReview({ ok: false, built: false });
        return;
      }
      setReview(await fetchReview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the review");
    } finally {
      setLoading(false);
    }
  }, [apiAvailable, storeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const elevated = review?.diff?.entries.filter((e) => e.risk === "elevated") ?? [];
  const routine = review?.diff?.entries.filter((e) => e.risk === "routine") ?? [];
  const showingDiff = Boolean(apiAvailable && review?.ok && review.diff);
  const showingSnapshot = Boolean(review && !loading && !review.built);
  const titleJob = showingDiff ? "how its authority changed" : "current capabilities";

  const loadingCopy = storeLoading
    ? "Loading…"
    : apiAvailable
      ? "Loading authority diff…"
      : "Loading capabilities…";

  const snapshotVerdict = !apiAvailable
    ? {
        headline: "Current snapshot from source — not a change since a baseline.",
        tone: "routine",
      }
    : {
        headline:
          "No compiled manifest yet. Showing capabilities from source. Build the agent (in its own project) to verify these and diff authority changes.",
        tone: "routine",
      };

  return (
    <main className="app review-app">
      <AppNav
        center={apiAvailable ? <WorkspaceSwitcher /> : undefined}
      />

      <section className="review-body">
        <h1 className="review-title">
          {model ? model.name : "Agent"}: {titleJob}
        </h1>

        <div className="review-status" role="status" aria-live="polite" aria-atomic="true">
          {loading && <p className="review-note">{loadingCopy}</p>}
          {error && <p className="review-note review-error">{error}</p>}
          {showingSnapshot && (
            <p className={`review-verdict tone-${snapshotVerdict.tone}`}>
              {snapshotVerdict.headline}
            </p>
          )}
          {showingDiff && review && (
            <p className={`review-verdict tone-${verdictLine(review).tone}`}>
              {verdictLine(review).headline}
            </p>
          )}
        </div>

        {showingSnapshot && model && (
          <>
            <CapabilityInventory
              capabilities={model.capabilities}
              reach={model.reach}
              fromSource
            />
            {!apiAvailable && <InspectNextSteps />}
          </>
        )}

        {showingDiff && review?.diff?.isInitial && review.current && (
          <CapabilityInventory
            capabilities={review.current.capabilities}
            reach={review.current.reach}
            fromSource={false}
          />
        )}

        {showingDiff && elevated.length > 0 && (
          <div className="review-group">
            <h2 className="review-elevated-head">Needs your attention</h2>
            <ul className="review-list review-list-execute">
              {elevated.map((e, i) => (
                <li key={i}>
                  <span className="review-glyph">{GLYPH[e.change]}</span> {e.summary}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showingDiff && routine.length > 0 && (
          <div className="review-group">
            <h2>Other changes</h2>
            <ul className="review-list">
              {routine.map((e, i) => (
                <li key={i}>
                  <span className="review-glyph">{GLYPH[e.change]}</span> {e.summary}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <AppFooter />
    </main>
  );
}
