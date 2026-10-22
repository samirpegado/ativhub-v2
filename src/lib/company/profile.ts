import { requireAdminPage } from "@/lib/auth/permissions";
import { formatCep } from "@/lib/address/format";
import { signStoragePath } from "@/lib/storage/signed-url";

export type CompanyAddress = {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type CompanyProfile = {
  name: string;
  phone: string;
  website: string;
  address: CompanyAddress;
  hasRequestPin: boolean;
  logoUrl: string | null;
};

const EMPTY_ADDRESS: CompanyAddress = {
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function readCompanySettings(settings: unknown) {
  const root =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const address =
    root.address && typeof root.address === "object" && !Array.isArray(root.address)
      ? (root.address as Record<string, unknown>)
      : {};
  return {
    phone: text(root.phone),
    website: text(root.website),
    hasRequestPin: text(root.requestPin).length > 0,
    address: {
      postalCode: formatCep(text(address.postalCode)),
      street: text(address.street),
      number: text(address.number),
      complement: text(address.complement),
      neighborhood: text(address.neighborhood),
      city: text(address.city),
      state: text(address.state),
    },
  };
}

export async function loadCompanyProfile(): Promise<CompanyProfile> {
  const { supabase, tenantId } = await requireAdminPage();
  const { data, error } = await supabase
    .from("tenant")
    .select("name, logo_url, settings")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data) throw new Error("Não foi possível carregar a empresa.");
  const settings = readCompanySettings(data.settings);
  return {
    name: data.name,
    phone: settings.phone,
    website: settings.website,
    address: settings.address.postalCode ? settings.address : { ...EMPTY_ADDRESS, ...settings.address },
    hasRequestPin: settings.hasRequestPin,
    logoUrl: await signStoragePath(supabase, data.logo_url),
  };
}
