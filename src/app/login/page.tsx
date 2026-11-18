import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { RegisterPrompt } from "./register-prompt";

export const metadata: Metadata = {
  title: {
    absolute: "AtivHub - Sistema de Gestão de Ativos de Manutenção",
  },
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; verified?: string; reset?: string }>;
}) {
  const { email, next, verified, reset } = await searchParams;
  const notice = verified
    ? "E-mail confirmado. Entre com a senha."
    : reset
      ? "Senha atualizada. Entre com a senha nova."
      : null;

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
            {notice ? (
              <Alert className="mb-4">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}
            <LoginForm defaultEmail={email ?? ""} next={next ?? "/"} />
            <RegisterPrompt />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
