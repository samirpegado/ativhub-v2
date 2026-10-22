export type VendorRecord = {
  id: string;
  companyName: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  vendorType: string | null;
  description: string | null;
  rate: number | null;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  customerType: string | null;
  description: string | null;
};

export type PartyScreen<T> = {
  items: T[];
  total: number;
  totalAll: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function countOf(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? count : 0;
}

function money(value: unknown) {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function readVendorsScreen(data: unknown): PartyScreen<VendorRecord> {
  const screen = asRecord(data);
  const items = Array.isArray(screen?.items) ? screen.items : [];
  return {
    total: countOf(screen?.total),
    totalAll: countOf(screen?.totalAll),
    items: items.flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const companyName = text(row?.companyName);
      const name = text(row?.name);
      if (!row || !id || !companyName || !name) return [];
      return [
        {
          id,
          companyName,
          name,
          phone: text(row.phone),
          email: text(row.email),
          website: text(row.website),
          vendorType: text(row.vendorType),
          description: text(row.description),
          rate: money(row.rate),
        },
      ];
    }),
  };
}

export function readCustomersScreen(data: unknown): PartyScreen<CustomerRecord> {
  const screen = asRecord(data);
  const items = Array.isArray(screen?.items) ? screen.items : [];
  return {
    total: countOf(screen?.total),
    totalAll: countOf(screen?.totalAll),
    items: items.flatMap((item) => {
      const row = asRecord(item);
      const id = text(row?.id);
      const name = text(row?.name);
      if (!row || !id || !name) return [];
      return [
        {
          id,
          name,
          phone: text(row.phone),
          email: text(row.email),
          website: text(row.website),
          customerType: text(row.customerType),
          description: text(row.description),
        },
      ];
    }),
  };
}
