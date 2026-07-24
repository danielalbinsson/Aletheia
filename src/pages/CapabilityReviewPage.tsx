import { useCallback, useEffect, useState } from "react";
import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
import { fetchReview, type CapabilityReviewResponse } from "../api/projectClient";
import { useProjectStore } from "../store/ProjectStore";
import type { DiffEntry } from "../parser/capabilityDiff";

const GLYPH: Record<DiffEntry["change"], string> = {
  added: "＋",
  removed: "－",
  changed: "～",
};

function verdictLine(r: CapabilityReviewResponse): { headline: string; tone: string } {
  if (!r.diff) return { headline: "Nothing to review.", tone: "routine" };
  if (r.diff.isInitial) {
    return { headline: "First snapshot — this is the agent's initial authority.", tone: "elevated" };
  }
  if (!r.diff.hasChanges) {
    return { headline: "No capability changes since the last snapshot.", tone: "routine" };
  }
  if (r.diff.hasElevated) {
    return { headline: "Authority expanded — review required.", tone: "elevated" };
  }
  return { headline: "Routine capability changes only.", tone: "routine" };
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
        // Hosted demo: show the bundled agent from source, same as an unbuilt
        // local agent. Full authority diffs need `pnpm dev`.
        setReview({ ok: false, built: false });
        return;
      }
      setReview(await fetchReview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load capability review");
    } finally {
      setLoading(false);
    }
  }, [apiAvailable, storeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const elevated = review?.diff?.entries.filter((e) => e.risk === "elevated") ?? [];
  const routine = review?.diff?.entries.filter((e) => e.risk === "routine") ?? [];

  return (
    <main className="app review-app">
      <AppNav
        subtitle="review"
        center={apiAvailable ? <WorkspaceSwitcher /> : undefined}
      />

      <section className="review-body">
        <h1 className="review-title">
          {model ? model.name : "Agent"} — how its authority changed
        </h1>

        {!apiAvailable && !storeLoading && (
          <p className="review-note">
            Authority diffs need the local inspector (run <code>pnpm dev</code>).
            Showing this agent&apos;s capabilities from source.
          </p>
        )}
        {loading && <p className="review-note">Loading review…</p>}
        {error && <p className="review-note review-error">{error}</p>}

        {review && !loading && !review.built && (
          <div className="review-group">
            {apiAvailable && (
              <p className="review-verdict tone-routine">
                No compiled manifest yet — showing capabilities <strong>from source</strong>.
                Build the agent (in its own project) to verify these and diff authority changes.
              </p>
            )}
            {model && model.capabilities.length > 0 && (
              <>
                <h2>It can — from source</h2>
                <ul className="review-list">
                  {model.capabilities.map((c, i) => (
                    <li key={i}>{c.label}</li>
                  ))}
                </ul>
              </>
            )}
            {model && model.reach.length > 0 && (
              <>
                <h2>And reach — from source</h2>
                <ul className="review-list">
                  {model.reach.map((r, i) => (
                    <li key={i}>
                      {r.label}
                      {r.detail ? ` (${r.detail})` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {review?.ok && review.diff && (
          <>
            <p className={`review-verdict tone-${verdictLine(review).tone}`}>
              {verdictLine(review).headline}
            </p>

            {review.diff.isInitial && review.current && (
              <div className="review-group">
                <h2>It will be able to</h2>
                <ul className="review-list">
                  {review.current.capabilities.map((c, i) => (
                    <li key={i}>{c.label}</li>
                  ))}
                </ul>
                {review.current.reach.length > 0 && (
                  <>
                    <h2>And reach</h2>
                    <ul className="review-list">
                      {review.current.reach.map((r, i) => (
                        <li key={i}>
                          {r.label}
                          {r.detail ? ` (${r.detail})` : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {elevated.length > 0 && (
              <div className="review-group">
                <h2 className="review-elevated-head">⚠ Needs your attention</h2>
                <ul className="review-list">
                  {elevated.map((e, i) => (
                    <li key={i}>
                      <span className="review-glyph">{GLYPH[e.change]}</span> {e.summary}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {routine.length > 0 && (
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
          </>
        )}
      </section>
      <AppFooter />
    </main>
  );
}
