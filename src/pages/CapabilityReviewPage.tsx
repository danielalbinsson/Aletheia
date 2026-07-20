import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const { model, apiAvailable } = useProjectStore();
  const [review, setReview] = useState<CapabilityReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReview(await fetchReview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load capability review");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const elevated = review?.diff?.entries.filter((e) => e.risk === "elevated") ?? [];
  const routine = review?.diff?.entries.filter((e) => e.risk === "routine") ?? [];

  return (
    <main className="app review-app">
      <nav className="topbar">
        <div className="wordmark">
          <Link to="/" className="wordmark-link">
            Aletheia
          </Link>
          <span className="wordmark-sub">capability review</span>
        </div>
        <div className="topbar-actions">
          <Link to="/" className="btn-ghost">
            ← Portrait
          </Link>
        </div>
      </nav>

      <section className="review-body">
        <h1 className="review-title">
          {model ? model.name : "Agent"} — how its authority changed
        </h1>

        {!apiAvailable && (
          <p className="review-note">
            The capability review needs the dev server (run <code>pnpm dev</code>).
          </p>
        )}
        {loading && <p className="review-note">Loading review…</p>}
        {error && <p className="review-note review-error">{error}</p>}

        {review && !loading && !review.built && (
          <p className="review-note">
            {review.error ??
              "This agent has no compiled manifest. Build it in its own project to review verified capability changes."}
          </p>
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
    </main>
  );
}
