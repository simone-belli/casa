import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Agenda" };
export const viewport: Viewport = { themeColor: "#1f3a5f" };

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="agenda" className="min-h-dvh bg-bg text-ink">
      {children}
    </div>
  );
}
