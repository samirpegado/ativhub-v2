import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="py-8 shadow-sm">
          <CardContent className="space-y-4 px-8">
            <div className="mb-4 flex justify-center">
              <Logo href="/login" />
            </div>
            <h1 className="text-center text-[30px] font-bold leading-tight">
              Criar empresa
            </h1>
            <p className="text-center text-muted-foreground">
              O cadastro cria o usuário, o tenant e o papel ADMIN. Este fluxo
              entra na sequência da Fase 0.
            </p>
            <p className="pt-2 text-center text-sm">
              <Link href="/login" className="font-bold text-primary hover:underline">
                Já tem uma conta? Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
