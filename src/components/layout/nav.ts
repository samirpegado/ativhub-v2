import type { MenuArea } from "@/lib/auth/areas";

export const navItems = [
  { href: "/", label: "Ordens de serviço", area: "work_orders" },
  { href: "/preventive", label: "Preventiva", area: "preventive" },
  { href: "/requests", label: "Solicitações", area: "requests" },
  { href: "/assets", label: "Ativos", area: "assets" },
  { href: "/locations", label: "Localizações", area: "locations" },
  { href: "/inventory", label: "Peças e inventário", area: "inventory" },
  { href: "/parties", label: "Fornecedores e contratantes", area: "parties" },
  { href: "/people", label: "Pessoas e equipes", area: "people" },
  { href: "/settings", label: "Configurações", area: "settings" },
] as const;

export type NavArea = MenuArea | "settings";
