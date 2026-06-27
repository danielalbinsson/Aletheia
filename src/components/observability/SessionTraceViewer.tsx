import { useMemo, useState } from "react";
import type { EveStreamEvent } from "../../lib/eveStream";
import { summarizeEvent } from "../../lib/eveStream";

const HIGHLIGHT_TYPES = new Set([
  "actions.requested",
  "action.result",
  "turn.failed",
  "session.failed",
  "step.failed",
  "input.requested",
  "subagent.called",
  "subagent.completed",
]);

function eventTone(type: string): string {
  if (type.includes("failed")) return "error";
  if (type.includes("completed") || type === "session.waiting") return "ok";
  if (HIGHLIGHT_TYPES.has(type)) return "accent";
  return "";
}

interface SessionTraceViewerProps {
  events: EveStreamEvent[];
  loading?: boolean;
  emptyMessage?: string;
}

export function SessionTraceViewer({
  events,
  loading = false,
  emptyMessage = "No events yet.",
}: SessionTraceViewerProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const rows = useMemo(
    () =>
      events.map((event, index) => ({
        index,
        event,
        summary: summarizeEvent(event),
        tone: eventTone(event.type),
      })),
    [events]
  );

  if (loading) {
    return <p className="trace-empty">Loading stream…</p>;
  }

  if (rows.length === 0) {
    return <p className="trace-empty">{emptyMessage}</p>;
  }

  return (
    <ol className="trace-list">
      {rows.map(({ index, event, summary, tone }) => {
        const isOpen = expanded[index] ?? false;
        const hasData = event.data && Object.keys(event.data).length > 0;

        return (
          <li key={`${index}-${event.type}`} className={`trace-row ${tone}`}>
            <button
              type="button"
              className="trace-row-head"
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [index]: !isOpen }))
              }
              disabled={!hasData}
            >
              <span className="trace-index">{index + 1}</span>
              <code className="trace-type">{event.type}</code>
              <span className="trace-summary">{summary}</span>
            </button>
            {isOpen && hasData && (
              <pre className="trace-payload">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}
