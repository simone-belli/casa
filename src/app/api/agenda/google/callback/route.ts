import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, STATE_COOKIE } from "@/lib/google/calendar";
import { connectAccount } from "@/lib/google/sync";
import { currentMember } from "@/lib/supabase/server";

/** Where Google sends the browser back after the consent screen. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const settings = `${origin}/agenda/settings`;
  const fail = (message: string) => {
    const response = NextResponse.redirect(`${settings}?google_error=${encodeURIComponent(message)}`);
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/agenda/google" });
    return response;
  };

  if (!(await currentMember())) return NextResponse.redirect(`${origin}/login`);
  if (searchParams.get("error")) return fail("Google Calendar wasn't connected.");
  const state = request.cookies.get(STATE_COOKIE)?.value;
  const code = searchParams.get("code");
  if (!state || state !== searchParams.get("state") || !code) return fail("The connection timed out. Try again.");

  try {
    const { refreshToken, email } = await exchangeCode(code, origin);
    await connectAccount(email, refreshToken);
  } catch (error) {
    console.error("Connecting Google Calendar failed", error);
    return fail(error instanceof Error ? error.message : "Connecting Google Calendar failed.");
  }
  const response = NextResponse.redirect(`${settings}?google=pick`);
  response.cookies.delete({ name: STATE_COOKIE, path: "/api/agenda/google" });
  return response;
}
