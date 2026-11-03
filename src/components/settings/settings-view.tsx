"use client";

import { useEffect, useState } from "react";
import { CategoriesView } from "@/components/categories/categories-view";
import { ChecklistsView } from "@/components/checklists/checklists-view";
import { RolesForm, type RoleSetting } from "@/components/settings/roles-form";
import { Button } from "@/components/ui/button";
import type { AssetCategory } from "@/lib/categories/queries";
import type { ChecklistRecord } from "@/lib/checklists/queries";
import { cn } from "@/lib/utils";

type Tab = "roles" | "checklists" | "categories";

export function SettingsView({
  roles,
  checklists,
  categories,
}: {
  roles: RoleSetting[];
  checklists: ChecklistRecord[];
  categories: AssetCategory[];
}) {
  const [tab, setTab] = useState<Tab>("roles");

  useEffect(() => {
    if (window.location.hash === "#checklists") setTab("checklists");
    if (window.location.hash === "#categories") setTab("categories");
  }, []);

  function select(next: Tab) {
    setTab(next);
    const hash = next === "roles" ? "" : `#${next}`;
    window.history.replaceState(null, "", `/settings${hash}`);
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
        <TabButton active={tab === "categories"} onClick={() => select("categories")}>
          Categorias de ativos
        </TabButton>
      </div>

      {tab === "roles" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O texto aparece em Pessoas. Cada função vê e edita só as áreas marcadas. O administrador mantém acesso total.
          </p>
          <RolesForm roles={roles} />
        </section>
      ) : null}
      {tab === "checklists" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Modelos de tarefas. A ordem recebe uma cópia, sem vínculo permanente.
          </p>
          <ChecklistsView checklists={checklists} />
        </section>
      ) : null}
      {tab === "categories" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Elétrica, civil, refrigeração e as outras classes do ativo.
          </p>
          <CategoriesView categories={categories} />
        </section>
      ) : null}
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
