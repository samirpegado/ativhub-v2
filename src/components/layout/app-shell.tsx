"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Inbox,
  MapPin,
  Menu,
  Package,
  Power,
  Settings,
  Tags,
  Timer,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout } from "@/app/(app)/actions";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { navItems } from "@/components/layout/nav";
import type { AppUser } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const icons: Record<(typeof navItems)[number]["href"], LucideIcon> = {
  "/": ClipboardList,
  "/preventive": Timer,
  "/requests": Inbox,
  "/assets": Package,
  "/locations": MapPin,
  "/inventory": Wrench,
  "/people": Users,
  "/categories": Tags,
  "/settings": Settings,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/profile")) return "Minha conta";
  if (pathname.startsWith("/company")) return "Minha empresa";
  const match = navItems.find((item) => isActivePath(pathname, item.href));
  return match?.label ?? "AtivHub";
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto py-2">
      {navItems.map((item) => {
        const Icon = icons[item.href];
        const active = item.enabled && isActivePath(pathname, item.href);
        const className = cn(
          "flex w-full items-center gap-3 px-6 py-3 text-left text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          !item.enabled &&
            "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-sidebar-foreground",
        );

        if (!item.enabled) {
          return (
            <span key={item.href} className={className} title="Em breve">
              <Icon className="size-5 opacity-50" />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={className}
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
  onNavigate,
  priorityLogo,
}: {
  onNavigate?: () => void;
  priorityLogo?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-center px-4 pt-6 pb-4">
        <Logo
          size="sm"
          inverted
          href="/"
          priority={priorityLogo}
          src="/logo-white-full.png"
          className="gap-1 [&_img]:-mr-[0%]"
        />
      </div>
      <div className="mx-4 h-px bg-white/10" />
      <SidebarNav onNavigate={onNavigate} />
      <div className="h-px bg-white/10" />
      <div className="flex h-[61px] items-center justify-center gap-2">
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            aria-label="Sair"
          >
            <Power className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = pageTitle(pathname);
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[290px] bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <SidebarChrome priorityLogo />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[290px] gap-0 border-white/10 bg-sidebar p-0 text-sidebar-foreground sm:max-w-[290px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <SidebarChrome onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <header className="fixed top-0 right-0 left-0 z-20 flex h-20 min-w-0 items-center justify-between bg-card/95 px-4 shadow-[0px_2px_8px_-3px_rgba(34,51,84,0.2),0px_5px_22px_-4px_rgba(34,51,84,0.1)] backdrop-blur-[3px] lg:left-[290px]">
        <h1 className="truncate text-xl font-bold sm:text-[30px] sm:leading-none">
          {title}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <UserMenu user={user} />
          <Button
            variant="ghost"
            size="icon"
            className="text-primary lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </header>

      <main className="min-h-full pt-20 lg:pl-[290px]">
        <div className="px-4 py-4 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
