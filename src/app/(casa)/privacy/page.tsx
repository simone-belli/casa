import type { Metadata } from "next";
import Image from "next/image";
import { ui } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

const UPDATED = "26 October 2026";

/** Casa's privacy policy. Public (no sign-in), as Google asks for one before Agenda can use Google Calendar. */
export default function PrivacyPage() {
  return (
    <main className={`${ui.page} flex flex-col gap-6 pt-[max(env(safe-area-inset-top),1.5rem)]`}>
      <header className="flex items-center gap-3 pt-4">
        <Image src="/brand/casa.svg" alt="" width={48} height={48} className="rounded-xl" unoptimized />
        <h1 className="font-display text-3xl">Privacy</h1>
      </header>

      <div className="flex flex-col gap-4 leading-relaxed">
        <p>
          Casa is a private household app for two people, Simone and Kat. It holds our recipes, shopping list, calendar and tasks. Only the two of us can sign in;
          there&apos;s no public sign-up.
        </p>

        <h2 className="font-display text-xl">What Casa stores</h2>
        <p>
          What we add to it: recipes and their photos, grocery items, calendar events and tasks, and our email addresses for signing in. It&apos;s stored in our
          own Supabase database, which only the two of us can read.
        </p>

        <h2 className="font-display text-xl">Google Calendar</h2>
        <p>
          If we connect Google Calendar, Casa reads and changes the events of the one calendar we pick (our shared &ldquo;Casa&rdquo; calendar), so that it
          matches the Agenda section. To show the list of calendars to pick from, it reads their names. It reads the email address of the connected Google
          account to show which account is connected. It doesn&apos;t read any other calendar, contacts or email.
        </p>
        <p>
          The Google sign-in is stored encrypted on the server and is never sent to our phones. Google data is used only to keep Agenda and that calendar in
          step. It isn&apos;t shared, sold, used for advertising, or used to train AI models.
        </p>
        <p>
          Casa&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-brand underline">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h2 className="font-display text-xl">AI features</h2>
        <p>
          When we ask Casa to read a recipe, sort a pasted shopping list or fill in an agenda item from a typed line, that text (or photo) is sent to Anthropic&apos;s
          Claude API to do it. Google Calendar data isn&apos;t sent to it.
        </p>

        <h2 className="font-display text-xl">Removing access</h2>
        <p>
          Agenda → Settings → Disconnect stops Casa using Google Calendar. Access can also be removed at any time at{" "}
          <a href="https://myaccount.google.com/permissions" className="text-brand underline">
            myaccount.google.com/permissions
          </a>
          . Anything in Casa can be deleted from within the app.
        </p>

        <p className="text-sm text-muted">Last updated {UPDATED}.</p>
      </div>
    </main>
  );
}
