import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { subscriptionIsOpen } from "@/lib/billing/access";
import { isPlatformPath, PLATFORM_TENANTS_PATH } from "@/lib/platform-admin/paths";
import type { Database } from "./database.types";

/**
 * Atualiza/renova a sessão do Supabase a cada request e aplica o guard
 * básico de autenticação. Chamado pelo proxy raiz (src/proxy.ts, Next 16).
 *
 * Rotas públicas: /login, /register, /invite/*, /auth/*, /s e a folha
 * /work-orders/<id>/print. /s e a folha permanecem acessíveis com sessão.
 * Conta sem e-mail confirmado só permanece em login, cadastro, confirmação e /s.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: nao inserir logica entre createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const emailVerified = Boolean(user?.email_confirmed_at);
  const platformRoute = isPlatformPath(pathname);
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth") ||
    pathname === "/s" ||
    pathname.startsWith("/s/") ||
    isWorkOrderPrintPath(pathname);
  const isVerificationRoute =
    pathname.startsWith("/auth/verify") ||
    pathname.startsWith("/auth/activate") ||
    pathname.startsWith("/auth/reset") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const isAssetQrRoute = pathname === "/s" || pathname.startsWith("/s/");

  if (user && !emailVerified) {
    if (isVerificationRoute || isAssetQrRoute || isWorkOrderPrintPath(pathname)) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/auth/verify";
    url.search = user.email ? `?email=${encodeURIComponent(user.email)}` : "";
    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute) {
    if (
      pathname.startsWith("/auth/reset") ||
      pathname.startsWith("/auth/activate") ||
      isAssetQrRoute ||
      isWorkOrderPrintPath(pathname)
    ) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (platformRoute) url.search = "";
    url.searchParams.set("next", platformRoute ? pathname + request.nextUrl.search : pathname);
    return NextResponse.redirect(url);
  }

  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (user && emailVerified && !tenantId && pathname === "/") {
    const { data: platformAdmin } = await supabase.rpc("platform_admin_status");
    if (platformAdmin === true) {
      const url = request.nextUrl.clone();
      url.pathname = PLATFORM_TENANTS_PATH;
      url.search = "";
      const response = NextResponse.redirect(url);
      for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
      return response;
    }
  }
  const billingRoute =
    pathname.startsWith("/subscription") || pathname.startsWith("/profile");
  if (user && emailVerified && tenantId && !isPublicRoute && !billingRoute && !platformRoute) {
    const { data, error } = await supabase
      .from("subscription")
      .select("status, trial_ends_at, current_period_end, plan_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!error && !subscriptionIsOpen(data)) {
      const url = request.nextUrl.clone();
      url.pathname = "/subscription";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

function isWorkOrderPrintPath(pathname: string) {
  return /^\/work-orders\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/print$/i.test(pathname);
}
