"use client";

import Link from "next/link";
import { useNativeShell } from "@/lib/app/use-native-shell";

export function RegisterPrompt() {
  const native = useNativeShell();
  if (native) return null;

  return (
    <p className="mt-8 text-sm">
      <span className="font-bold">Ainda não tem uma conta?</span>{" "}
      <Link href="/register" className="font-bold text-primary hover:underline">
        Inscreva-se aqui
      </Link>
    </p>
  );
}
