# Plano de implementação — Ajustes pontuais

Base: `docs/ajustes-pontuais.md`. Este documento organiza os ajustes em fases,
com decisões de arquitetura, pontos de atenção, mudanças de dados e passo a passo.
Stack: Next.js 16 (App Router, Turbopack), Supabase (RLS por `current_tenant_id()`,
telas via RPC `*_screen` security invoker). App em `src/`.

## Convenções a seguir
- Filtros e paginação de tela via RPC Postgres (padrão `work_orders_screen`).
- CRUD em `FormDialog`; server actions com `requireArea(area, mode)`.
- Migrações em `supabase/migrations`, aplicadas no projeto remoto via MCP `user-ativhub`.
- Status canônicos da OS: `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETE` (não existe `DONE`).
- Nunca commitar sem pedido. Validar no navegador (dev em `localhost:3000`).

## Fatos do código/banco que sustentam o plano
- OS: `work-order-form.tsx`, drawer, actions em `src/app/(app)/work-orders`. Trabalhador
  principal = `work_order.primary_user_id`; responsáveis = `work_order_assignee`.
- Atualizações: tabela `work_order_update` + aba "Atualizações" no drawer (`activity-actions.ts`).
- Tarefas: tabela `task` (`label`, `task_type`, `options`, `value`, `order_index`,
  `membership_id`, `asset_id`) — **sem** `executed_at`/`comment`. Subtarefa usa status
  `OPEN/IN_PROGRESS/ON_HOLD/COMPLETE` em `task.value`. Execução hoje é em lote
  (`saveWorkOrderTaskAnswers`). Preview com inputs desabilitados (`TaskPreview`).
- Cronômetro/mão de obra: tabela `labor` (`duration_seconds`, `started_at`, `logged`, `hourly_rate`).
- Anexos: bucket `attachments` + tabela `file` (`entity_type`, `entity_id`, `url`, `name`).
- Ativos: `assets-view.tsx` com `SearchableTable` (busca client-side, sem filtros server-side).
  Status em `asset.status`; paradas em `asset_downtime` (`asset_id`, `started_at`,
  `duration_seconds`) — **sem** `work_order_id` nem `ended_at`. QR unitário (`AssetQrDialog`).
- Fornecedor: `vendor.rate` numeric nullable (input "Valor/Hora").
- Categoria de ativo: `category.color` (input e coluna "Cor").
- Solicitações: tabela `request`; `approve_request` cria a OS. Sem editar/apagar,
  sem seleção em massa, sem anexo.
- Papéis: `ADMIN`, `TECHNICIAN`, `REQUESTER`, `VIEW_ONLY` editáveis + `LIMITED_TECHNICIAN`
  no banco. Resolução em `requireUser` (`roleCode`, `isAdmin`, `areas`). Nav filtra por `can()`.
  Não há layout dedicado por papel. Home (`/`) é a lista de OS; não há dashboard.
- Notificações: não existem.

---

## Fase 1 — Ajustes rápidos e isolados (baixo risco, só UI)

Implementada. A preventiva continua com trabalhador principal. Colunas `primary_user_id`,
`vendor.rate` e `category.color` permanecem no banco.

### T1.1 OS: remover "Trabalhador principal" e a label "adicionais"
- Decisão: deixar apenas responsáveis (`work_order_assignee`). `primary_user_id` deixa
  de ser editado na UI; manter a coluna no banco (histórico) preenchível por regra futura.
- Passos: remover o `NativeSelect name="primary_user_id"` de `work-order-form.tsx`;
  renomear a seção de responsáveis removendo "adicionais"; no `work-order-drawer.tsx`
  remover o `Detail` "Trabalhador"; em `actions.ts` parar de ler `primary_user_id` em
  `readFields` (ou gravar `null`). Ajustar `payload.ts`/`WorkOrderDrawer` que exibem `primaryUser`.
- Atenção: `work_order_detail` (RPC) ainda retorna `primaryUser`; sem uso na UI não quebra.
  Relatórios/preventiva que semeiam `primary_user_id` continuam válidos.

### T1.2 Fornecedores: remover input "Valor/Hora"
- Decisão: ocultar na UI, manter `vendor.rate` no banco por ora.
- Passos: remover o campo em `vendor-form.tsx`; em `readVendor` (`parties/actions.ts`)
  parar de ler `rate`; remover a coluna "Valor/Hora" da `parties-view.tsx` (seção fornecedores).

### T1.3 Categorias de ativo: ocultar cor
- Decisão: ocultar input e coluna; manter `category.color`.
- Passos: em `category-form.tsx` esconder o input `color` (ao menos para `type=ASSET`);
  remover header "Cor" + `ColorSwatch` em `categories-view.tsx`. `readCategory` pode manter
  um default (ex.: cinza) quando ausente.

### T1.4 Filtro da OS: "Concluído" marcado por padrão
- Decisão (definida): incluir **todas** as `COMPLETE` no default. A lista é paginada,
  então não há problema de volume.
- Passos: ajustar `DEFAULT_WORK_ORDER_STATUSES` em `list-params.ts` para incluir `COMPLETE`.

### T1.5 Foto na OS (reforço)
- Fato: anexos já existem (`registerWorkOrderFile`). Falta facilitar foto no mobile.
- Passos: no upload do drawer, aceitar imagem com `capture="environment"` e destacar
  a ação "Adicionar foto". Sem mudança de dados.

---

## Fase 2 — Execução de tarefas, timeline e regras de conclusão

Implementada. Cada tarefa grava `executed_at` e `comment`. Editar a ordem faz upsert e
preserva a execução, exceto quando o tipo da tarefa muda. A subtarefa é concluída ou
pendente. A aba Atualizações virou Timeline, só com a execução das tarefas. A escrita em
`work_order_update` saiu da interface; a tabela permanece.

### Decisões de arquitetura
- Execução deixa de ser atômica: cada `task` guarda **quando** foi executada e um **comentário**.
  Adicionar `task.executed_at timestamptz null` e `task.comment text null`.
- Remover status de subtarefa: `SUBTASK` vira item concluível (executado/não), sem
  `OPEN/IN_PROGRESS/...`. Remover `SUBTASK_ANSWERS` de `tasks.ts` e o preview correspondente.
- "Atualizações" deixam de existir: substituir a aba por uma **timeline** derivada das
  execuções de tarefa (data/hora + comentário), opcionalmente mesclada com eventos de
  status/cronômetro. Descontinuar a UI de `work_order_update` (manter tabela por histórico).

### Pontos de atenção
- Hoje o form recria todas as `task` a cada edição (`replaceLinks` apaga e reinsere),
  perdendo `executed_at`. Decisão (definida): **preservar `executed_at` via upsert** —
  parar de apagar+reinserir e passar a diferenciar tarefas criadas/mantidas/removidas por
  `id`/`order_index`, mantendo `value`, `comment` e `executed_at` das já executadas.
- A conclusão passa a depender de tarefas finalizadas (ver Fase 3, T3.4).

### Mudanças de dados
- Migração: `alter table task add column executed_at timestamptz, add column comment text`.
- `work_order_detail` (RPC): retornar `executed_at` e `comment` por task; montar `timeline`.

### Tasks
- [ ] Migração `task.executed_at` + `task.comment`.
- [ ] Ação por tarefa `executeWorkOrderTask(taskId, {value, comment})` grava `value`,
      `comment`, `executed_at = now()` (substitui o save em lote).
- [ ] Remover `SUBTASK_ANSWERS`/status de subtarefa em `tasks.ts`, `task-editor.tsx`, preview e drawer.
- [ ] Timeline no drawer a partir de execuções (ordenadas por `executed_at`).
- [ ] Remover aba/escrita de "Atualizações".
- [ ] `TaskPreview` interativo (inputs habilitados, estado local, sem persistir) — item T2.6.

### T2.6 Pré-visualização interativa de tarefas
- Passos: em `TaskPreview`, habilitar os inputs com estado local para o usuário testar o
  comportamento de cada tipo (`TEXT`, `NUMBER`, `INSPECTION`, `MULTIPLE`, `SUBTASK`).

---

## Fase 3 — Papel do técnico, máquina de estados e dashboards

Implementada. O técnico vê e executa só as ordens atribuídas a ele, sem criar ou editar
ordens. A home dele é o painel com cards. O administrador abre o painel completo em
`/dashboard`, separado da lista de ordens. Iniciar o temporizador ou lançar tempo passa a ordem
para em andamento; pausar passa para em espera. Concluir, para quem não edita, exige tempo
registrado e todas as tarefas executadas. O técnico cria solicitação para um ativo; aprovar
e recusar continua só com o administrador.

### Decisões de arquitetura
- **Capacidade de execução** separada de edição. Criar/editar OS exige `work_orders:edit`
  (admin). Técnico **executa** OS atribuídas a ele: cronômetro, mão de obra, tarefas,
  peças, anexos e transições guardadas. Introduzir helper `canExecuteWorkOrder(user, wo)`
  (assignee/primary ou admin) e aplicar nas server actions de execução (`activity-actions.ts`).
- **Restringir TECHNICIAN** em `defaultAreas`: `work_orders` sem `edit` (só executar),
  `requests` pode criar, `assets`/`inventory`/`parties` só `view`. Garantir no servidor,
  não só na UI.
- **Layout dedicado mobile-first** por papel: ramificar em `(app)/layout.tsx`/`app-shell.tsx`
  quando `roleCode === "TECHNICIAN"` (cards no lugar de datatable, navegação enxuta).
- **Máquina de estados de status** no servidor:
  - iniciar cronômetro ou registrar tempo → `IN_PROGRESS`;
  - pausar cronômetro → `ON_HOLD`;
  - botão "Concluir" → `COMPLETE`, **bloqueado** sem tempo registrado e com tarefas pendentes;
  - técnico não altera status livremente (admin continua livre).

### Pontos de atenção
- As actions de execução hoje provavelmente exigem `work_orders:edit`; revisar cada uma
  para aceitar `canExecuteWorkOrder`. Sem isso o técnico fica travado.
- Regras de conclusão dependem da Fase 2 (tarefas com `executed_at`) e de `labor` com duração.
- Dashboards precisam de filtros server-side reutilizáveis (ver T3.6).

### Tasks
- [ ] T3.1 `canExecuteWorkOrder` + aplicar nas actions de timer/labor/task/parts/anexos.
- [ ] T3.2 Ajustar `defaultAreas` do `TECHNICIAN` e proteger rotas/ações no servidor.
- [ ] T3.3 Layout mobile-first do técnico (cards), navegação reduzida.
- [ ] T3.4 Máquina de estados: timer/labor → `IN_PROGRESS`; pausar → `ON_HOLD`;
      concluir exige `labor` com duração > 0 e todas as tarefas com `executed_at`.
- [ ] T3.5 Técnico cria nova solicitação para um ativo (reusar fluxo de `request`).
- [ ] T3.6 RPC/consulta de dashboard com filtros: data, técnico (admin), localização,
      tipo de OS, status, prioridade, situação (em atraso/no prazo).
- [ ] T3.7 Dashboard do técnico (home dele): OS atribuídas, fechadas, a fechar, agenda.
- [ ] T3.8 Dashboard do administrador: visão completa com quem está executando.

### Passo a passo sugerido
1. T3.1 + T3.2 (capacidades e restrições) — fundamento de segurança.
2. T3.4 (máquina de estados) — depende da Fase 2.
3. T3.6 (consulta de dashboard com filtros) — base dos dois painéis.
4. T3.3 + T3.7 (técnico) e T3.8 (admin) — telas.
5. T3.5 (solicitação pelo técnico).

---

## Fase 4 — Solicitações e notificações

Implementada, sem anexo de foto (T4.3 continua fora). Quem edita solicitações altera e
exclui só as pendentes, uma a uma ou em lote. Aprovar abre o formulário da ordem criada
para o administrador completar. O sino ao lado do avatar mostra quantas solicitações
ainda estão pendentes e leva para `/requests?status=pending`.

### T4.1 Editar e apagar solicitação + seleção no datatable
- Decisão: permitir editar/apagar **apenas pendentes** (sem OS vinculada).
- Passos: `updateRequest`/`deleteRequest` em `requests/actions.ts` com guarda
  `work_order_id is null`; adicionar seleção em massa na `requests-view.tsx` (padrão de exclusão em lote).

### T4.2 Aprovar abre o modal da OS criada
- Decisão: após `approve_request` retornar o id da OS, abrir o dialog de edição da OS
  pré-preenchido para o admin completar informações.
- Passos: `approveRequest` já retorna o id; na `requests-view.tsx`, ao aprovar, redirecionar/abrir
  `WorkOrdersView` em modo edição dessa OS (ou um dialog embutido). Reusar `WorkOrderForm`.

### T4.3 Anexar foto em solicitações — FORA DE ESCOPO (definido)
- Decisão: deixar de fora por ora. Upload na página pública (anon) exigiria política de
  storage específica; reavaliar em fase futura.

### T4.4 Notificações de solicitações pendentes
- Decisão: ícone (sino) ao lado do avatar com contador de solicitações pendentes; clique → `/requests?status=pending`.
- Passos: contar pendentes no servidor (RPC/consulta) e renderizar badge no header
  (`app-shell.tsx`). Realtime via Supabase é opcional (fase posterior); começar com contagem no load/revalidate.

---

## Fase 5 — Ativos: filtros, QR em lote e status/downtime

### T5.1 Modal de filtros de ativos (Categoria, Status, Localização)
- Decisão (definida): **migrar para RPC `assets_screen`** (security invoker), seguindo o
  padrão de `work_orders_screen` — busca, paginação e filtros (categoria, status,
  localização) no servidor. O modal de filtros usa esse RPC.
- Passos: criar a RPC `assets_screen` e `list-params.ts` de ativos; trocar a `SearchableTable`
  client-side por lista server-side + `TablePagination`; modal de filtros no padrão da OS.

### T5.2 Impressão de QR em lote
- Decisão: reaproveitar seleção já existente; nova ação "Imprimir QR" gera uma folha com
  grade de etiquetas (código + QR + nome) para imprimir e recortar.
- Passos: extrair a lógica de `printQrLabel`/`AssetQrDialog` para um modo multi-etiqueta
  (grid em CSS print). Ação a partir dos ativos selecionados.

### T5.3 Status do ativo na OS com timestamp + contabilização de parada
- Decisão: na criação/fechamento da OS, permitir informar o status do ativo com data/hora.
  Registrar parada em `asset_downtime` para contabilizar tempo parado.
- Mudanças de dados: `asset_downtime` ganha `work_order_id uuid null` e `ended_at timestamptz null`
  (ou manter `duration_seconds` e calcular no fechamento). Atualizar `asset.status`.
- Atenção: definir regra de abertura/fechamento da parada (abre quando status vira `DOWN`/parada,
  fecha ao retornar a `OPERATIONAL`), para o cálculo de disponibilidade não ficar ambíguo.

### T5.4 Dashboard do ativo no detalhe
- Decisão: ampliar `asset_detail`/`AssetDrawer` com indicadores: tempo total parado,
  disponibilidade, nº de OS, custo de manutenção (já existe `maintenanceCost`), MTTR/MTBF se viável.
- Passos: estender a RPC `asset_detail` com os agregados de `asset_downtime`/`work_order`
  e renderizar cards no drawer.

---

## Fase 6 — Manutenção orgânica x terceiros (já especificada)

Resumo (detalhe em `docs/ajustes-pontuais.md`):
- `customer.is_internal boolean` + índice único parcial (um interno por tenant);
  `customers_screen` retorna a flag.
- Modal no primeiro cliente (`/customers` vazio): interna (semeia cliente com dados do
  tenant + oferta de vincular localizações) ou terceiros. Selo "Minha empresa".
- Trocar de modalidade sem desfazer dados; excluir interno → localizações `customer_id null`
  (aviso de QR fechado).
- **Cabeçalho da OS (T0.5 de `ajustes-pontuais.md`)**: mostrar empresa sempre; bloco
  "Cliente" só quando existe cliente **e** não é interno. Casar com "exibir dados do cliente
  no cabeçalho (da relação com a localização)".

### Tasks
- [ ] Migração `customer.is_internal` + índice + `customers_screen`.
- [ ] Modal de onboarding em `/customers` + ação "vincular localizações".
- [ ] Selo/aviso de exclusão.
- [ ] Cabeçalho da OS com dados do cliente da localização + dedup do interno.

---

## Ordem de execução recomendada
1. **Fase 1** (vitórias rápidas, sem dependência).
2. **Fase 2** (modelo de tarefas/timeline) — fundamento para conclusão de OS.
3. **Fase 3** (técnico, máquina de estados, dashboards) — depende da Fase 2.
4. **Fase 4** (solicitações + notificações).
5. **Fase 5** (ativos: filtros, QR em lote, status/downtime, dashboard do ativo).
6. **Fase 6** (orgânica x terceiros + cabeçalho).

## Decisões definidas
- T1.4: incluir **todas** as concluídas por padrão (lista é paginada).
- T2: preservar `executed_at` via **upsert** ao editar a OS.
- T5.1: **migrar para RPC `assets_screen`** (filtros no servidor).
- T4.3: anexo de foto em solicitações **fora de escopo** por ora.
- Remoção de colunas (`vendor.rate`, `category.color`, `primary_user_id`): **manter no banco**;
  apenas ocultar/parar de usar na UI.
