import type { Metadata } from "next";
import { startCheckout } from "@/app/(app)/subscription/actions";
import { requireUser } from "@/lib/auth/current-user";
import { loadSubscription } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Assinatura",
};

const STATUS_LABEL: Record<string, string> = {
  TRIALING: "Teste grátis",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento pendente",
  CANCELED: "Cancelada",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return days > 0 ? days : 0;
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: plans }, access] = await Promise.all([
    supabase.from("plan").select("id, code, name, amount, interval").eq("is_active", true).order("amount"),
    user.tenantId ? loadSubscription(supabase, user.tenantId) : Promise.resolve(null),
  ]);

  const subscription = access?.subscription ?? null;
  const trialDays = subscription?.status === "TRIALING" ? daysLeft(subscription.trial_ends_at) : null;
  const open = access?.allowed ?? false;

  return (
    <Card className="max-w-xl">
      <CardContent className="space-y-4 px-6 py-6">
        {error ? (
          <p className="text-sm text-destructive">Não foi possível abrir o pagamento. Tente de novo.</p>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold">Assinatura</h2>
          <p className="text-sm text-muted-foreground">
            {subscription
              ? STATUS_LABEL[subscription.status] ?? subscription.status
              : "Nenhuma assinatura encontrada."}
            {trialDays !== null ? ` · ${trialDays} ${trialDays === 1 ? "dia restante" : "dias restantes"}` : ""}
            {subscription?.status === "ACTIVE" && subscription.current_period_end
              ? ` · válida até ${new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}`
              : ""}
          </p>
        </div>

        {!user.isAdmin ? (
          <p className="text-sm">Peça a um administrador da empresa para assinar o plano.</p>
        ) : (
          <form action={startCheckout} className="space-y-3">
            {(plans ?? []).map((plan) => (
              <label key={plan.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-3">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="planId"
                    value={plan.id}
                    defaultChecked={subscription ? plan.id === subscription.plan_id : plan.code === "STANDARD"}
                    required
                  />
                  <span>
                    <span className="block font-medium">{plan.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {plan.interval === "MONTHLY" ? "Cobrança mensal" : plan.interval}
                    </span>
                  </span>
                </span>
                <span className="font-semibold">{money(plan.amount)}</span>
              </label>
            ))}
            <Button type="submit" disabled={open && subscription?.status === "ACTIVE"}>
              {open && subscription?.status === "ACTIVE" ? "Assinatura em dia" : "Assinar"}
            </Button>
            {!open ? (
              <p className="text-sm text-muted-foreground">
                O pagamento abre no Asaas. Depois da confirmação, o acesso volta sozinho.
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
