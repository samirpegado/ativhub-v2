export const MENU_AREAS = [
  "work_orders",
  "preventive",
  "requests",
  "assets",
  "locations",
  "inventory",
  "parties",
  "people",
] as const;

export type MenuArea = (typeof MENU_AREAS)[number];

export type AreaAccess = Record<MenuArea, { view: boolean; edit: boolean }>;

export const AREA_LABELS: Record<MenuArea, string> = {
  work_orders: "Ordens de serviço",
  preventive: "Preventiva",
  requests: "Solicitações",
  assets: "Ativos",
  locations: "Localizações",
  inventory: "Peças e inventário",
  parties: "Fornecedores e contratantes",
  people: "Pessoas e equipes",
};

function cell(view: boolean, edit: boolean) {
  return { view: view || edit, edit };
}

function all(view: boolean, edit: boolean): AreaAccess {
  return {
    work_orders: cell(view, edit),
    preventive: cell(view, edit),
    requests: cell(view, edit),
    assets: cell(view, edit),
    locations: cell(view, edit),
    inventory: cell(view, edit),
    parties: cell(view, edit),
    people: cell(view, edit),
  };
}

export function defaultAreas(roleCode: string): AreaAccess {
  if (roleCode === "ADMIN") return all(true, true);
  if (roleCode === "TECHNICIAN") {
    return {
      ...all(true, true),
      parties: cell(true, false),
      people: cell(false, false),
    };
  }
  if (roleCode === "REQUESTER") {
    return {
      ...all(false, false),
      requests: cell(true, false),
      assets: cell(true, false),
      locations: cell(true, false),
    };
  }
  return all(true, false);
}

function readFlag(value: unknown) {
  return value === true;
}

export function areasFromPermissions(
  roleCode: string,
  permissions: unknown,
  isAdmin: boolean,
): AreaAccess {
  if (isAdmin || roleCode === "ADMIN") return all(true, true);
  const fallback = defaultAreas(roleCode);
  const root =
    permissions && typeof permissions === "object" && !Array.isArray(permissions)
      ? (permissions as { areas?: unknown }).areas
      : null;
  if (!root || typeof root !== "object" || Array.isArray(root)) return fallback;

  const stored = root as Record<string, unknown>;
  const next = { ...fallback };
  for (const area of MENU_AREAS) {
    const item = stored[area];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as { view?: unknown; edit?: unknown };
    next[area] = cell(readFlag(record.view), readFlag(record.edit));
  }
  return next;
}

export function can(
  user: { isAdmin: boolean; areas: AreaAccess },
  area: MenuArea,
  mode: "view" | "edit",
) {
  if (user.isAdmin) return true;
  return user.areas[area][mode];
}
