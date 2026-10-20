import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Convencao "proxy" do Next 16 (substitui o antigo "middleware").
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas, exceto:
     * - _next/static, _next/image
     * - favicon e arquivos estaticos comuns (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
