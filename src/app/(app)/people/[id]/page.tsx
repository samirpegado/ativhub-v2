import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { TechDashboard } from "@/components/dashboard/tech-dashboard";
import { firstAllowedPageLabel } from "@/lib/auth/permissions";
import { loadMaintenanceOverview } from "@/lib/dashboard/load";
import { parseTechRange } from "@/lib/dashboard/overview";
import { loadPersonDashboard } from "@/lib/people/queries";

export const metadata: Metadata = {
  title: "Painel da pessoa",
};

export default async function PersonDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const person = await loadPersonDashboard(id);
  if (!person) notFound();

  const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || "Pessoa";
  const range = parseTechRange((await searchParams).range);
  const periodBase = `/people/${person.id}`;

  return (
    <div className="space-y-4">
      <Link href="/people" className="inline-flex items-center gap-2 font-medium text-[#4a5a70]">
        <ArrowLeft className="size-[18px]" />
        Voltar para pessoas
      </Link>
      <p className="text-sm text-[#4a5a70]">Painel de {name}, como aparece quando essa pessoa entra.</p>
      {person.viewer ? (
        person.editor ? (
          <AdminDashboard data={await loadMaintenanceOverview(null, range)} range={range} periodBase={periodBase} />
        ) : (
          <TechDashboard
            data={await loadMaintenanceOverview(person.id, range)}
            firstName={person.firstName}
            range={range}
            periodBase={periodBase}
            preview
          />
        )
      ) : (
        <p className="text-sm text-[#14233a]">
          Esta pessoa não abre o painel de manutenção. Ao entrar, o acesso começa em {firstAllowedPageLabel(person)}.
        </p>
      )}
    </div>
  );
}
