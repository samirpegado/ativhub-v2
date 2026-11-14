import type { AssetPickerHit } from "@/lib/assets/picker";

export function LockedAsset({ asset }: { asset: AssetPickerHit }) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <input type="hidden" name="asset_id" value={asset.id} />
      <span className="block font-medium">{asset.customId ? `${asset.customId} · ${asset.name}` : asset.name}</span>
      {asset.locationLabel ? <span className="block text-xs text-muted-foreground">{asset.locationLabel}</span> : null}
    </div>
  );
}
