export interface EveStreamEvent {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  [key: string]: unknown;
}

export function parseNdjsonLine(line: string): EveStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as EveStreamEvent;
    return typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function readNdjsonEvents(
  res: Response,
  options: {
    onEvent?: (event: EveStreamEvent, index: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<EveStreamEvent[]> {
  const reader = res.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  let buffer = "";
  const events: EveStreamEvent[] = [];
  let index = 0;

  while (true) {
    if (options.signal?.aborted) {
      await reader.cancel();
      return events;
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseNdjsonLine(line);
      if (!event) continue;
      events.push(event);
      options.onEvent?.(event, index);
      index += 1;
    }
  }

  if (buffer.trim()) {
    const event = parseNdjsonLine(buffer);
    if (event) {
      events.push(event);
      options.onEvent?.(event, index);
    }
  }

  return events;
}

export function extractMessageDelta(event: EveStreamEvent): string {
  if (event.type === "message.appended") {
    const delta = event.data?.messageDelta;
    return typeof delta === "string" ? delta : "";
  }
  if (event.type === "message.completed") {
    const message = event.data?.message;
    if (message && typeof message === "object" && "content" in message) {
      const content = (message as { content?: unknown }).content;
      return typeof content === "string" ? content : "";
    }
  }
  return "";
}

function formatFailureMessage(event: EveStreamEvent): string | null {
  const data = event.data;
  if (!data || typeof data !== "object") return null;
  const message = data.message;
  if (typeof message === "string" && message.trim()) {
    const code = typeof data.code === "string" ? data.code : null;
    return code ? `${code}: ${message}` : message;
  }
  return null;
}

export function findFailureMessage(events: EveStreamEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (
      event?.type === "step.failed" ||
      event?.type === "turn.failed" ||
      event?.type === "session.failed"
    ) {
      const message = formatFailureMessage(event);
      if (message) return enrichOpenRouterFailure(message);
    }
  }
  return null;
}

/** Add actionable hints for common OpenRouter account errors. */
export function enrichOpenRouterFailure(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("guardrail") ||
    lower.includes("data policy") ||
    lower.includes("no endpoints available")
  ) {
    return `${message} — Open https://openrouter.ai/settings/privacy and relax Zero Data Retention / provider restrictions, or pick a model that matches your policy (e.g. anthropic/claude-sonnet-4).`;
  }
  return message;
}

export function summarizeEvent(event: EveStreamEvent): string {
  switch (event.type) {
    case "message.received": {
      const message = event.data?.message;
      if (typeof message === "string") return message.slice(0, 80);
      return "User message";
    }
    case "message.appended":
      return extractMessageDelta(event).slice(0, 80) || "Assistant delta";
    case "message.completed":
      return "Assistant message completed";
    case "actions.requested": {
      const actions = event.data?.actions;
      if (Array.isArray(actions) && actions[0] && typeof actions[0] === "object") {
        const name = (actions[0] as { name?: string }).name;
        return name ? `Tool call: ${name}` : "Tool call requested";
      }
      return "Tool call requested";
    }
    case "action.result": {
      const name = event.data?.name;
      return typeof name === "string" ? `Tool result: ${name}` : "Tool result";
    }
    case "turn.started":
      return "Turn started";
    case "turn.completed":
      return "Turn completed";
    case "turn.failed":
      return formatFailureMessage(event) ?? "Turn failed";
    case "session.started":
      return "Session started";
    case "session.waiting":
      return "Waiting for input";
    case "session.completed":
      return "Session completed";
    case "session.failed":
      return formatFailureMessage(event) ?? "Session failed";
    case "subagent.called": {
      const child = event.data?.childSessionId;
      return typeof child === "string" ? `Subagent → ${child}` : "Subagent called";
    }
    case "subagent.completed":
      return "Subagent completed";
    case "step.started":
      return "Model step started";
    case "step.completed":
      return "Model step completed";
    case "step.failed":
      return formatFailureMessage(event) ?? "Model step failed";
    case "input.requested":
      return "Human input requested";
    case "authorization.required":
      return "Authorization required";
    default:
      return event.type;
  }
}

export function sessionStatusFromEvents(events: EveStreamEvent[]): TrackedSessionStatus {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const type = events[i]?.type;
    if (type === "session.failed" || type === "turn.failed") return "failed";
    if (type === "session.completed") return "completed";
    if (type === "session.waiting") return "waiting";
  }
  return events.length > 0 ? "active" : "active";
}

export type TrackedSessionStatus = "active" | "waiting" | "completed" | "failed";

export async function fetchSessionStream(
  sessionId: string,
  options: {
    startIndex?: number;
    onEvent?: (event: EveStreamEvent, index: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<EveStreamEvent[]> {
  const params = new URLSearchParams();
  if (options.startIndex !== undefined) {
    params.set("startIndex", String(options.startIndex));
  }
  const query = params.toString();
  const url = `/eve/v1/session/${encodeURIComponent(sessionId)}/stream${
    query ? `?${query}` : ""
  }`;

  const res = await fetch(url, { signal: options.signal });
  if (!res.ok) {
    throw new Error(`Stream failed (${res.status})`);
  }

  return readNdjsonEvents(res, options);
}
