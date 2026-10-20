export const navItems = [
  { href: "/", label: "Ordens de serviço", enabled: true },
  { href: "/preventive", label: "Preventiva", enabled: false },
  { href: "/requests", label: "Solicitações", enabled: false },
  { href: "/assets", label: "Ativos", enabled: true },
  { href: "/locations", label: "Localizações", enabled: true },
  { href: "/inventory", label: "Peças e inventário", enabled: false },
  { href: "/people", label: "Pessoas e equipes", enabled: true },
  { href: "/categories", label: "Categorias", enabled: false },
  { href: "/settings", label: "Configurações", enabled: false },
] as const;
