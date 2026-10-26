import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { supabaseServer } from "@/lib/supabase/server";

/** Where the sign-in link in the email lands. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const supabase = await supabaseServer();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing sign-in token") };

  return NextResponse.redirect(error ? `${origin}/login?error=link` : `${origin}/`);
}
