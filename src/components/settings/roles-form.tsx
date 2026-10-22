"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateRoles } from "@/app/(app)/settings/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AREA_LABELS, MENU_AREAS, type AreaAccess } from "@/lib/auth/areas";
import type { MutationState } from "@/lib/forms/state";
import { Loader2 } from "lucide-react";

export type RoleSetting = {
  id: string;
  code: string;
  name: string;
  description: string;
  areas: AreaAccess;
};

export function RolesForm({ roles }: { roles: RoleSetting[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<MutationState, FormData>(updateRoles, undefined);
  const [draft, setDraft] = useState(roles);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [router, state]);

  function toggle(code: string, area: keyof AreaAccess, mode: "view" | "edit", checked: boolean) {
    setDraft((current) =>
      current.map((role) => {
        if (role.code !== code || role.code === "ADMIN") return role;
        const next = { ...role.areas[area] };
        if (mode === "edit") {
          next.edit = checked;
          if (checked) next.view = true;
        } else {
          next.view = checked;
          if (!checked) next.edit = false;
        }
        return { ...role, areas: { ...role.areas, [area]: next } };
      }),
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.success ? (
        <Alert>
          <AlertDescription>Funções salvas.</AlertDescription>
        </Alert>
      ) : null}
      {draft.map((role) => (
        <Card key={role.id} className="gap-4 p-4">
          <div>
            <h3 className="font-semibold">{role.name}</h3>
            <Textarea
              name={`description_${role.code}`}
              defaultValue={role.description}
              rows={2}
              className="mt-2"
              placeholder="Descrição do papel"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="py-2">Área</th>
                  <th className="py-2">Ver</th>
                  <th className="py-2">Editar</th>
                </tr>
              </thead>
              <tbody>
                {MENU_AREAS.map((area) => (
                  <tr key={area} className="border-t">
                    <td className="py-2">{AREA_LABELS[area]}</td>
                    <td>
                      <input
                        type="checkbox"
                        name={`${role.code}_${area}_view`}
                        checked={role.areas[area].view}
                        disabled={role.code === "ADMIN"}
                        onChange={(event) => toggle(role.code, area, "view", event.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        name={`${role.code}_${area}_edit`}
                        checked={role.areas[area].edit}
                        disabled={role.code === "ADMIN"}
                        onChange={(event) => toggle(role.code, area, "edit", event.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      <Button type="submit" className="h-9 font-semibold" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Salvar funções
      </Button>
    </form>
  );
}
