import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: {
    absolute: "AtivHub - Sistema de Gestão de Ativos de Manutenção",
  },
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="py-8 shadow-sm">
          <CardContent className="px-8">
            <div className="mb-8 flex justify-center">
              <Logo href="/login" priority />
            </div>
            <div className="mb-6 text-center">
              <h1 className="mb-1 text-[30px] font-bold leading-tight">
                Entrar
              </h1>
              <p className="text-base text-muted-foreground">
                Preencha os campos abaixo para entrar em sua conta.
              </p>
            </div>
            <LoginForm defaultEmail={email ?? ""} next={next ?? "/"} />
            <p className="mt-8 text-sm">
              <span className="font-bold">Ainda não tem uma conta?</span>{" "}
              <Link href="/register" className="font-bold text-primary hover:underline">
                Inscreva-se aqui
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
