import { redirect } from "next/navigation";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.page) next.set("page", params.page);
  const path = params.tab === "customers" ? "/customers" : "/vendors";
  const qs = next.toString();
  redirect(qs ? `${path}?${qs}` : path);
}
