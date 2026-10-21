# Current Stack

## Declared stack

Document the real stack currently used by the repository.

<!-- BEGIN: AUTO-STACK -->
- **Detected variant**: `nextjs-web`
- **Primary runtime**: Node.js
- **Primary language**: TypeScript/JavaScript
- **package.json name**: `ativhub`
- **Key dependencies**: @supabase/ssr, @supabase/supabase-js, class-variance-authority, cn, lucide-react, next, radix-ui, react, react-dom, shadcn, tw-animate-css
- **Key devDependencies**: @tailwindcss/turbopack, @types/node, @types/react, @types/react-dom, eslint, eslint-config-next, tailwindcss, typescript
- **Lockfiles**: package-lock.json
<!-- END: AUTO-STACK -->

## Decisions and notes

- Next.js 16 App Router + Turbopack, React 19, Tailwind 4, shadcn/ui (radix-nova).
- Supabase (Postgres + Auth + Storage + RLS), cliente `@supabase/ssr`.
- Pacote `cn` é o class-name merger oficial do shadcn v4 (`clsx` + `tailwind-merge`).
- `qrcode` gera o QR do ativo no browser; o conteúdo atual é o `id`.
- O calendário de ordens usa FullCalendar 7 (`@fullcalendar/react`, com
  daygrid, timegrid, list, interaction e o tema classic) e `temporal-polyfill`.
  O locale é `pt-br`.
- Sem Flutter neste repositório.
- Deploy no Coolify pelo `Dockerfile` (`output: "standalone"`). O build na VM
  usa `nice -n 19`, uma thread de compilação e heap de 1 GB. As `NEXT_PUBLIC_*`
  precisam estar disponíveis no build.
- `cacheComponents` permanece desligado. A sessão do Supabase e as consultas
  da mesma request passam por `cache()` do React, para não repetir `getUser`.
