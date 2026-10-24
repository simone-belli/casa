import { SectionHeader } from "@/components/section-header";

/** The Ricettario header, with the checkered band from the logo underneath. */
export function RicettarioHeader({
  title = "Ricettario",
  back = { href: "/", label: "Back to Casa" },
  action,
}: {
  title?: string;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <SectionHeader
      logo="/brand/ricettario.svg"
      title={title}
      back={back}
      action={action}
      band={<div className="checkered-band" aria-hidden />}
    />
  );
}
