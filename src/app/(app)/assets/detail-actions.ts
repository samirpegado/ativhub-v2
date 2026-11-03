"use server";

import { loadAssetDetail } from "@/lib/assets/queries";
import type { AssetDetail } from "@/lib/assets/detail";

export async function loadAssetDetailAction(
  assetId: string,
): Promise<{ detail: AssetDetail } | { error: string }> {
  try {
    return { detail: await loadAssetDetail(assetId) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível carregar o ativo.",
    };
  }
}
