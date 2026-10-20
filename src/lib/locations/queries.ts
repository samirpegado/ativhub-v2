import { requireTenant } from "@/lib/auth/current-user";

export type LocationOption = {
  id: string;
  name: string;
  custom_id: string | null;
};

export type LocationRecord = LocationOption & {
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
};

export async function listLocations() {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase
    .from("location")
    .select(
      "id, custom_id, name, postal_code, street, number, complement, neighborhood, city, state, address",
    )
    .order("name");

  if (error) {
    throw new Error("Não foi possível carregar as localizações.");
  }

  return (data ?? []) satisfies LocationRecord[];
}
