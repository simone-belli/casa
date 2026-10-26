import type { Metadata } from "next";
import { FreshOnEachVisit } from "@/components/fresh-on-each-visit";
import { SectionHeader } from "@/components/section-header";
import { ui } from "@/components/ui";
import { BugReportForm } from "./bug-report-form";

export const metadata: Metadata = { title: "Report a bug" };

export default function ReportBugPage() {
  return (
    <>
      <SectionHeader logo={{ src: "/brand/casa.svg", href: "/", label: "Casa home" }} title="Report a bug" back={{ href: "/", label: "Back to Casa" }} />
      <main className={`${ui.page} pt-6`}>
        <FreshOnEachVisit>
          <BugReportForm />
        </FreshOnEachVisit>
      </main>
    </>
  );
}
