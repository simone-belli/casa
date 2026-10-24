"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ui } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Email sign-in. Supabase emails both a link and a one-time code. The code is
 * the reliable route on iPhone: a home-screen app doesn't share its login with
 * Safari, so a link opened from Mail would sign in Safari, not the app.
 */
export function LoginForm() {
  const router = useRouter();
  const linkFailed = useSearchParams().get("error") === "link";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkFailed ? "That sign-in link didn't work here. Enter the code from the email instead." : null,
  );

  async function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 422 || /signups not allowed|not found/i.test(error.message)
          ? "That email address isn't on the household list."
          : error.status === 429
            ? "Too many emails sent. Please wait a few minutes and try again."
            : "Couldn't reach the sign-in service. Check your connection and try again.",
      );
      return;
    }
    setSent(true);
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError("That code didn't work. Check it, or send a new email.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className={`${ui.page} flex min-h-dvh flex-col justify-center gap-6 py-10`}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/brand/casa.svg" alt="" width={80} height={80} className="rounded-[20px] shadow-md" priority unoptimized />
        <h1 className="font-display text-3xl">Casa</h1>
      </div>

      {!sent ? (
        <form onSubmit={sendEmail} className={`${ui.card} flex flex-col gap-4`}>
          <div>
            <label htmlFor="email" className={ui.label}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ui.input}
            />
          </div>
          {error && <p className={ui.error}>{error}</p>}
          <button type="submit" disabled={busy} className={ui.primary}>
            {busy ? "Sending…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className={`${ui.card} flex flex-col gap-4`}>
          <p className="text-muted">
            We sent an email to <strong className="text-ink">{email}</strong>. Enter the code from it below.
          </p>
          <div>
            <label htmlFor="code" className={ui.label}>
              Code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${ui.input} text-center text-2xl tracking-[0.4em]`}
            />
          </div>
          {error && <p className={ui.error}>{error}</p>}
          <button type="submit" disabled={busy} className={ui.primary}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            className="text-sm text-muted underline"
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
            }}
          >
            Use a different email or send again
          </button>
        </form>
      )}
    </main>
  );
}
