import {
  extractMessageDelta,
  readNdjsonEvents,
  type EveStreamEvent,
} from "./eveStream";

export interface EveSessionCursor {
  sessionId: string;
  continuationToken: string;
}

export async function chatWithEve(
  message: string,
  options: {
    session?: EveSessionCursor;
    onDelta?: (text: string) => void;
    onEvent?: (event: EveStreamEvent, index: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<{ session: EveSessionCursor; fullText: string; events: EveStreamEvent[] }> {
  const { session, onDelta, onEvent, signal } = options;
  let sessionId = session?.sessionId;
  let continuationToken = session?.continuationToken;

  const startRes = await fetch(
    sessionId ? `/eve/v1/session/${sessionId}` : "/eve/v1/session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        sessionId ? { message, continuationToken } : { message }
      ),
      signal,
    }
  );

  if (!startRes.ok) {
    const body = await startRes.text();
    throw new Error(body || `Session request failed (${startRes.status})`);
  }

  const startBody = (await startRes.json()) as {
    sessionId?: string;
    continuationToken?: string;
  };

  sessionId = startBody.sessionId ?? sessionId;
  continuationToken = startBody.continuationToken ?? continuationToken;

  if (!sessionId || !continuationToken) {
    throw new Error("eve session response missing sessionId or continuationToken");
  }

  const streamRes = await fetch(`/eve/v1/session/${sessionId}/stream`, {
    signal,
  });

  if (!streamRes.ok) {
    throw new Error(`Stream failed (${streamRes.status})`);
  }

  let fullText = "";
  const events = await readNdjsonEvents(streamRes, {
    signal,
    onEvent: (event, index) => {
      const delta = extractMessageDelta(event);
      if (delta) {
        fullText += delta;
        onDelta?.(delta);
      }
      onEvent?.(event, index);
    },
  });

  return {
    session: { sessionId, continuationToken },
    fullText,
    events,
  };
}
