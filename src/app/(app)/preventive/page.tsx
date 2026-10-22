import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PreventiveView } from "@/components/preventive/preventive-view";
import { requireArea } from "@/lib/auth/permissions";
import {
  parsePreventiveQuery,
  preventiveHref,
  preventivePageCount,
} from "@/lib/preventive/list-params";
import { listPreventiveScreen } from "@/lib/preventive/queries";

export const metadata: Metadata = {
  title: "Preventiva",
};

export default async function PreventivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; priority?: string; page?: string }>;
}) {
  const query = parsePreventiveQuery(await searchParams);
  await requireArea("preventive", "view", { redirect: true });
  const screen = await listPreventiveScreen(query);
  const pageCount = preventivePageCount(screen.total);
  if (query.page > pageCount) {
    redirect(preventiveHref({ ...query, page: pageCount }));
  }

  return <PreventiveView query={query} screen={screen} />;
}
