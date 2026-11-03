import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lookupPublicAsset } from "@/app/s/actions";
import { PublicAssetView } from "@/components/requests/public-asset-view";

export const metadata: Metadata = {
  title: "Equipamento",
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
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <PublicAssetView asset={result.asset} />
    </main>
  );
}
