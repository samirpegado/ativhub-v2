import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  size?: "sm" | "md";
  priority?: boolean;
  src?: string;
  className?: string;
};

export function Logo({
  href = "/",
  size = "md",
  priority = false,
  src = "/ativhub_logo_principal_corrigida.png",
  className,
}: LogoProps) {
  const content = (
    <Image
      src={src}
      alt="AtivHub"
      width={2209}
      height={716}
      priority={priority}
      className={cn("w-auto shrink-0 object-contain", size === "md" ? "h-16" : "h-11")}
    />
  );

  if (!href) {
    return <span className={cn("inline-flex items-center", className)}>{content}</span>;
  }

  return (
    <Link href={href} className={cn("inline-flex items-center", className)}>
      {content}
    </Link>
  );
}
