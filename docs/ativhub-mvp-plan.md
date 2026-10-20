# AtivHub — Plano de reconstrução (Next.js + Supabase + shadcn/ui)

> Documento de referência para recriar o CMMS do zero como um SaaS multi-tenant
> enxuto, usando o projeto Atlas CMMS (`c:\Users\samir\apps\cmms`) apenas como
> **referência funcional e visual**. Nada do código Java/React original é
> reaproveitado. Stack alvo: **Next.js (App Router)**, **Supabase** (Postgres +
> Auth + Storage + RLS), **shadcn/ui** + **Tailwind**.

---

## 1. Visão e escopo do MVP

O produto é um sistema de gestão de manutenção (CMMS). O MVP cobre o fluxo
operacional básico de uma equipe de manutenção, sem os módulos pesados do
sistema original (workflows, webhooks, portais, cobrança Paddle, licença Keygen,
agendador Quartz, analytics avançada).

### Módulos do MVP

| Módulo | Entra no MVP | Observação |
|--------|--------------|------------|
| Ordens de serviço (OT) | Sim | Núcleo |
| Manutenção preventiva (PM) | Sim | Gera OT por recorrência |
| Solicitações (requests) | Sim | Vira OT ao aprovar |
| Ativos | Sim | Com hierarquia pai/filho |
| Localizações | Sim | Com hierarquia pai/filho |
| Peças e inventário | Sim | Estoque simples |
| Pessoas e equipes | Sim | Com papéis/permissões |
| Categorias | Sim | OT, ativo, peça, etc. |
| Fornecedores/clientes | Opcional | Pode ficar na v1.1 |
| Medidores (meters) | Opcional | Pode ficar na v1.1 |
| Configurações | Sim | Empresa, campos da OT |
| Perfil de usuário | Sim | |
| Perfil da empresa | Sim | |
| Analytics / dashboards | Parcial | KPIs simples; relatórios depois |
| Pedidos de compra (PO) | Não (v2) | |
| Workflows / automações | Não (v2) | |
| Portal de solicitação público | Não (v2) | |
| Assinatura/cobrança | Não (v2) | |

### Princípios

1. **Um banco, multi-tenant por `tenant_id`.** Toda tabela de negócio tem
   `tenant_id` e é isolada por RLS. Sem schema por cliente, sem banco por cliente.
2. **Sem trava de licença.** Nenhuma funcionalidade é bloqueada por plano no MVP.
3. **Reaproveitar só a aparência e as regras.** O layout visual (logo AtivHub,
   menu lateral, paleta) e as regras de negócio descritas aqui.
4. **Server-first.** Server Components e Server Actions do Next para ler/gravar
   no Supabase; cliente só onde há interação.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────┐
│ Next.js (App Router) — Vercel ou Coolify     │
│  - Server Components (leitura)                │
│  - Server Actions / Route Handlers (escrita) │
│  - shadcn/ui + Tailwind                       │
└───────────────┬─────────────────────────────┘
                │ @supabase/ssr (cookies)
┌───────────────▼─────────────────────────────┐
│ Supabase                                     │
│  - Postgres + RLS (isolamento por tenant_id) │
│  - Auth (e-mail/senha, convites)             │
│  - Storage (imagens, anexos)                 │
│  - Edge Functions (recorrência de PM, cron)  │
└─────────────────────────────────────────────┘
```

### Decisões-chave

- **Autenticação:** Supabase Auth. O `auth.users.id` (uuid) é a identidade. Uma
  tabela `membership` liga o usuário ao tenant e ao papel.
- **Isolamento:** o `tenant_id` do usuário é resolvido por uma função SQL
  `current_tenant_id()` usada em todas as policies RLS. Ver seção 5.
- **Recorrência de PM:** substitui o Quartz. Um cron do Supabase (pg_cron) roda
  uma Edge Function/rotina SQL diária que gera as OTs pendentes. Ver seção 6.3.
- **Arquivos:** Supabase Storage, bucket por ambiente, caminho
  `{tenant_id}/{entidade}/{id}/{arquivo}`. Metadados na tabela `file`.
- **IDs amigáveis:** `custom_id` por entidade (`WO-000123`, `PM-000045`,
  `A-000012`, `L-000003`, `R-000078`) gerado por sequência por tenant.

---

## 3. Design tokens (extraídos do tema atual)

O tema original é MUI "PureLightTheme". Abaixo os valores reais, prontos para
virar variáveis CSS do shadcn (`globals.css`) e config do Tailwind.

### 3.1 Cores de marca (semânticas)

| Token | Hex | Uso |
|-------|-----|-----|
| primary | `#5569ff` | Ação principal, links, ativo do menu |
| primary-alt | `#000C57` | Primário escuro |
| secondary | `#6E759F` | Texto secundário, ícones |
| success | `#57CA22` | Status concluído, estoque ok |
| warning | `#FFA319` | Prioridade média, alertas |
| error | `#FF1943` | Prioridade alta, falha, atraso |
| info | `#33C2FF` | Informativo, prioridade baixa |
| black (texto) | `#223354` | Texto primário |
| white | `#ffffff` | Superfícies |
| body-bg | `#f2f5f9` | Fundo da aplicação |

> O logo foi redefinido para AtivHub; `theme-color` do app é `#1975ff` (próximo
> ao primary). Pode-se padronizar em `#5569ff` ou `#1975ff` — escolher um.

### 3.2 Texto por opacidade (sobre `#223354`)

| Token | Opacidade | Uso |
|-------|-----------|-----|
| text-primary | 100% | Títulos e corpo |
| text-secondary | 70% | Descrições |
| text-disabled | 50% | Placeholder, desabilitado |

### 3.3 Tipografia

- **Fonte:** `Inter` (fallback system-ui). No Next, usar `next/font/google` Inter.
- **Pesos:** 700 para títulos (h1–h5), 600 para botões, 400 corpo.

| Elemento | Tamanho | Peso |
|----------|---------|------|
| h1 | 35 px | 700 |
| h2 | 30 px | 700 |
| h3 | 25 px | 700 |
| h4 | 16 px | 700 |
| h5 | 14 px | 700 |
| h6 | 15 px | 400 |
| body1/body2 | 14 px | 400 |
| button | — | 600 |
| caption | 13 px | uppercase |

### 3.4 Raio de borda

| Token | Valor |
|-------|-------|
| sm | 6 px |
| base | 10 px |
| lg | 12 px |
| xl | 16 px |

> shadcn usa `--radius`. Mapear `--radius: 0.625rem` (10 px) como base.

### 3.5 Layout

| Token | Valor |
|-------|-------|
| sidebar width | 290 px |
| header height | 80 px |
| sidebar bg | `#ffffff` |
| sidebar item ativo (texto) | `#5569ff` |
| sidebar item ativo (fundo) | `#f2f5f9` |
| sidebar item (texto) | `#242E6F` |
| spacing base | 9 px (MUI `spacing`); no Tailwind usar escala padrão 4 px |

### 3.6 Exemplo de `globals.css` (shadcn)

```css
:root {
  --background: 210 33% 96%;        /* #f2f5f9 */
  --foreground: 218 44% 17%;        /* #223354 */
  --card: 0 0% 100%;
  --primary: 231 100% 67%;          /* #5569ff */
  --primary-foreground: 0 0% 100%;
  --secondary: 229 22% 53%;         /* #6E759F */
  --destructive: 350 100% 54%;      /* #FF1943 */
  --success: 97 69% 46%;            /* #57CA22 */
  --warning: 36 100% 55%;           /* #FFA319 */
  --info: 199 100% 60%;             /* #33C2FF */
  --radius: 0.625rem;               /* 10px */
}
```

> Converter os hex para HSL ao colar (shadcn usa HSL). Os valores acima já estão
> aproximados.

---

## 4. Responsividade (o que replicar e o que corrigir)

O app original é desktop-first (feito para operação interna). Pontos a observar:

### 4.1 Layout e breakpoints

- **Sidebar:** largura fixa 290 px. Em telas `lg+` (≥ ~1280 px) é permanente; abaixo
  disso vira drawer temporário aberto por botão de menu no header.
- **shadcn equivalente:** usar o componente `Sidebar` do shadcn (com
  `SidebarProvider`), que já trata colapso mobile via `Sheet`.
- **Header:** 80 px, com busca e menu de usuário; ações extras escondidas em `xs`.

### 4.2 Tabelas (o ponto fraco do original)

As listas usam data grid de largura fixa (80–300 px por coluna) e **não são
realmente responsivas** em mobile. No rewrite:

- Desktop: tabela (`@tanstack/react-table` + shadcn `Table`).
- Mobile: alternar para **lista de cards** (um card por registro com os 3–4
  campos principais) em vez de rolagem horizontal.
- Persistir colunas visíveis/ordenação por usuário (localStorage ou tabela
  `user_settings`).

### 4.3 Casos específicos a corrigir

- **Calendário de OT:** no original tem altura fixa de 660 px e o `useMediaQuery`
  está declarado mas não aplicado. Usar um calendário responsivo (ex.:
  `react-big-calendar` ou FullCalendar com `height="auto"`), e em mobile cair
  para uma lista por dia.
- **Formulários longos (ex.: PO, ativo):** no original alguns viram página
  inteira. Regra para o rewrite: **formulário > ~12 campos ou com seções → rota
  dedicada** (`/assets/new`); CRUD rápido → `Dialog`.

---

## 5. Modelo de dados (Supabase)

Schema enxuto. Nomes em inglês para alinhar com shadcn/libs; comentários em
português. Toda tabela de negócio tem `tenant_id uuid not null`, `id uuid
default gen_random_uuid()`, `created_at`, `updated_at`, `created_by`, `updated_by`.

### 5.1 Tenancy e pessoas

```sql
-- Empresa / organização (tenant)
create table tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  settings jsonb not null default '{}',   -- preferências, timezone, moeda
  created_at timestamptz not null default now()
);

-- Papel (perfil de permissões), por tenant
create table role (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  code text not null default 'USER_CREATED',  -- ADMIN, TECHNICIAN, VIEW_ONLY, REQUESTER...
  permissions jsonb not null default '{}',     -- ver seção 7
  is_default boolean not null default false
);

-- Vínculo usuário ↔ tenant ↔ papel (um usuário pode estar em vários tenants)
create table membership (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references role(id),
  first_name text not null,
  last_name text not null,
  job_title text,
  phone text,
  rate numeric,                 -- custo/hora
  image_url text,
  is_owner boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Equipe
create table team (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  description text
);

create table team_member (
  team_id uuid not null references team(id) on delete cascade,
  membership_id uuid not null references membership(id) on delete cascade,
  primary key (team_id, membership_id)
);
```

### 5.2 Função de tenant e RLS (padrão aplicado a todas as tabelas)

```sql
-- Resolve o tenant do usuário logado. Com multi-tenant por usuário,
-- guarde o tenant ativo em app_metadata ou em uma claim/cookie.
create or replace function current_tenant_id() returns uuid
language sql stable as $$
  select (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;

-- Exemplo de policy (repetir o padrão por tabela):
alter table work_order enable row level security;

create policy tenant_isolation_select on work_order
  for select using (tenant_id = current_tenant_id());
create policy tenant_isolation_write on work_order
  for all using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
```

> Alternativa: resolver `tenant_id` por subquery em `membership` via `auth.uid()`.
> JWT claim é mais performático e evita recursão de RLS. Definir o `tenant_id` no
> `app_metadata` do usuário ao entrar/ativar um tenant.

### 5.3 Catálogo e localização

```sql
create table category (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  type text not null,            -- 'work_order','asset','part','meter','cost','time','purchase_order'
  name text not null,
  description text,
  color text
);

create table location (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  custom_id text,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  parent_id uuid references location(id) on delete cascade,  -- hierarquia
  image_url text
);
```

### 5.4 Ativos

```sql
create table asset (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  custom_id text,
  name text not null,
  description text,
  parent_id uuid references asset(id) on delete cascade,     -- hierarquia
  location_id uuid references location(id),
  category_id uuid references category(id),
  primary_user_id uuid references membership(id),
  status text not null default 'OPERATIONAL',                -- ver enum seção 6.1
  model text, manufacturer text, serial_number text,
  bar_code text, power text, area text,
  acquisition_cost numeric,
  in_service_date date,
  warranty_expiration_date date,
  additional_infos text,
  image_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Downtime (parada) do ativo
create table asset_downtime (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  asset_id uuid not null references asset(id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_seconds bigint not null default 0   -- 0 = ainda parado
);

-- Associações N:N do ativo (times, responsáveis) — tabelas de junção
create table asset_team (asset_id uuid, team_id uuid, primary key(asset_id,team_id));
create table asset_assignee (asset_id uuid, membership_id uuid, primary key(asset_id,membership_id));
```

### 5.5 Peças e inventário

```sql
create table part (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  description text,
  category_id uuid references category(id),
  cost numeric not null default 0,           -- preço unitário
  quantity numeric not null default 0,       -- estoque atual (fonte da verdade)
  min_quantity numeric not null default 0,   -- alerta de estoque baixo
  non_stock boolean not null default false,  -- se true, consumo não baixa estoque
  unit text, bar_code text, area text,
  image_url text,
  constraint quantity_non_negative check (quantity >= 0),
  constraint min_quantity_non_negative check (min_quantity >= 0)
);

-- Movimento de estoque (entrada/saída) — histórico auditável
create table stock_movement (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  part_id uuid not null references part(id) on delete cascade,
  work_order_id uuid references work_order(id) on delete set null,
  quantity numeric not null,                 -- negativo = consumo, positivo = entrada
  reason text,                               -- 'WO_CONSUME','PO_RECEIVE','ADJUSTMENT'
  created_at timestamptz not null default now(),
  created_by uuid
);
```

> **Correção importante vs. original:** no Atlas, remover uma peça da OT **não
> devolvia** o estoque. Aqui, cada mudança de peça na OT gera um `stock_movement`,
> e `part.quantity` é recalculado (ou mantido por trigger). Isso fecha o bug.

### 5.6 Ordens de serviço, preventiva e solicitações

```sql
create table work_order (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  custom_id text,
  title text not null,
  description text,
  status text not null default 'OPEN',       -- OPEN, IN_PROGRESS, ON_HOLD, COMPLETE
  priority text not null default 'NONE',     -- NONE, LOW, MEDIUM, HIGH
  due_date timestamptz,
  estimated_start_date timestamptz,
  estimated_duration numeric,                -- horas
  required_signature boolean not null default false,
  signature_url text,
  feedback text,
  category_id uuid references category(id),
  location_id uuid references location(id),
  asset_id uuid references asset(id),
  team_id uuid references team(id),
  primary_user_id uuid references membership(id),
  completed_by uuid references membership(id),
  completed_on timestamptz,
  first_time_to_react timestamptz,           -- SLA: primeira reação
  parent_request_id uuid references request(id),
  parent_pm_id uuid references preventive_maintenance(id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work_order_assignee (
  work_order_id uuid references work_order(id) on delete cascade,
  membership_id uuid references membership(id) on delete cascade,
  primary key (work_order_id, membership_id)
);

-- Tarefas/checklist da OT
create table task (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  work_order_id uuid references work_order(id) on delete cascade,
  label text not null,
  task_type text not null default 'SUBTASK', -- SUBTASK, INSPECTION, NUMBER, TEXT...
  value text,                                -- resposta
  order_index int not null default 0
);

-- Mão de obra / tempo gasto
create table labor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  work_order_id uuid references work_order(id) on delete cascade,
  membership_id uuid references membership(id),
  duration_seconds bigint not null default 0,
  hourly_rate numeric,
  logged boolean not null default false,     -- timer rodando
  started_at timestamptz
);

-- Peças usadas na OT (linha de consumo)
create table work_order_part (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  work_order_id uuid references work_order(id) on delete cascade,
  part_id uuid not null references part(id),
  quantity numeric not null default 1 check (quantity >= 0)
);

-- Manutenção preventiva (modelo que gera OTs)
create table preventive_maintenance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  custom_id text,
  name text not null,
  -- os mesmos campos-base da OT que serão copiados para cada OT gerada:
  title text not null,
  description text,
  priority text not null default 'NONE',
  category_id uuid references category(id),
  location_id uuid references location(id),
  asset_id uuid references asset(id),
  team_id uuid references team(id),
  primary_user_id uuid references membership(id),
  estimated_duration numeric,
  -- agenda:
  frequency int not null default 1 check (frequency >= 1),
  recurrence_type text not null default 'DAILY',          -- DAILY, WEEKLY, MONTHLY, YEARLY
  recurrence_based_on text not null default 'SCHEDULED_DATE', -- SCHEDULED_DATE, COMPLETED_DATE
  days_of_week int[],                                     -- 0=segunda ... 6=domingo (só WEEKLY)
  starts_on timestamptz not null default now(),
  ends_on timestamptz,
  due_date_delay int,                                     -- dias até o vencimento da OT gerada
  disabled boolean not null default false,
  next_run_at timestamptz,                                -- usado pelo cron
  created_at timestamptz not null default now()
);

create table pm_task_template (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  pm_id uuid references preventive_maintenance(id) on delete cascade,
  label text not null,
  task_type text not null default 'SUBTASK',
  order_index int not null default 0
);

-- Solicitação (vira OT ao aprovar)
create table request (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  custom_id text,
  title text not null,
  description text,
  priority text not null default 'NONE',
  category_id uuid references category(id),
  location_id uuid references location(id),
  asset_id uuid references asset(id),
  primary_user_id uuid references membership(id),
  work_order_id uuid references work_order(id),   -- preenchido na aprovação
  cancelled boolean not null default false,
  cancellation_reason text,
  created_at timestamptz not null default now()
);
```

### 5.7 Fornecedores, clientes e arquivos

```sql
create table vendor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  company_name text not null,
  name text not null,                 -- contato
  phone text, email text, website text,
  vendor_type text, description text, rate numeric
);

create table customer (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  phone text, email text, website text,
  customer_type text, description text
);

create table file (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  url text not null,                  -- caminho no Storage
  entity_type text,                   -- 'work_order','asset','part'...
  entity_id uuid,
  created_at timestamptz not null default now()
);
```

---

## 6. Regras de negócio (o que recriar)

### 6.1 Enums

| Enum | Valores | Default |
|------|---------|---------|
| Status da OT | `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETE` | `OPEN` |
| Prioridade | `NONE`, `LOW`, `MEDIUM`, `HIGH` | `NONE` |
| Status do ativo | `OPERATIONAL`, `MODERNIZATION`, `STANDBY`, `INSPECTION_SCHEDULED`, `COMMISSIONING`, `DOWN`, `EMERGENCY_SHUTDOWN` | `OPERATIONAL` |
| Ativo "parado de fato" | `DOWN` e `EMERGENCY_SHUTDOWN` contam como downtime | — |
| Recorrência (tipo) | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` | `DAILY` |
| Recorrência (base) | `SCHEDULED_DATE`, `COMPLETED_DATE` | `SCHEDULED_DATE` |
| Papel (code) | `ADMIN`, `LIMITED_ADMIN`, `TECHNICIAN`, `LIMITED_TECHNICIAN`, `VIEW_ONLY`, `REQUESTER`, `USER_CREATED` | — |

### 6.2 Ciclo de vida da OT

Não há máquina de estados rígida no original — qualquer transição é permitida.
Regras ao mudar status (replicar):

1. **Primeira reação:** ao sair de `OPEN` pela primeira vez (para qualquer status
   exceto `ON_HOLD`), gravar `first_time_to_react = now()`. Serve de SLA.
2. **Concluir (`COMPLETE`):** gravar `completed_by` e `completed_on`. Parar
   qualquer `labor` com `logged = true`.
3. **Sair de `COMPLETE`:** limpar `completed_by` e `completed_on`.
4. **Conclusão condicionada (config da empresa):** se a empresa marcar
   `completeFiles`/`completeTasks`/`completeTime`/`completeParts`/`completeCost`
   como obrigatórios, bloquear a conclusão até a condição ser satisfeita.
5. **Assinatura/feedback:** se `required_signature` ou
   `askFeedbackOnWOClosed`, abrir modal de conclusão exigindo assinatura/feedback.
6. **Compliance:** OT é "em conformidade" se `due_date` nulo ou
   `completed_on < due_date`.
7. **Urgente:** `due_date <= agora + 2 dias` e status ≠ `COMPLETE`.
8. **Ao concluir OT de PM baseada em `COMPLETED_DATE`:** agendar a próxima OT a
   partir de `completed_on` (ver 6.3).
9. **Ao concluir OT de ativo:** se a OT alterou status do ativo, aplicar.

> Observação: no original há um bug onde concluir direto a partir de
> `IN_PROGRESS` podia não gravar `completed_on`. No rewrite, **sempre** gravar
> `completed_on`/`completed_by` ao entrar em `COMPLETE`, independente do status
> anterior.

### 6.3 Preventiva → geração de OT (substituindo o Quartz)

O original usa Quartz. No Supabase, usar **pg_cron** + função SQL (ou Edge
Function) que roda, por exemplo, de hora em hora:

- Seleciona PMs com `disabled = false`, `ends_on` nulo ou futuro, e
  `next_run_at <= now()`.
- Para cada uma, cria uma OT copiando os campos-base (title, description,
  priority, asset, location, primary_user, team, category, estimated_duration) e
  as tarefas de `pm_task_template`, com `parent_pm_id` apontando para a PM.
- `due_date` da OT = `now() + due_date_delay` dias (se houver).
- Calcula o próximo `next_run_at`:
  - `SCHEDULED_DATE`: `DAILY` = +frequency dias; `WEEKLY` = próximo dia marcado em
    `days_of_week`; `MONTHLY`/`YEARLY` = +frequency meses/anos a partir de
    `starts_on`.
  - `COMPLETED_DATE`: não agenda por calendário; o próximo `next_run_at` é
    definido quando a **OT anterior é concluída** (`completed_on + frequency`).
- **Auto-desativação:** se a PM acumular ≥ 5 OTs e **nenhuma** teve reação
  (`first_time_to_react` nulo), marcar `disabled = true` (evita empilhar OTs
  ignoradas). Replicar essa proteção.
- `WEEKLY` exige `days_of_week` não vazio.

> Campos **não** copiados da PM para a OT no original: `due_date` (usa delay),
> `estimated_start_date`, `required_signature`, `customers`. Manter esse
> comportamento.

### 6.4 Solicitação → OT (aprovação)

- Quem aprova: papel com permissão de `SETTINGS` ou `LIMITED_ADMIN`.
- Aprovar: cria a OT a partir da request (mesma cópia de campos-base),
  seta `request.work_order_id`, notifica o solicitante. Se `autoAssignRequests`,
  o `primary_user` da OT vira o criador da request (se a request não tinha um).
- Rejeitar: exige motivo; `cancelled = true`, `cancellation_reason`.
- Request já aprovada (`work_order_id` não nulo) não pode ser editada nem
  reaprovada.
- Status lógico da request (derivado, não é coluna):
  `CANCELLED` se `cancelled`; `APPROVED` se `work_order_id` não nulo; senão
  `PENDING`.

### 6.5 Ativos — hierarquia e downtime

- **Hierarquia:** `parent_id`. Raízes = `parent_id is null`. Ao deletar pai,
  cascata nos filhos (FK `on delete cascade`). Impedir que um ativo seja pai de
  si mesmo. (No MVP, hierarquia é liberada para todos — sem licença.)
- **Downtime automático:** ao mudar o status de um ativo UP → DOWN, abrir
  `asset_downtime` (duração 0) e **propagar para os pais** que ainda não estão
  "parados de fato". Ao voltar DOWN → UP, fechar o downtime aberto e **propagar
  para os filhos**.
- `custom_id` = `A-` + sequência.
- Barcode/NFC únicos por tenant (se usados).

### 6.6 Localizações — hierarquia

- `parent_id`, raízes `null`, cascata no delete, parent ≠ self. Sem restrição de
  licença (igual ao original).
- `custom_id` = `L-` + sequência.

### 6.7 Estoque

- `part.quantity` é a fonte da verdade; `min_quantity` dispara alerta de estoque
  baixo (notificar responsáveis da peça).
- Consumo na OT: cria `work_order_part` e um `stock_movement` negativo;
  `part.quantity` diminui. Se `non_stock`, não mexe no estoque.
- Entrada (quando houver PO na v2, ou ajuste manual no MVP): `stock_movement`
  positivo.
- **Nunca** deixar `quantity` negativo (check constraint).
- Remoção de peça da OT gera `stock_movement` de estorno (corrige o bug do
  original).

### 6.8 IDs amigáveis (`custom_id`)

Sequência por tenant e por entidade. Opção simples: tabela `counter(tenant_id,
entity, value)` incrementada por função SQL dentro da transação de criação,
formatando com zero-padding (`WO-000123`).

---

## 7. Papéis e permissões

Modelo do original: cada papel tem 5 conjuntos de permissões sobre "entidades".
No rewrite, guardar como `jsonb` em `role.permissions`:

```json
{
  "create":      ["WORK_ORDERS","ASSETS","PARTS","REQUESTS","..."],
  "view":        ["WORK_ORDERS","ANALYTICS","SETTINGS","..."],
  "viewOther":   ["WORK_ORDERS","ASSETS","..."],
  "editOther":   ["WORK_ORDERS","ASSETS","..."],
  "deleteOther": ["WORK_ORDERS","..."]
}
```

### Entidades de permissão

`PEOPLE_AND_TEAMS`, `CATEGORIES`, `WORK_ORDERS`, `PREVENTIVE_MAINTENANCES`,
`ASSETS`, `PARTS`, `METERS`, `VENDORS_AND_CUSTOMERS`, `FILES`, `LOCATIONS`,
`SETTINGS`, `REQUESTS`, `ANALYTICS`.

### Papéis default a criar por tenant

| Papel | Resumo |
|-------|--------|
| `ADMIN` | Tudo. É o dono ao criar a empresa. |
| `LIMITED_ADMIN` | Admin sem configurações sensíveis; aprova requests. |
| `TECHNICIAN` | Cria/edita OT, ativos, peças; vê o que lhe cabe. |
| `LIMITED_TECHNICIAN` | Só o que lhe é atribuído. |
| `VIEW_ONLY` | Apenas leitura. |
| `REQUESTER` | Só cria solicitações. |

### Regra de edição "própria vs. de outros"

Em OT/ativo/local/medidor, editar é permitido se o papel tem `editOther` **ou**
o usuário é o criador/responsável/atribuído. Replicar no `can()` do app e
reforçar nas policies RLS mais sensíveis.

> As permissões finas (além do RLS de tenant) ficam na camada da aplicação
> (Server Actions checam `can(user, 'create', 'WORK_ORDERS')`). O RLS garante o
> isolamento duro por tenant; a granularidade por papel é validada no servidor.

---

## 8. Formulários e modais (catálogo)

O original tem um componente `Form` genérico dirigido por um array de campos. No
rewrite, usar **React Hook Form + Zod + shadcn Form**. Tipos de campo a suportar
(equivalentes aos do original): `text`, `number`, `textarea` (multiline),
`select` (com busca/async), `select multiple`, `checkbox`, `switch`, `date`
(datetime), `dateRange`, `file`/`upload`, `coordinates` (mapa), `partQuantity`
(linha peça+quantidade), `signature`, `titleGroup` (separador de seção).

Layout: grid de 12 colunas; campo normal ocupa 12, campo "midWidth" ocupa 6 em
`lg+`. Modal `md` para CRUD; página dedicada para formulários longos/seccionados.

### 8.1 Campos por entidade (required marca o mínimo)

**Ordem de serviço** (modal; só `title` é obrigatório de base, o resto é
configurável por empresa):

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| title | text | sim |
| description | textarea | não |
| image | file (imagem) | não |
| dueDate | datetime | não |
| estimatedStartDate | datetime | não |
| estimatedDuration | number (h) | não |
| priority | select | não |
| category | select | não |
| primaryUser | select (pessoa) | não |
| assignedTo | select múltiplo (pessoa) | não |
| team | select | não |
| location | select | não |
| asset | select (filtra por location) | não |
| assetStatus | select (só ao criar) | não |
| tasks | checklist | não |
| files | file múltiplo | não |
| requiredSignature | switch | não |

> A empresa pode marcar cada um desses como `REQUIRED` ou `HIDDEN`
> (configuração de campos da OT). Guardar em `tenant.settings.workOrderFields`.

**Manutenção preventiva** (modal): os campos-base da OT (com `dueDateDelay` no
lugar de `dueDate`, e `asset` recomendado) **mais**:

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| name | text | sim |
| recurrenceBasedOn | select | sim |
| recurrenceType | select | sim |
| frequency | number (> 0) | sim |
| startsOn | date | sim |
| endsOn | date | não |
| daysOfWeek | select múltiplo | se `WEEKLY` + `SCHEDULED_DATE` |
| tasks | checklist | não |

Campos condicionais: `daysOfWeek` só aparece com `recurrenceType = WEEKLY` e
`recurrenceBasedOn = SCHEDULED_DATE`.

**Solicitação** (modal): subconjunto da OT, sem `assignedTo` e sem
`requiredSignature`; campos visíveis conforme config de request. Só `title`
obrigatório.

**Ativo** (modal ou página): `name` obrigatório; `location` obrigatório na UI
(embora o backend não exija). Demais: description, category, parentAsset, status,
primaryUser, assignedTo, teams, model, manufacturer, serialNumber, barCode,
power, area, acquisitionCost, inServiceDate, warrantyExpirationDate, image,
files, additionalInfos, parts, vendors, customers.

**Localização** (modal): `name` e `address` obrigatórios; parentLocation,
coordenadas (se houver chave de mapa), workers, teams, image, files.

**Peça** (modal): `name` obrigatório; cost, quantity, minQuantity, nonStock,
category, unit, barcode, area, image, description, assignees, teams.

**Equipe** (modal): `name` obrigatório; description, users.

**Fornecedor** (modal): `companyName` e `name` obrigatórios; phone, email,
website, vendorType, rate, description.

**Cliente** (modal): `name` e `phone` obrigatórios; email, website,
customerType, description, dados de faturamento.

**Categoria** (modal): `name` obrigatório (máx. 30), description.

**Medidor** (v1.1): `name`, `unit`, `updateFrequency`, `asset` obrigatórios;
category, location, image, users.

**Convite de usuário:** e-mails (até 20) + papel; ou cadastro direto com
first/last name, e-mail, telefone, senha (mín. 8), papel.

---

## 9. Telas e navegação

Rotas sugeridas (App Router), todas sob um layout autenticado com sidebar:

```
/login                      Supabase Auth (e-mail/senha)
/register                   Cria tenant + usuário dono (ADMIN)
/invite/[token]             Aceita convite para um tenant

/(app)
  /dashboard                KPIs simples (OT abertas, atrasadas, por status)
  /work-orders              Lista (tabela/cards) + filtros + criar
  /work-orders/[id]         Detalhe: tarefas, peças, tempo, arquivos, status
  /work-orders/calendar     Calendário responsivo
  /preventive               Lista de PMs + criar
  /preventive/[id]          Detalhe + agenda + OTs geradas
  /requests                 Lista + criar + aprovar/rejeitar
  /requests/[id]            Detalhe
  /assets                   Lista + hierarquia + criar
  /assets/[id]              Detalhe: filhos, downtime, peças, OTs
  /locations                Lista + hierarquia (+ mapa opcional)
  /inventory                Peças + conjuntos (sets)
  /inventory/[id]           Detalhe da peça + movimentos
  /people                   Pessoas + equipes
  /categories               Abas por tipo
  /vendors                  Fornecedores/clientes (v1.1)
  /settings                 Geral, campos da OT, papéis
  /settings/roles
  /profile                  Perfil do usuário
  /company                  Perfil da empresa (tenant)
```

Padrões de UX a herdar do original:
- Sidebar com grupos e item ativo destacado em `primary`.
- Listagens com busca + filtros + colunas persistentes; drawer/painel de detalhe.
- Criação por `SplitButton` (criar + importar CSV) nas telas que terão importação.

---

## 10. Autenticação, cadastro e multi-tenant

1. **Cadastro novo (dono):** `/register` cria o usuário no Supabase Auth, cria um
   `tenant`, cria os papéis default, cria a `membership` com `is_owner = true` e
   papel `ADMIN`, e grava `tenant_id` no `app_metadata` do usuário.
2. **Convite:** o admin convida por e-mail. Gera um registro de convite com papel
   e token; ao aceitar, cria a `membership` no tenant. (Supabase `inviteUserByEmail`
   ou fluxo próprio com link assinado.)
3. **Tenant ativo:** se um usuário pertence a vários tenants, guardar o tenant
   ativo em `app_metadata.tenant_id` e permitir troca (atualiza o claim / re-login
   leve). `current_tenant_id()` lê esse claim.
4. **E-mail único global** (como no original) — o Auth do Supabase já garante.

---

## 11. Armazenamento de arquivos

- Bucket Supabase Storage (ex.: `attachments`), privado.
- Caminho: `{tenant_id}/{entity_type}/{entity_id}/{uuid}-{filename}`.
- Policies de Storage espelham o tenant (só lê/escreve objetos cujo primeiro
  segmento do path = `current_tenant_id()`).
- Upload pelo cliente com URL assinada; registrar metadados em `file`.
- **Sem trava de licença** para anexar (era o ponto de dor do original).

---

## 12. Roadmap de implementação

### Fase 0 — Fundação
- Projeto Next + Tailwind + shadcn; tokens da seção 3; layout (sidebar/header);
  Inter via `next/font`.
- Supabase: tabelas núcleo (tenant, role, membership, team), `current_tenant_id()`,
  RLS padrão, seed de papéis default.
- Auth: login, register (cria tenant + dono), middleware de sessão.

### Fase 1 — Cadastros base
- Localizações (com hierarquia), ativos (hierarquia + status + downtime),
  categorias, peças/inventário, pessoas/equipes.
- Upload de arquivos.

### Fase 2 — Operação
- Ordens de serviço (CRUD, detalhe, tarefas, peças, tempo, conclusão com as
  regras da seção 6.2).
- Solicitações (criar, aprovar → OT, rejeitar).

### Fase 3 — Preventiva
- CRUD de PM + agenda; cron (pg_cron) gerando OTs; auto-desativação; encadeamento
  por `COMPLETED_DATE`.

### Fase 4 — Permissões e configurações
- Papéis/permissões (`can()` + checagem nas Server Actions); configurações da
  empresa; campos configuráveis da OT; perfis.

### Fase 5 — Visão e refino
- Dashboard com KPIs; calendário responsivo; listas em cards no mobile; filtros
  salvos; importação CSV (se desejada).

### Depois do MVP (v2)
- Pedidos de compra, medidores completos, workflows/automações, portal público de
  solicitação, analytics avançada, cobrança.

---

## 13. Diferenças deliberadas em relação ao Atlas original

| Tema | Atlas (origem) | AtivHub (MVP) |
|------|----------------|---------------|
| Backend | Spring Boot (~680 classes) | Supabase (SQL + Edge Functions) |
| Banco | 139 tabelas | ~25 tabelas |
| Agendador | Quartz | pg_cron + função |
| Licença | Keygen, travas por plano | nenhuma |
| Multi-tenant | filtro em Java (`@PostLoad`) | RLS por `tenant_id` |
| Auditoria | Hibernate Envers | colunas `created_by`/`updated_at` (+ histórico simples) |
| UI | MUI (desktop-first) | shadcn + Tailwind (responsivo) |
| Estoque | peça removida não estornava | sempre estorna (`stock_movement`) |
| Conclusão de OT | bug ao concluir de `IN_PROGRESS` | sempre grava `completed_on` |

---

## 14. Referências do código-fonte original

Para consultar o comportamento exato durante a implementação:

- OT: `api/src/main/java/com/grash/model/WorkOrder.java`,
  `abstracts/WorkOrderBase.java`, `service/WorkOrderService.java`,
  `controller/WorkOrderController.java`.
- PM/agenda: `model/PreventiveMaintenance.java`, `model/Schedule.java`,
  `service/ScheduleService.java`, `job/WorkOrderCreationJob.java`.
- Requests: `model/Request.java`, `service/RequestService.java`,
  `controller/RequestController.java`.
- Ativos/locais: `model/Asset.java`, `model/Location.java`,
  `service/AssetService.java`, `service/LocationService.java`.
- Estoque: `model/Part.java`, `model/PartQuantity.java`,
  `model/PartConsumption.java`, `service/PartService.java`.
- Pessoas/papéis: `model/OwnUser.java`, `model/Role.java`, `utils/Helper.java`
  (papéis default), `model/enums/PermissionEntity.java`.
- Enums: `model/enums/Status.java`, `Priority.java`, `AssetStatus.java`,
  `RecurrenceType.java`, `RecurrenceBasedOn.java`.
- Tema/tokens: `frontend/src/theme/schemes/PureLightTheme.ts`.
- Formulários: `frontend/src/content/own/components/form/index.tsx`,
  `frontend/src/utils/woBase.ts`,
  `frontend/src/contexts/CompanySettingsContext.tsx`.
