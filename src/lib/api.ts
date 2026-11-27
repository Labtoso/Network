"use client";

const BASE_KEY = "network.apiBase";
const SESSION_KEY = "network.session";

export interface StoredSession {
  token: string;
  expiresAt: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: Record<string, unknown> = {}) {
    super(message);
  }
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Backend-Adresse: im Wizard gesetzter Wert > Build-Variable > gleiche Herkunft (lokal ueber Caddy). */
export function getApiBase(): string {
  const stored = storage()?.getItem(BASE_KEY);
  const value = stored ?? process.env.NEXT_PUBLIC_API_BASE ?? "";
  return value.replace(/\/+$/, "");
}

export function setApiBase(value: string): void {
  const clean = value.trim().replace(/\/+$/, "");
  if (clean) storage()?.setItem(BASE_KEY, clean);
  else storage()?.removeItem(BASE_KEY);
}

export function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = storage()?.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session.token || Date.parse(session.expiresAt) < Date.now()) {
      storage()?.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession | null): void {
  if (session) storage()?.setItem(SESSION_KEY, JSON.stringify(session));
  else storage()?.removeItem(SESSION_KEY);
}

export const UNAUTHORIZED_EVENT = "network:unauthorized";

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal; auth?: boolean } = {}): Promise<T> {
  const session = options.auth === false ? null : loadSession();
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(`Backend unter ${getApiBase() || window.location.origin} nicht erreichbar.`, 0);
  }
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text.slice(0, 200) };
  }
  if (!response.ok) {
    if (response.status === 401 && session) {
      saveSession(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(String(body.error ?? `HTTP ${response.status}`), response.status, body);
  }
  return body as T;
}

/**
 * Server-Sent Events ueber fetch, damit der Bearer-Header mitgeschickt werden kann
 * (EventSource unterstuetzt keine eigenen Header).
 */
export async function streamEvents(
  path: string,
  onEvent: (event: string, data: unknown) => void,
  signal: AbortSignal,
): Promise<void> {
  const session = loadSession();
  const response = await fetch(apiUrl(path), {
    headers: { Accept: "text/event-stream", ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
    signal,
    cache: "no-store",
  });
  if (!response.ok || !response.body) {
    if (response.status === 401) {
      saveSession(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(`Stream fehlgeschlagen (HTTP ${response.status}).`, response.status);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let index: number;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) {
        try {
          onEvent(event, JSON.parse(data.join("\n")));
        } catch {
          onEvent(event, data.join("\n"));
        }
      }
    }
  }
}
