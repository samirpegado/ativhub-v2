import { requireTenant } from "@/lib/auth/current-user";

export type LocationOption = {
  id: string;
  name: string;
  custom_id: string | null;
  customer_id?: string | null;
};

export type CustomerChoice = {
  id: string;
  name: string;
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
  customer_id: string | null;
  customer_name: string | null;
};

export async function listCustomerChoices() {
  const { supabase } = await requireTenant();
  const { data, error } = await supabase.from("customer").select("id, name").order("name");
  if (error) throw new Error("Não foi possível carregar os clientes.");
  return (data ?? []) satisfies CustomerChoice[];
}

export async function listLocations() {
  const { supabase } = await requireTenant();
  const [{ data, error }, customers] = await Promise.all([
    supabase
      .from("location")
      .select(
        "id, custom_id, name, postal_code, street, number, complement, neighborhood, city, state, address, customer_id",
      )
      .order("name"),
    listCustomerChoices(),
  ]);

  if (error) {
    throw new Error("Não foi possível carregar as localizações.");
  }

  const names = new Map(customers.map((customer) => [customer.id, customer.name]));
  return (data ?? []).map((location) => ({
    ...location,
    customer_name: location.customer_id ? (names.get(location.customer_id) ?? null) : null,
  })) satisfies LocationRecord[];
}
