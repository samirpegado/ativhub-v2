import type { MenuArea } from "@/lib/auth/areas";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", area: "work_orders", mode: "edit" },
  { href: "/", label: "Ordens de serviço", area: "work_orders", mode: "view" },
  { href: "/preventive", label: "Preventiva", area: "preventive", mode: "view" },
  { href: "/requests", label: "Solicitações", area: "requests", mode: "view" },
  { href: "/customers", label: "Clientes", area: "parties", mode: "view" },
  { href: "/locations", label: "Localizações", area: "locations", mode: "view" },
  { href: "/assets", label: "Ativos", area: "assets", mode: "view" },
  { href: "/inventory", label: "Peças e inventário", area: "inventory", mode: "view" },
  { href: "/vendors", label: "Fornecedores", area: "parties", mode: "view" },
  { href: "/people", label: "Pessoas e equipes", area: "people", mode: "view" },
  { href: "/settings", label: "Configurações", area: "settings", mode: "view" },
] as const;

export type NavArea = MenuArea | "settings";
