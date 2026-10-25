import { NextResponse, type NextRequest } from "next/server";
import { authUrl, missingConfig, STATE_COOKIE } from "@/lib/google/calendar";
import { randomToken } from "@/lib/google/crypto";
import { currentMember } from "@/lib/supabase/server";

/** Settings → Agenda → Connect Google Calendar: off to Google's consent screen. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  if (!(await currentMember())) return NextResponse.redirect(`${origin}/login`);
  const missing = missingConfig();
  if (missing.length > 0) {
    return NextResponse.redirect(`${origin}/agenda/settings?google_error=${encodeURIComponent(`Not set up on the server yet: ${missing.join(", ")}.`)}`);
  }
  const state = randomToken();
  const response = NextResponse.redirect(authUrl(origin, state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/agenda/google",
  });
  return response;
}
