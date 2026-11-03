import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="py-8 shadow-sm">
          <CardContent className="px-8">
            <div className="mb-8 flex justify-center">
              <Logo href="/login" />
            </div>
            <div className="mb-6 text-center">
              <h1 className="mb-1 text-[30px] font-bold leading-tight">Nova senha</h1>
              <p className="text-base text-muted-foreground">
                {token
                  ? "Escolha uma senha nova. O link vale uma única vez."
                  : "Informe o e-mail, o código recebido e a senha nova."}
              </p>
            </div>
            <ResetForm token={token ?? ""} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
