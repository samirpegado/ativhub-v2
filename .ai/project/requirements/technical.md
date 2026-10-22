# Technical Requirements

## Required capabilities

- App Router server-first (Server Components / Server Actions)
- Isolamento multi-tenant por `tenant_id` + RLS
- Auth e-mail/senha (Supabase Auth)
- Storage privado `attachments` com path `{tenant_id}/...`
- Listas em tabela: filtros, busca e paginação numa RPC do Postgres, com a query devolvendo os dados completos da tela (padrão de `work_orders_screen` / `work_order_detail`)

## Integrations

- Supabase projeto `ativhub` (`https://jmklaujbegsitajnouip.supabase.co`)
- Variáveis em `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- ViaCEP no cadastro de localização (browser, sem chave)

## Environments

- Local: `npm run dev` (Next) + Supabase remoto `ativhub`
- Produção: a definir (Vercel ou Coolify)

## Explicit context decisions

Record decisions that cannot be inferred from repository files in `.ai/project/context-decisions.json`. Keep a value as `undecided` only while the corresponding question remains open.

<!-- BEGIN: AUTO-TECH-BASELINE -->
Baseline técnico inferido automaticamente:

- **Detected variant**: `nextjs-web`
- **Primary runtime**: Node.js
- **Primary language**: TypeScript/JavaScript
- **package.json name**: `ativhub`
- **Key dependencies**: @supabase/ssr, @supabase/supabase-js, class-variance-authority, cn, lucide-react, next, radix-ui, react, react-dom, shadcn, tw-animate-css
- **Key devDependencies**: @tailwindcss/turbopack, @types/node, @types/react, @types/react-dom, eslint, eslint-config-next, tailwindcss, typescript
- **Lockfiles**: package-lock.json

Lacunas restantes:

1. Quais são os objetivos de negócio e como o sucesso será medido?
2. Há metas explícitas de performance, segurança, confiabilidade, acessibilidade ou observabilidade?
<!-- END: AUTO-TECH-BASELINE -->
