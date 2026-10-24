import "@fontsource/gelasio/latin-400.css";
import "@fontsource/gelasio/latin-700-italic.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: { default: "Ricettario", template: "%s · Ricettario" } };
export const viewport: Viewport = { themeColor: "#c8102e" };

export default function RicettarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="ricettario" className="min-h-dvh bg-bg text-ink">
      {children}
    </div>
  );
}
