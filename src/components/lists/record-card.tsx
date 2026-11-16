import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const mobileCardClass =
  "border-[#e6e8ec] px-4 pt-4 pb-3.5 transition-shadow hover:border-[#cfd5de] hover:shadow-[0_4px_14px_rgba(30,58,95,0.08)]";

export function CardFact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-[#6b7280] [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <small className="block text-[11px] leading-tight tracking-wider text-[#6b7280] uppercase">{label}</small>
        <span className="block text-[13.5px] leading-snug text-[#1a1f2b]">{children}</span>
      </div>
    </div>
  );
}

export function RecordCardList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 p-3">{children}</div>;
}

export function RecordCard({
  href,
  onOpen,
  label,
  className,
  contentClassName,
  children,
}: {
  href?: string;
  onOpen?: () => void;
  label: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <article className={cn("relative rounded-xl border border-[#14233a]/12 bg-white p-4", className)}>
      {href ? <Link href={href} className="absolute inset-0 z-0 rounded-xl" aria-label={label} /> : null}
      {onOpen ? (
        <button type="button" className="absolute inset-0 z-0 rounded-xl text-left" aria-label={label} onClick={onOpen} />
      ) : null}
      <div className={cn("flex flex-col gap-2", contentClassName)}>{children}</div>
    </article>
  );
}

export function RecordCardLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm leading-snug text-[#4a5a70]">
      <span className="text-muted-foreground">{label}: </span>
      {children}
    </p>
  );
}
