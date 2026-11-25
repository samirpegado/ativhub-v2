"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function SupportPreviewWindow({ initialSeconds, identity, endForm, children }: {
  initialSeconds: number;
  identity: ReactNode;
  endForm: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const deadline = performance.now() + initialSeconds * 1_000;
    const tick = () => setSeconds((current) => Math.min(current, Math.max(0, Math.ceil((deadline - performance.now()) / 1_000))));
    const interval = window.setInterval(tick, 1_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds === 0) router.refresh();
  }, [router, seconds]);

  const remaining = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">Visualização de suporte · Somente leitura</p>
          {identity}
          <p className="text-sm tabular-nums">{seconds ? `Tempo restante ${remaining}` : "Visualização expirada"}</p>
        </div>
        {endForm}
      </header>
      {seconds > 0 ? children : null}
    </div>
  );
}
