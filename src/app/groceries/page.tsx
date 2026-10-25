import { ui } from "@/components/ui";
import { GroceriesHeader } from "./header";
import { HomeList } from "./home-list";

export default function GroceriesPage() {
  return (
    <>
      <GroceriesHeader tab="home" />
      <main className={ui.page}>
        <HomeList />
      </main>
    </>
  );
}
