import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/(app)/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requirePlatformOperator } from "@/lib/platform-admin/access";
import { PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePlatformOperator();

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={PLATFORM_TENANTS_PATH} prefetch={false} className="inline-flex">
              <Logo href="" size="sm" />
            </Link>
            <span className="text-sm font-medium">Administração da plataforma</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="break-all text-sm text-muted-foreground">{user.email}</span>
            <form action={logout}>
              <Button variant="outline" type="submit">
                <LogOut aria-hidden />
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
