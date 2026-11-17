"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Handshake,
  Inbox,
  MapPin,
  Menu,
  Package,
  Settings,
  Timer,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AssetQrScanButton } from "@/components/assets/asset-qr-scan-dialog";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { navItems } from "@/components/layout/nav";
import { isMobile, isNativeShell } from "@/lib/app/is-mobile";
import { can } from "@/lib/auth/areas";
import type { AppUser } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const barLabels: Record<(typeof navItems)[number]["href"], string> = {
  "/": "Início",
  "/work-orders": "Ordens",
  "/preventive": "Preventiva",
  "/requests": "Solicitações",
  "/assets": "Ativos",
  "/locations": "Locais",
  "/inventory": "Peças",
  "/customers": "Clientes",
  "/vendors": "Fornecedores",
  "/people": "Pessoas",
  "/settings": "Ajustes",
};

const technicianBarHrefs = new Set<string>(["/", "/work-orders", "/requests", "/assets", "/inventory"]);

const icons: Record<(typeof navItems)[number]["href"], LucideIcon> = {
  "/": LayoutDashboard,
  "/work-orders": ClipboardList,
  "/preventive": Timer,
  "/requests": Inbox,
  "/assets": Package,
  "/locations": MapPin,
  "/inventory": Wrench,
  "/customers": Building2,
  "/vendors": Handshake,
  "/people": Users,
  "/settings": Settings,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/profile")) return "Minha conta";
  if (pathname.startsWith("/company")) return "Minha empresa";
  if (pathname.startsWith("/subscription")) return "Assinatura";
  const match = navItems.find((item) => isActivePath(pathname, item.href));
  return match?.label ?? "AtivHub";
}

function visibleNav(user: AppUser) {
  return navItems.filter((item) => {
    if (item.area === "settings") return user.isAdmin;
    return can(user, item.area, item.mode);
  });
}

function SidebarNav({
  user,
  onNavigate,
}: {
  user: AppUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto py-2">
      {visibleNav(user).map((item) => {
        const Icon = icons[item.href];
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex w-full items-center gap-3 px-6 py-3 text-left text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-5 opacity-80" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarChrome({
  user,
  onNavigate,
  onClose,
  priorityLogo,
}: {
  user: AppUser;
  onNavigate?: () => void;
  onClose?: () => void;
  priorityLogo?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("relative flex justify-center pt-6 pb-4", onClose ? "px-12" : "px-4")}>
        <Logo
          size="sm"
          href="/"
          priority={priorityLogo}
          src="/ativhub_logo_escuro_corrigida.png"
        />
        {onClose ? (
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-3 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground"
              onClick={onClose}
              aria-label="Fechar menu"
            >
              <X />
            </Button>
          </SheetClose>
        ) : null}
      </div>
      <div className="mx-4 h-px bg-white/10" />
      <SidebarNav user={user} onNavigate={onNavigate} />
    </div>
  );
}

function BottomBar({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const items = visibleNav(user).filter((item) => technicianBarHrefs.has(item.href));

  return (
    <nav
      aria-label="Navegação"
      className="z-20 grid shrink-0 border-t border-[#14233a]/10 bg-card pb-[env(safe-area-inset-bottom)]"
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const Icon = icons[item.href];
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 px-0.5 py-2 text-[10px] leading-tight font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">{barLabels[item.href]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  pendingRequestCount = null,
  children,
}: {
  user: AppUser;
  pendingRequestCount?: number | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = pageTitle(pathname);
  const [open, setOpen] = useState(false);
  const [native, setNative] = useState(isMobile);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setNative(isNativeShell());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.overflow;
    const previousBody = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousRoot;
      body.style.overflow = previousBody;
    };
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={cn("fixed inset-0 flex flex-col overflow-hidden bg-background", !native && "lg:pl-[290px]")}>
      {native ? null : (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[290px] bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
          <SidebarChrome user={user} priorityLogo />
        </aside>
      )}

      {native ? null : (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[290px] gap-0 border-white/10 bg-sidebar p-0 text-sidebar-foreground sm:max-w-[290px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <SidebarChrome
            user={user}
            onNavigate={() => setOpen(false)}
            onClose={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
      <header className="z-20 flex h-20 shrink-0 items-center justify-between gap-2 bg-card/95 px-4 shadow-[0px_2px_8px_-3px_rgba(34,51,84,0.2),0px_5px_22px_-4px_rgba(34,51,84,0.1)] backdrop-blur-[3px]">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("shrink-0 text-primary lg:hidden", native && "hidden")}
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X /> : <Menu />}
          </Button>
          <h1 className="truncate text-xl font-bold sm:text-[30px] sm:leading-none">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {can(user, "assets", "view") ? <AssetQrScanButton /> : null}
          {pendingRequestCount !== null ? (
            <Button variant="ghost" size="icon" className="relative size-10" asChild>
              <Link
                href="/requests?status=pending"
                aria-label={
                  pendingRequestCount > 0
                    ? `${pendingRequestCount} solicitações não lidas`
                    : "Solicitações não lidas"
                }
              >
                <Bell />
                {pendingRequestCount > 0 ? (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                    {pendingRequestCount > 99 ? "99+" : pendingRequestCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          ) : null}
          <UserMenu user={user} />
        </div>
      </header>

      <main ref={mainRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="px-4 py-4 sm:px-8">{children}</div>
      </main>
      {native ? <BottomBar user={user} /> : null}
      </div>
    </div>
  );
}
