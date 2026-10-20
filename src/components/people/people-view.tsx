"use client";

import { useCallback, useState } from "react";
import { FormDialog } from "@/components/forms/form-dialog";
import { SearchableTable } from "@/components/lists/searchable-table";
import { PersonForm } from "@/components/people/person-form";
import { TeamForm } from "@/components/people/team-form";
import { Button } from "@/components/ui/button";
import { deletePerson, deleteTeam } from "@/app/(app)/people/actions";
import { formatPhone } from "@/lib/phone/br";
import type {
  PersonRecord,
  RoleOption,
  TeamRecord,
} from "@/lib/people/queries";
import { cn } from "@/lib/utils";

type Tab = "people" | "teams";

export function PeopleView({
  people,
  teams,
  roles,
  canManage,
}: {
  people: PersonRecord[];
  teams: TeamRecord[];
  roles: RoleOption[];
  canManage: boolean;
}) {
  const [tab, setTab] = useState<Tab>("people");
  const [editingPerson, setEditingPerson] = useState<PersonRecord | null | "new">(
    null,
  );
  const [editingTeam, setEditingTeam] = useState<TeamRecord | null | "new">(null);
  const closePerson = useCallback(() => setEditingPerson(null), []);
  const closeTeam = useCallback(() => setEditingTeam(null), []);

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        <TabButton active={tab === "people"} onClick={() => setTab("people")}>
          Pessoas
        </TabButton>
        <TabButton active={tab === "teams"} onClick={() => setTab("teams")}>
          Equipes
        </TabButton>
      </div>

      {tab === "people" ? (
        <SearchableTable
          createLabel="Pessoa"
          emptyTitle="Pessoas são quem opera a manutenção nesta empresa"
          emptyHint="Pressione o botão '+' para cadastrar uma pessoa"
          headers={["Nome", "E-mail", "Telefone", "Papel"]}
          deleteAction={deletePerson}
          deleteNoun="a pessoa"
          manage={canManage}
          onCreate={() => setEditingPerson("new")}
          onEdit={(id) => {
            setEditingPerson(people.find((person) => person.id === id) ?? null);
          }}
          rows={people.map((person) => {
            const name = [person.firstName, person.lastName]
              .filter(Boolean)
              .join(" ");
            return {
              id: person.id,
              name,
              searchText: [name, person.email, person.phone, person.roleName]
                .filter(Boolean)
                .join(" ")
                .toLowerCase(),
              cells: [
                name,
                person.email || "—",
                formatPhone(person.phone) || "—",
                person.roleName,
              ],
            };
          })}
        />
      ) : (
        <SearchableTable
          createLabel="Equipe"
          emptyTitle="Equipes agrupam pessoas para atribuir o trabalho"
          emptyHint="Pressione o botão '+' para criar uma equipe"
          headers={["Nome", "Descrição", "Pessoas"]}
          deleteAction={deleteTeam}
          deleteNoun="a equipe"
          manage={canManage}
          onCreate={() => setEditingTeam("new")}
          onEdit={(id) => {
            setEditingTeam(teams.find((team) => team.id === id) ?? null);
          }}
          rows={teams.map((team) => {
            const members = people
              .filter((person) => team.memberIds.includes(person.id))
              .map((person) =>
                [person.firstName, person.lastName].filter(Boolean).join(" "),
              )
              .join(", ");
            return {
              id: team.id,
              name: team.name,
              searchText: [team.name, team.description, members]
                .filter(Boolean)
                .join(" ")
                .toLowerCase(),
              cells: [team.name, team.description || "—", members || "—"],
            };
          })}
        />
      )}

      <FormDialog
        open={editingPerson !== null}
        onOpenChange={(open) => {
          if (!open) closePerson();
        }}
        title={editingPerson && editingPerson !== "new" ? "Editar pessoa" : "Nova pessoa"}
        description="O papel define o que a pessoa pode fazer nesta empresa."
      >
        {editingPerson ? (
          <PersonForm
            key={editingPerson === "new" ? "new" : editingPerson.id}
            person={editingPerson === "new" ? undefined : editingPerson}
            roles={roles}
            onCancel={closePerson}
            onSuccess={closePerson}
          />
        ) : null}
      </FormDialog>

      <FormDialog
        open={editingTeam !== null}
        onOpenChange={(open) => {
          if (!open) closeTeam();
        }}
        title={editingTeam && editingTeam !== "new" ? "Editar equipe" : "Nova equipe"}
        description="Escolha as pessoas que fazem parte da equipe."
      >
        {editingTeam ? (
          <TeamForm
            key={editingTeam === "new" ? "new" : editingTeam.id}
            team={editingTeam === "new" ? undefined : editingTeam}
            people={people}
            onCancel={closeTeam}
            onSuccess={closeTeam}
          />
        ) : null}
      </FormDialog>
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
