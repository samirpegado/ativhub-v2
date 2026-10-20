import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfile } from "@/lib/profile/queries";

export const metadata: Metadata = {
  title: "Minha conta",
};

export default async function ProfilePage() {
  const profile = await getProfile();
  return <ProfileView profile={profile} />;
}
