import "server-only";

import type { EventBody, GoogleEvent } from "@/lib/agenda/google";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

/** Reading the calendar list (to pick the Casa calendar) and changing events. */
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

/** The environment variables Google sync needs that aren't set. */
export function missingConfig(): string[] {
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AGENDA_TOKEN_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SECRET_KEY");
  return missing;
}

/** A failed Google call, with its HTTP status. */
export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Google refused the stored sign-in (revoked or expired): connect again. */
export class GoogleAuthError extends Error {}

/** The cookie that ties Google's answer to the phone that asked. */
export const STATE_COOKIE = "agenda_google_state";

export const redirectUri = (origin: string) => `${origin}/api/agenda/google/callback`;

export function authUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Always ask, so Google returns a refresh token every time.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    if (body.error === "invalid_grant") throw new GoogleAuthError("Google no longer accepts Casa's access. Connect Google Calendar again.");
    throw new GoogleError(`Google sign-in failed: ${body.error_description ?? body.error ?? response.status}`, response.status);
  }
  return body;
}

/** Swaps the code from Google's consent screen for tokens, and reads the account's email. */
export async function exchangeCode(code: string, origin: string): Promise<{ refreshToken: string; email: string | null }> {
  const body = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) });
  if (!body.refresh_token) throw new GoogleError("Google didn't return a refresh token. Try connecting again.", 400);
  let email: string | null = null;
  if (body.id_token) {
    // Straight from Google over https, so the payload can be read without verifying it.
    const payload = JSON.parse(Buffer.from(body.id_token.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    email = payload.email ?? null;
  }
  return { refreshToken: body.refresh_token, email };
}

export async function accessToken(refreshToken: string): Promise<string> {
  return (await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" })).access_token!;
}

/** One authorised call to the Calendar API. 204 answers return null. */
async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 204) return null;
  const json = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!response.ok) {
    if (response.status === 401) throw new GoogleAuthError("Google no longer accepts Casa's access. Connect Google Calendar again.");
    throw new GoogleError(`Google Calendar: ${json?.error?.message ?? response.statusText} (${response.status})`, response.status);
  }
  return json;
}

const cal = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}`;

export type CalendarEntry = { id: string; summary: string; primary?: boolean; accessRole: string; timeZone?: string };

/** Calendars the account can change. */
export async function listCalendars(token: string): Promise<CalendarEntry[]> {
  const result = await call<{ items?: CalendarEntry[] }>(token, "GET", "/users/me/calendarList?minAccessRole=writer&maxResults=250");
  return result?.items ?? [];
}

export type EventPage = { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string; timeZone?: string };

/** One page of events: everything (no sync token) or what changed since the sync token. */
export async function listEvents(token: string, calendarId: string, syncToken: string | null, pageToken?: string): Promise<EventPage> {
  const params = new URLSearchParams({ maxResults: "250" });
  if (syncToken) params.set("syncToken", syncToken);
  else params.set("showDeleted", "false");
  if (pageToken) params.set("pageToken", pageToken);
  return (await call<EventPage>(token, "GET", `${cal(calendarId)}/events?${params}`))!;
}

export async function insertEvent(token: string, calendarId: string, id: string, body: EventBody): Promise<GoogleEvent> {
  return (await call<GoogleEvent>(token, "POST", `${cal(calendarId)}/events`, { id, ...body }))!;
}

export async function patchEvent(token: string, calendarId: string, id: string, body: EventBody): Promise<GoogleEvent> {
  return (await call<GoogleEvent>(token, "PATCH", `${cal(calendarId)}/events/${encodeURIComponent(id)}`, body))!;
}

export async function deleteEvent(token: string, calendarId: string, id: string): Promise<void> {
  await call(token, "DELETE", `${cal(calendarId)}/events/${encodeURIComponent(id)}`);
}

/** Asks Google to call `address` whenever the calendar changes. */
export async function watchEvents(token: string, calendarId: string, channel: { id: string; token: string; address: string }) {
  const result = await call<{ resourceId: string; expiration?: string }>(token, "POST", `${cal(calendarId)}/events/watch`, {
    id: channel.id,
    type: "web_hook",
    address: channel.address,
    token: channel.token,
  });
  return { resourceId: result!.resourceId, expiresAt: result!.expiration ? new Date(Number(result!.expiration)).toISOString() : null };
}

export async function stopChannel(token: string, channelId: string, resourceId: string): Promise<void> {
  await call(token, "POST", "/channels/stop", { id: channelId, resourceId });
}
