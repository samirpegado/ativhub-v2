import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-[#f5f7fb]", className)} />;
}
