import { redirect } from "next/navigation";
import { callAccountAccess } from "@/lib/auth/account-access";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await callAccountAccess({
    action: "confirm-email",
    token,
  });

  if (!result.ok) redirect("/auth/verify?error=invalid");
  redirect("/login?verified=1");
}
