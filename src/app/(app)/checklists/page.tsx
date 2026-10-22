import { redirect } from "next/navigation";

export default function ChecklistsPage() {
  redirect("/settings#checklists");
}
