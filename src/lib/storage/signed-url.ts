import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const BUCKET = "attachments";

export async function signStoragePath(
  supabase: SupabaseClient<Database>,
  path: string | null,
) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);

  return data?.signedUrl ?? null;
}
