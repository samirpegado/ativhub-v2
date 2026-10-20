import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  size?: "sm" | "md";
  priority?: boolean;
  inverted?: boolean;
  src?: string;
  className?: string;
};

export function Logo({
  href = "/",
  size = "md",
  priority = false,
  inverted = false,
  src = "/logo.png",
  className,
}: LogoProps) {
  const px = size === "md" ? 60 : 40;
  const name = size === "md" ? "text-[28px]" : "text-base";

  const content = (
    <>
      <Image
        src={src}
        alt="AtivHub"
        width={px}
        height={px}
        priority={priority}
        className="shrink-0 object-contain"
      />
      <span
        className={cn(
          "font-bold tracking-wide",
          name,
          inverted && "text-white",
        )}
      >
        AtivHub
      </span>
    </>
  );

  if (!href) {
    return (
      <span className={cn("inline-flex items-center gap-3", className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-3",
        inverted ? "text-white" : "text-foreground",
        className,
      )}
    >
      {content}
    </Link>
  );
}
