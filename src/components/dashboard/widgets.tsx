import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashCard({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section aria-label={label} className={cn("rounded-[14px] border border-[#14233a]/12 bg-white p-5", className)}>
      {children}
    </section>
  );
}

export function DashTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-[#14233a]">{title}</h2>
      {hint ? <p className="mt-0.5 text-[13px] text-[#4a5a70]">{hint}</p> : null}
    </div>
  );
}

export function Kpi({
  label,
  value,
  icon,
  note,
  tone = "neutral",
  valueClassName,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  note: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "crit";
  valueClassName?: string;
}) {
  const noteClass = {
    neutral: "text-[#4a5a70]",
    ok: "bg-[rgba(12,163,12,0.11)] text-[#006300]",
    warn: "bg-[rgba(250,178,25,0.22)] text-[#8a5600]",
    crit: "bg-[rgba(208,59,59,0.11)] text-[#b42323]",
  }[tone];
  return (
    <DashCard className="flex min-w-[220px] flex-1 flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#4a5a70]">{label}</span>
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#e9edf3] text-[#14233a]">{icon}</span>
      </div>
      <div className={cn("text-[44px] leading-none font-semibold tracking-tight text-[#14233a]", valueClassName)}>{value}</div>
      <div className={cn("self-start rounded-full px-2.5 py-1 text-[13px] font-medium", tone === "neutral" ? "" : noteClass)}>
        {note}
      </div>
    </DashCard>
  );
}

export function Donut({
  slices,
  total,
  caption,
  size = 176,
}: {
  slices: { value: number; color: string }[];
  total: number;
  caption: string;
  size?: number;
}) {
  let offset = 0;
  const rings = total
    ? slices.flatMap((slice) => {
        if (slice.value <= 0) return [];
        const portion = (slice.value / total) * 100;
        const ring = (
          <circle
            key={`${slice.color}-${offset}`}
            cx="21"
            cy="21"
            r="15.9155"
            transform="rotate(-90 21 21)"
            fill="none"
            stroke={slice.color}
            strokeWidth="5.5"
            strokeDasharray={`${portion} ${100 - portion}`}
            strokeDashoffset={-offset}
          />
        );
        offset += portion;
        return [ring];
      })
    : [];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={caption}>
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e9edf3" strokeWidth="5.5" />
        {rings}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] leading-none font-semibold">{total}</span>
        <span className="text-xs text-[#4a5a70]">OS no período</span>
      </div>
    </div>
  );
}

export function Meter({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded bg-[#e9edf3]">
      <div className="h-full rounded" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}
