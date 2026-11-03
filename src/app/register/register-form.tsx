"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { registerAccount } from "@/app/register/actions";
import type { AuthFormState } from "@/app/login/actions";
import { PhoneInput } from "@/components/forms/phone-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    registerAccount,
    undefined,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nome</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Sobrenome</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" required className="h-11" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <PhoneInput id="phone" name="phone" required className="h-11" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyName">Empresa</Label>
        <Input id="companyName" name="companyName" autoComplete="organization" required className="h-11" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
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

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" required className="mt-1 size-4 accent-primary" />
        <span>Aceito os termos de uso do AtivHub.</span>
      </label>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Criar conta
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="font-bold text-primary hover:underline">
          Já tem uma conta? Entrar
        </Link>
      </p>
    </form>
  );
}
