import type { Metadata } from "next";
import Link from "next/link";
import { endSupportPreview } from "@/app/(platform)/admin/support/actions";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { TechDashboard } from "@/components/dashboard/tech-dashboard";
import { SupportPreviewWindow } from "@/components/platform-admin/support-preview-window";
import { Button } from "@/components/ui/button";
import { areasFromPermissions, can } from "@/lib/auth/areas";
import { firstAllowedPageLabel } from "@/lib/auth/permissions";
import { parseTechRange, readMaintenanceOverview } from "@/lib/dashboard/overview";
import { PLATFORM_SUPPORT_PATH, PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";
import { loadSupportPreview } from "@/lib/platform-admin/support";

export const metadata: Metadata = { title: "Visualização de suporte" };

export default async function SupportPreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const range = parseTechRange(search.range);
  const preview = await loadSupportPreview(id, range);
  if (!preview) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Visualização de suporte indisponível</h1>
        <Button variant="outline" asChild><Link href={PLATFORM_TENANTS_PATH} prefetch={false}>Voltar para empresas</Link></Button>
      </section>
    );
  }

  const roleCode = preview.roleCode ?? "";
  const isAdmin = preview.isOwner || roleCode === "ADMIN";
  const access = { isAdmin, areas: areasFromPermissions(roleCode, preview.permissions, isAdmin) };
  const name = [preview.firstName, preview.lastName].filter(Boolean).join(" ") || "Pessoa";
  const periodBase = `${PLATFORM_SUPPORT_PATH}/${id}`;
  const dashboard = preview.overview === null ? null : readMaintenanceOverview(preview.overview);

  return (
    <SupportPreviewWindow
      key={id}
      initialSeconds={preview.secondsRemaining}
      identity={<p className="wrap-anywhere text-sm">{[preview.tenantName, name, preview.roleName].filter(Boolean).join(" · ")}</p>}
      endForm={(
        <form action={endSupportPreview.bind(null, id)}>
          <Button type="submit" variant="outline">Encerrar visualização</Button>
        </form>
      )}
    >
      {!preview.subscriptionOpen ? (
        <p>Ao entrar, esta pessoa vê o aviso de assinatura da empresa.</p>
      ) : !can(access, "work_orders", "view") ? (
        <p>Ao entrar, esta pessoa começa em {firstAllowedPageLabel(access)}.</p>
      ) : dashboard ? (
        can(access, "work_orders", "edit") ? (
          <AdminDashboard data={dashboard} range={range} periodBase={periodBase} showOperationalLinks={false} />
        ) : (
          <TechDashboard data={dashboard} firstName={preview.firstName} range={range} periodBase={periodBase} preview showOperationalLinks={false} />
        )
      ) : <p>O painel de manutenção está indisponível nesta visualização.</p>}
    </SupportPreviewWindow>
  );
}
