import { SectionHeader } from "@/components/section-header";

/** The Ricettario header, with the checkered band from the logo underneath. */
export function RicettarioHeader({
  title = "Ricettario",
  back = { href: "/", label: "Back to Casa" },
  hideTitle,
  action,
}: {
  title?: string;
  hideTitle?: boolean;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <SectionHeader
      logo={{ src: "/brand/ricettario.svg", href: "/ricettario", label: "Ricettario home" }}
      casaLink
      title={title}
      hideTitle={hideTitle}
      back={back}
      action={action}
      band={<div className="checkered-band" aria-hidden />}
    />
  );
}
