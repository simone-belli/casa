import type { Metadata } from "next";
import { FreshOnEachVisit } from "@/components/fresh-on-each-visit";
import { ui } from "@/components/ui";
import { GroceriesHeader } from "../header";
import { ShopList } from "./shop-list";

export const metadata: Metadata = { title: "Shopping" };

export default function ShopPage() {
  return (
    <>
      <GroceriesHeader tab="shop" />
      <main className={ui.page}>
        {/* A fresh trolley on every trip. */}
        <FreshOnEachVisit>
          <ShopList />
        </FreshOnEachVisit>
      </main>
    </>
  );
}
