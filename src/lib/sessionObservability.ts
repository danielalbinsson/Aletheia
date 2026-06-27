import type { EveStreamEvent, TrackedSessionStatus } from "./eveStream";
import { sessionStatusFromEvents } from "./eveStream";

export interface TrackedSession {
  sessionId: string;
  preview: string;
  startedAt: string;
  updatedAt: string;
  status: TrackedSessionStatus;
  eventCount: number;
  events: EveStreamEvent[];
}

const STORAGE_KEY = "aletheia.sessions.v1";
const MAX_SESSIONS = 40;
const MAX_EVENTS_PER_SESSION = 500;

function readAll(): TrackedSession[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackedSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: TrackedSession[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

export function listTrackedSessions(): TrackedSession[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getTrackedSession(sessionId: string): TrackedSession | null {
  return readAll().find((s) => s.sessionId === sessionId) ?? null;
}

export function trackSessionStart(sessionId: string, preview: string): TrackedSession {
  const now = new Date().toISOString();
  const existing = getTrackedSession(sessionId);
  if (existing) {
    return existing;
  }

  const session: TrackedSession = {
    sessionId,
    preview: preview.slice(0, 120),
    startedAt: now,
    updatedAt: now,
    status: "active",
    eventCount: 0,
    events: [],
  };

  const sessions = [session, ...readAll().filter((s) => s.sessionId !== sessionId)];
  writeAll(sessions);
  return session;
}

export function appendSessionEvents(sessionId: string, events: EveStreamEvent[]) {
  if (events.length === 0) return;

  const sessions = readAll();
  const index = sessions.findIndex((s) => s.sessionId === sessionId);
  const now = new Date().toISOString();

  const base: TrackedSession =
    index >= 0
      ? sessions[index]!
      : {
          sessionId,
          preview: "",
          startedAt: now,
          updatedAt: now,
          status: "active",
          eventCount: 0,
          events: [],
        };

  const mergedEvents = [...base.events, ...events].slice(-MAX_EVENTS_PER_SESSION);
  const updated: TrackedSession = {
    ...base,
    updatedAt: now,
    events: mergedEvents,
    eventCount: mergedEvents.length,
    status: sessionStatusFromEvents(mergedEvents),
  };

  if (index >= 0) {
    sessions[index] = updated;
  } else {
    sessions.unshift(updated);
  }

  writeAll(sessions);
}

export function replaceSessionEvents(sessionId: string, events: EveStreamEvent[], preview?: string) {
  const sessions = readAll();
  const index = sessions.findIndex((s) => s.sessionId === sessionId);
  const now = new Date().toISOString();
  const trimmed = events.slice(-MAX_EVENTS_PER_SESSION);

  const updated: TrackedSession = {
    sessionId,
    preview: preview ?? sessions[index]?.preview ?? "",
    startedAt: sessions[index]?.startedAt ?? now,
    updatedAt: now,
    events: trimmed,
    eventCount: trimmed.length,
    status: sessionStatusFromEvents(trimmed),
  };

  if (index >= 0) {
    sessions[index] = updated;
  } else {
    sessions.unshift(updated);
  }

  writeAll(sessions);
}

export function clearTrackedSessions() {
  sessionStorage.removeItem(STORAGE_KEY);
}
