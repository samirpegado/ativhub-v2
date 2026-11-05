"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { techRange, type TechRange } from "@/lib/dashboard/overview";

export function PeriodSelect({ range }: { range: TechRange }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const current = techRange(range);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(next: TechRange) {
    setOpen(false);
    if (next === range) return;
    router.replace(next === "30" ? "/" : `/?range=${next}`, { scroll: false });
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#14233a]/12 bg-white px-3.5 text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        {current.label}
        <ChevronDown className="size-4 text-[#4a5a70]" />
      </button>
      {open ? (
        <div role="listbox" aria-label="Período do painel" className="absolute right-0 z-20 mt-1 min-w-48 rounded-[10px] border border-[#14233a]/12 bg-white p-1 shadow-md">
          {(["week", "15", "30"] as const).map((id) => {
            const item = techRange(id);
            const selected = id === range;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full rounded-lg px-3 py-2 text-left text-sm ${selected ? "bg-[#e9edf3] font-semibold" : "hover:bg-[#e9edf3]/70"}`}
                onClick={() => choose(id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
