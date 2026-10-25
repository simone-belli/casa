import Image from "next/image";
import { SectionHeader } from "@/components/section-header";
import { ui } from "@/components/ui";

export default function GroceriesPage() {
  return (
    <>
      <SectionHeader
        logo={{ src: "/brand/groceries.svg", href: "/groceries", label: "Groceries home" }}
        title="Groceries"
        back={{ href: "/", label: "Back to Casa" }}
        casaLink
      />
      <main className={`${ui.page} flex flex-col items-center gap-4 pt-16 text-center`}>
        <Image src="/brand/groceries.svg" alt="" width={96} height={96} className="rounded-3xl shadow-md" unoptimized />
        <h2 className="font-display text-2xl font-semibold">Coming soon</h2>
        <p className="max-w-sm text-muted">
          A shared grocery list, sorted for the supermarkets we actually shop at. We&apos;ll build it later.
        </p>
        <span className="h-1 w-16 rounded-full bg-accent" />
      </main>
    </>
  );
}
