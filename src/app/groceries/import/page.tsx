import type { Metadata } from "next";
import { FreshOnEachVisit } from "@/components/fresh-on-each-visit";
import { ui } from "@/components/ui";
import { GroceriesHeader } from "../header";
import { ImportList } from "./import-list";

export const metadata: Metadata = { title: "Paste a list" };

export default function ImportPage() {
  return (
    <>
      <GroceriesHeader title="Paste a list" back={{ href: "/groceries", label: "Back to the list" }} />
      <main className={ui.page}>
        <FreshOnEachVisit>
          <ImportList />
        </FreshOnEachVisit>
      </main>
    </>
  );
}
