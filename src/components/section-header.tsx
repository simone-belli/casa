import Image from "next/image";
import { SafeLink } from "@/components/safe-link";

type Props = {
  logo: string;
  title: string;
  /** Where the back arrow goes; omitted on the Casa home screen. */
  back?: { href: string; label: string };
  action?: React.ReactNode;
  band?: React.ReactNode;
};

export function SectionHeader({ logo, title, back, action, band }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-brand text-brand-ink shadow-sm">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        {back && (
          <SafeLink
            href={back.href}
            aria-label={back.label}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-2xl active:bg-white/20"
          >
            ‹
          </SafeLink>
        )}
        <Image src={logo} alt="" width={36} height={36} className="rounded-lg ring-2 ring-white/80" priority unoptimized />
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl [font-style:var(--title-style)]">{title}</h1>
        {action}
      </div>
      {band}
    </header>
  );
}
