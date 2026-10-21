import type { Metadata } from "next";
import { ChecklistsView } from "@/components/checklists/checklists-view";
import { listChecklists } from "@/lib/checklists/queries";

export const metadata: Metadata = {
  title: "Listas de verificação",
};

export default async function ChecklistsPage() {
  const checklists = await listChecklists();
  return <ChecklistsView checklists={checklists} />;
}
