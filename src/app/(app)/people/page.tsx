import type { Metadata } from "next";
import { PeopleView } from "@/components/people/people-view";
import { listPeople, listRoles, listTeams } from "@/lib/people/queries";

export const metadata: Metadata = {
  title: "Pessoas e equipes",
};

export default async function PeoplePage() {
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
