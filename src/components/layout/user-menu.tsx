"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  LockOpen,
  UserRound,
} from "lucide-react";
import { logout } from "@/app/(app)/actions";
import type { AppUser } from "@/lib/auth/current-user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function MenuRow({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof UserRound;
  label: string;
  onSelect?: () => void;
}) {
  return (
    <DropdownMenuItem
      className="rounded-full px-3 py-2.5 text-[15px] font-semibold text-foreground focus:bg-primary/10 focus:text-primary"
      onSelect={onSelect}
    >
      <Icon className="size-5 text-current" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground opacity-70" />
    </DropdownMenuItem>
  );
}

export function UserMenu({ user }: { user: AppUser }) {
  const router = useRouter();
  const firstName = user.firstName || user.displayName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl"
          aria-label="Menu do usuário"
        >
          <Avatar className="size-9 rounded-xl">
            {user.imageUrl ? (
              <AvatarImage src={user.imageUrl} alt={user.displayName} />
            ) : null}
            <AvatarFallback className="rounded-xl bg-primary text-xs font-semibold text-primary-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 overflow-hidden rounded-2xl p-0 shadow-[0px_2px_14px_rgba(34,51,84,0.16)]"
      >
        <div className="flex items-center gap-3 bg-muted px-4 py-3.5">
          <Avatar className="size-10 rounded-lg after:rounded-lg">
            {user.imageUrl ? (
              <AvatarImage src={user.imageUrl} alt={user.displayName} />
            ) : null}
            <AvatarFallback className="rounded-lg bg-muted-foreground/15 text-muted-foreground">
              <UserRound className="size-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{firstName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.roleName}
            </p>
          </div>
        </div>

        <div className="space-y-0.5 px-2 py-2">
          <MenuRow
            icon={UserRound}
            label="Minha conta"
            onSelect={() => router.push("/profile")}
          />
          <MenuRow
            icon={Building2}
            label="Minha empresa"
            onSelect={() => router.push("/company")}
          />
        </div>

        <DropdownMenuSeparator className="mx-0" />
        <div className="p-2">
          <form action={logout}>
            <Button
              type="submit"
              variant="destructive"
              className="h-10 w-full font-semibold"
            >
              <LockOpen className="size-5" />
              Sair
            </Button>
          </form>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
