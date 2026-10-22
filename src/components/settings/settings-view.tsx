"use client";

import { useEffect, useState } from "react";
import { ChecklistsView } from "@/components/checklists/checklists-view";
import { RolesForm, type RoleSetting } from "@/components/settings/roles-form";
import { Button } from "@/components/ui/button";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import { cn } from "@/lib/utils";

type Tab = "roles" | "checklists";

export function SettingsView({
  roles,
  checklists,
}: {
  roles: RoleSetting[];
  checklists: ChecklistRecord[];
}) {
  const [tab, setTab] = useState<Tab>("roles");

  useEffect(() => {
    if (window.location.hash === "#checklists") setTab("checklists");
  }, []);

  function select(next: Tab) {
    setTab(next);
    const url = next === "checklists" ? "/settings#checklists" : "/settings";
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        <TabButton active={tab === "roles"} onClick={() => select("roles")}>
          Funções
        </TabButton>
        <TabButton active={tab === "checklists"} onClick={() => select("checklists")}>
          Lista de verificação
        </TabButton>
      </div>

      {tab === "roles" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O texto aparece em Pessoas. Cada função vê e edita só as áreas marcadas. O administrador mantém acesso total.
          </p>
          <RolesForm roles={roles} />
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Modelos de tarefas. A ordem recebe uma cópia, sem vínculo permanente.
          </p>
          <ChecklistsView checklists={checklists} />
        </section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-8 px-3",
        active && "bg-background text-foreground shadow-sm hover:bg-background",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
