"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type AuthFormState } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="py-8 shadow-sm">
          <CardContent className="px-8">
            <div className="mb-8 flex justify-center">
              <Logo href="/login" />
            </div>
            <div className="mb-6 text-center">
              <h1 className="mb-1 text-[30px] font-bold leading-tight">
                Recuperar senha
              </h1>
              <p className="text-base text-muted-foreground">
                Informe o e-mail da conta para receber o link de redefinição.
              </p>
            </div>

            {state?.error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            {state?.success ? (
              <Alert className="mb-4">
                <AlertDescription>{state.success}</AlertDescription>
              </Alert>
            ) : null}

            <form action={action} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full"
                disabled={pending}
              >
                {pending ? <Loader2 className="animate-spin" /> : null}
                Enviar link
              </Button>
            </form>

            <p className="mt-8 text-sm">
              <Link href="/login" className="font-bold text-primary hover:underline">
                Voltar ao login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
