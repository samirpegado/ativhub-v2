# Project Structure

## Intent

Describe the real structural organization of the repository and the architectural boundaries.

<!-- BEGIN: AUTO-STRUCTURE -->
## Detected top-level directories
- `.agents/`
- `.ai/`
- `.cursor/`
- `.docs/`
- `.github/`
- `.kiro/`
- `.vscode/`
- `docs/`
- `public/`
- `scripts/`
- `src/`
- `supabase/`

## Detected top-level files
- `.env.example`
- `.env.local`
- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `components.json`
- `eslint.config.mjs`
- `GEMINI.md`
- `next-env.d.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `README.md`
- `tsconfig.json`
- `tsconfig.tsbuildinfo`
<!-- END: AUTO-STRUCTURE -->

## Manual notes

- App Next.js (App Router) vive em `src/`. `frontend-cmms/` é o Atlas CMMS usado
  só como modelo visual/UX — não entra no build, no tsconfig nem no git.
- Schema e RLS no Supabase projeto `ativhub`; SQL versionado em
  `supabase/migrations/`.
- Auth via `@supabase/ssr` (cookies) + `src/proxy.ts` (convenção Next 16).
- Tenant ativo em `auth.jwt().app_metadata.tenant_id`, lido por
  `current_tenant_id()`.
- `/profile` é a conta do usuário: foto, atividade de OT e dados pessoais.
  A foto é reduzida no navegador para no máximo 256×256 em JPEG (qualidade 0,72) antes do Storage.
  Cargo (`job_title`) só muda com papel ADMIN.
- `/people` lista pessoas e equipes. Nova pessoa chama a edge function
  `create-tenant-user`, que cria o usuário no Auth e a membership no tenant.
  Papéis de cadastro: Administrador, Técnico, Solicitante e Somente leitura.
  O texto de cada papel vem de `role.description`.
- `/` lista ordens de serviço e abre o cadastro em modal. A listagem e os
  dados do formulário vêm da função `work_orders_screen(busca, status, prioridade, limit, offset)`,
  com no máximo 20 ordens por página e RLS do tenant. O calendário pede a mesma
  função com todas as ordens, sem esses filtros. O clique na ordem chama
  `work_order_detail()` para o painel. As outras tabelas (localizações, ativos,
  pessoas, equipes e listas de verificação) também paginam 20 itens.
  A aba Calendário
  usa FullCalendar: o evento fica no início estimado, ou no vencimento quando
  não há início. O clique abre o detalhe; um dia vazio abre uma ordem nova
  com esse vencimento. Concluir grava `completed_by`/`completed_on`; a primeira
  saída de `OPEN` (exceto para `ON_HOLD`) grava `first_time_to_react`.
  As tarefas pertencem à ordem. Uma lista nomeada (`checklist`) guarda uma
  cópia reutilizável: ao escolhê-la, as tarefas entram na ordem sem vínculo
  permanente com o modelo. `/checklists` lista e edita esses modelos. O clique
  na ordem abre um painel com status, temporizador, mão de obra (data e
  duração do usuário logado), arquivos, relatório para impressão e a aba
  de atualizações.
- CRUD autenticado em `/locations` e `/assets` (lista + modal de criar/editar).
  Endereço de localização em campos separados; `address` é o texto formatado.
  A imagem do ativo fica em `attachments/{tenant}/assets/` e o caminho em
  `asset.image_url`.
