import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lookupPublicAsset } from "@/app/s/actions";
import { PublicRequestForm } from "@/components/requests/public-request-form";

export const metadata: Metadata = {
  title: "Solicitar manutenção",
};

export default async function PublicAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const result = await lookupPublicAsset({ assetId });
  if ("error" in result) notFound();

  return (
    <main className="flex min-h-full items-center px-4 py-10">
      <PublicRequestForm asset={result.asset} />
    </main>
  );
}
