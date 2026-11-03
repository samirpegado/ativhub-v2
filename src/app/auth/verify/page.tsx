import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = {
  title: "Confirmar e-mail",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="py-8 shadow-sm">
          <CardContent className="px-8">
            <div className="mb-8 flex justify-center">
              <Logo href="/login" />
            </div>
            <div className="mb-6 text-center">
              <h1 className="mb-1 text-[30px] font-bold leading-tight">Confirme o e-mail</h1>
              <p className="text-base text-muted-foreground">
                Enviamos um link e um código de 6 dígitos. Os dois valem por 3 horas. Depois, entre com a senha.
              </p>
            </div>
            <VerifyForm email={email ?? ""} error={error} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
