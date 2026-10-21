import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const BUCKET = "attachments";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function isRemoteUrl(path: string) {
  return path.startsWith("http://") || path.startsWith("https://");
}

export async function signStoragePath(
  supabase: SupabaseClient<Database>,
  path: string | null,
) {
  if (!path) return null;
  const [signed] = await signStoragePaths(supabase, [path]);
  return signed ?? null;
}

export async function signStoragePaths(
  supabase: SupabaseClient<Database>,
  paths: Array<string | null>,
) {
  const signed = paths.map((path) => (path && isRemoteUrl(path) ? path : null));
  const pending: { index: number; path: string }[] = [];

  paths.forEach((path, index) => {
    if (!path || isRemoteUrl(path)) return;
    pending.push({ index, path });
  });

  if (pending.length === 0) return signed;

  const uniquePaths = [...new Set(pending.map((item) => item.path))];
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);
  const byPath = new Map(
    (data ?? []).map((item) => [item.path, item.signedUrl] as const),
  );

  for (const item of pending) {
    signed[item.index] = byPath.get(item.path) ?? null;
  }

  return signed;
}
