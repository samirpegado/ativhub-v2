"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { resetPassword } from "@/app/auth/actions";
import type { AuthFormState } from "@/app/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    resetPassword,
    undefined,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {token ? null : (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              className="h-11 tracking-widest"
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirmar senha</Label>
        <Input
          id="confirmation"
          name="confirmation"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11"
        />
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Salvar senha
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="font-bold text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
