"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { confirmEmailCode, resendVerification } from "@/app/auth/actions";
import type { AuthFormState } from "@/app/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VerifyForm({ email, error }: { email: string; error?: string }) {
  const [confirmState, confirmAction, confirmPending] = useActionState<AuthFormState, FormData>(
    confirmEmailCode,
    undefined,
  );
  const [resendState, resendAction, resendPending] = useActionState<AuthFormState, FormData>(
    resendVerification,
    undefined,
  );

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>O link é inválido ou já expirou. Digite o código ou peça outro.</AlertDescription>
        </Alert>
      ) : null}
      {confirmState?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{confirmState.error}</AlertDescription>
        </Alert>
      ) : null}
      {resendState?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{resendState.error}</AlertDescription>
        </Alert>
      ) : null}
      {resendState?.success ? (
        <Alert>
          <AlertDescription>{resendState.success}</AlertDescription>
        </Alert>
      ) : null}

      <form action={confirmAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={6}
            pattern="\d{6}"
            className="h-11 tracking-widest"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={confirmPending}>
          {confirmPending ? <Loader2 className="animate-spin" /> : null}
          Confirmar e-mail
        </Button>
        <Button
          type="submit"
          variant="ghost"
          className="w-full"
          formAction={resendAction}
          disabled={resendPending}
        >
          {resendPending ? <Loader2 className="animate-spin" /> : null}
          Reenviar código
        </Button>
      </form>

      <p className="text-center text-sm">
        <Link href="/login" className="font-bold text-primary hover:underline">
          Ir para o login
        </Link>
      </p>
    </div>
  );
}
