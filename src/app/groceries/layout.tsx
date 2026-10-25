import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Groceries" };
export const viewport: Viewport = { themeColor: "#2f6b47" };

export default function GroceriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="groceries" className="min-h-dvh bg-bg text-ink">
      {children}
    </div>
  );
}
