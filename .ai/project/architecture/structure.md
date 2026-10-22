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
  chamada no servidor com a sessão do usuário, com no máximo 20 ordens por página e RLS do tenant.
  O calendário pede a mesma função com todas as ordens, sem esses filtros. O clique na ordem chama
  `work_order_detail()` no servidor para o painel. Toda lista em tabela deve seguir esse padrão:
  filtros, busca e paginação na RPC, com a query devolvendo os dados completos da tela.
  Localizações, ativos, pessoas, equipes e listas de verificação ainda paginam 20 itens no navegador.
  A aba Calendário
  usa FullCalendar: o evento fica no início estimado, ou no vencimento quando
  não há início. O clique abre o detalhe; um dia vazio abre uma ordem nova
  com esse vencimento. Concluir grava `completed_by`/`completed_on`; a primeira
  saída de `OPEN` (exceto para `ON_HOLD`) grava `first_time_to_react`.
  As tarefas pertencem à ordem. Uma lista nomeada (`checklist`) guarda uma
  cópia reutilizável: ao escolhê-la, as tarefas entram na ordem sem vínculo
  permanente com o modelo. Os modelos ficam em Configurações; `/checklists`
  redireciona para lá. A ordem pode ser sem cobrança, por hora ou valor fixo.
  O clique
  na ordem abre um painel com status, temporizador, mão de obra (data e
  duração do usuário logado), peças usadas, arquivos, relatório para impressão e a aba
  de atualizações. A peça lançada vem do inventário: o estoque baixa, exceto quando
  a peça não controla estoque, e remover a linha devolve a quantidade.
- `/preventive` lista os agendamentos. `preventive_screen` recebe busca, prioridade,
  limit e offset, no máximo 20, e devolve o payload da tela. O clique chama
  `preventive_detail`. Cada agendamento define a recorrência (dia, semana, mês
  ou ano, pela data marcada ou pela conclusão da ordem anterior) e os dados da
  ordem que será criada. `generate_due_preventive_work_orders` cria a ordem
  quando a data chega. Ela roda de hora em hora e também ao abrir as ordens ou
  a preventiva. Cinco ordens seguidas sem reação pausam o agendamento.
- `/inventory` lista peças e conjuntos. `parts_screen` e `part_sets_screen`
  recebem busca, filtro de estoque (peças), limit e offset, no máximo 20, e
  devolvem o payload da tela. O clique chama `part_detail` ou `part_set_detail`.
  A quantidade é a fonte da verdade; um ajuste grava `stock_movement`. O consumo
  numa ordem grava `WO_CONSUME` e a remoção grava `WO_RETURN`. Peça sem
  controle (`non_stock`) não entra no alerta de estoque baixo nem muda a quantidade
  ao ser usada. Conjunto agrupa
  peças e o custo é a soma dos custos unitários.
- `/parties` lista fornecedores e contratantes. `/requests` lista solicitações.
  `/settings` (só administrador) edita os quatro papéis e as listas de verificação,
  cada um na sua aba. `/checklists` redireciona para a aba de listas. Minha empresa fica em `/company`, aberta pelo
  menu do perfil, não pela barra lateral. O QR do ativo abre `/s/{id}` sem login.
- CRUD autenticado em `/locations` e `/assets` (lista + modal de criar/editar).
  Endereço de localização em campos separados; `address` é o texto formatado.
  A imagem do ativo fica em `attachments/{tenant}/assets/` e o caminho em
  `asset.image_url`.
