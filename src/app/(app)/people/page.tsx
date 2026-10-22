import type { Metadata } from "next";
import { PeopleView } from "@/components/people/people-view";
import { requireArea } from "@/lib/auth/permissions";
import { listPeople, listRoles, listTeams } from "@/lib/people/queries";

export const metadata: Metadata = {
  title: "Pessoas e equipes",
};

export default async function PeoplePage() {
  await requireArea("people", "view", { redirect: true });
  const [{ people, canManage }, teams, roles] = await Promise.all([
    listPeople(),
    listTeams(),
    listRoles(),
  ]);

  return (
    <PeopleView
      people={people}
      teams={teams}
      roles={roles}
      canManage={canManage}
    />
  );
}
