import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="py-8 shadow-sm">
          <CardContent className="px-8">
            <div className="mb-8 flex justify-center">
              <Logo href="/login" />
            </div>
            <div className="mb-6 text-center">
              <h1 className="mb-1 text-[30px] font-bold leading-tight">Criar conta</h1>
              <p className="text-base text-muted-foreground">
                A conta cria a empresa. O acesso libera depois da confirmação do e-mail.
              </p>
            </div>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
