# Etapa 2 — Plano de implementação

Detalhamento de `docs/etapa 2.md`, quebrado em tarefas, com a arquitetura sugerida,
as mudanças de banco, os arquivos afetados e os cenários que o documento original
não cobre. Segue os padrões já aceitos: listas por RPC (ADR-0007), cadastro em
modal (ADR-0003), multi-tenant por RLS com `current_tenant_id()`, valores em BRL
(ADR-0004) e telefone com `PhoneInput`.

O plano é o planejamento. As fases A (e-mail), B (cadastro, confirmação e senha),
C (assinatura), D (categorias de ativo), E (seleção em massa), F (ativos),
G (ordens) e H (preventivas) já estão no código.

---

## Visão geral e sequência

As tarefas têm dependências entre si. A ordem recomendada:

1. **Fase A — Infra de e-mail** (Brevo + templates). É dependência de OTP,
   recuperação de senha, relatório por e-mail e assinatura.
2. **Fase B — Cadastro de conta + verificação (OTP) + recuperação de senha.**
   Destrava o onboarding real.
3. **Fase C — Assinatura (trial + Asaas + webhook + bloqueio).** Depende do
   cadastro existir.
4. **Fase D — Categorias (CRUD em Configurações).** Dependência de "categoria do
   ativo".
5. **Fase E — Seleção em massa (primitiva compartilhada).** Dependência das ações
   em grupo de ativos, ordens e preventivas.
6. **Fase F — Ativos** (import/export, categoria, status TAG, local de instalação,
   histórico/timeline, ação em grupo).
7. **Fase G — Ordens de serviço** (tipo, atraso, filtros, ação em grupo, relatório
   por e-mail).
8. **Fase H — Preventivas** (multi-ativo, ação em grupo).

Fases A–C são o "núcleo SaaS" (contas, cobrança). D–H são features do produto.
Dá para paralelizar D–H depois que A–C e a primitiva de seleção (E) existirem.

---

## Fase A — Infraestrutura de e-mail (Brevo)

**Objetivo.** Um único ponto de envio de e-mail transacional, com corpo vindo de
templates editáveis no banco, reutilizado por OTP, recuperação de senha, relatório
de OS e avisos de assinatura.

### A1. Tabela de templates de e-mail
- Migration nova: tabela `email_template` **global** (sem `tenant_id`; são os
  modelos do produto, não por empresa), colunas: `code` (único, ex.
  `ACCOUNT_VERIFICATION`, `PASSWORD_RESET`, `WORK_ORDER_REPORT`, `TRIAL_ENDING`,
  `SUBSCRIPTION_ACTIVE`, `SUBSCRIPTION_PAST_DUE`), `subject`, `html`, `enabled`,
  `updated_at`.
- Variáveis por substituição simples `{{nome}}` no `subject` e no `html`.
- Seed inicial com os templates acima.
- RLS: leitura/escrita só via service role (edge functions). Sem acesso anon.

### A2. Edge function `send-email`
- `supabase/functions/send-email/index.ts`. Recebe `{ templateCode, to, variables }`,
  carrega o template (service role), renderiza e chama a API Brevo
  (`https://api.brevo.com/v3/smtp/email`) com `BREVO_API_KEY`,
  `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` (já nas secrets).
- Código compartilhado em `supabase/functions/_shared/` (cliente Brevo + render).
  É a primeira função a usar `_shared`; criar a pasta.
- Idempotência leve: aceitar `idempotencyKey` opcional para não reenviar.
- **Nunca** exporta o corpo renderizado de volta ao cliente logado; as funções de
  negócio é que chamam `send-email` internamente (ou via `supabase.functions.invoke`).

### A3. Tela de edição de templates (opcional no MVP)
- Aba em Configurações "E-mails" (admin), lista `email_template` e edita
  `subject`/`html` num modal. Como os templates são globais, restringir a um
  super-admin do produto; se não houver esse papel ainda, **deixar fora do MVP** e
  editar via migration/MCP. Sugestão: começar sem UI.

**Arquitetura.** E-mail sempre pela edge `send-email`. Nenhuma chamada Brevo no
código Next (mantém a `BREVO_API_KEY` só no edge). Templates no banco para trocar
texto sem redeploy.

---

## Fase B — Cadastro de conta, verificação por OTP e recuperação de senha

**Objetivo.** Onboarding self-service: o formulário cria usuário + empresa + papel
ADMIN, mas o acesso fica bloqueado até o e-mail ser verificado. Mesma mecânica para
redefinir senha.

**Decisão link vs código.** Recomendo **link de ativação** (token na URL) como
caminho principal, com **código OTP** exibido como alternativa (mesmo token curto).
Link é um clique; o código cobre quem abre o e-mail noutro dispositivo. Os dois
validam o mesmo registro em `adm_otp_emails`.

### B1. Tabela `adm_otp_emails`
- Migration: `id`, `user_id` (fk `auth.users`), `email`, `purpose`
  (`VERIFY_EMAIL` | `RESET_PASSWORD`), `token_hash` (hash do token/código, nunca o
  valor cru), `code` curto também hasheado, `expires_at` (3h), `consumed_at`,
  `attempts`, `created_at`.
- RLS: sem acesso de usuário final; manipulada por RPC `security definer` e edges.
- Índice por `user_id`, `purpose`, `expires_at`.

### B2. Formulário de cadastro (`/register`)
- Substituir o placeholder atual. Campos do modelo de referência
  (`frontend-cmms/.../Register/RegisterJWT.tsx`): nome, sobrenome, e-mail, telefone
  (`PhoneInput`), senha, **nome da empresa**, aceite dos termos.
- Server action: `supabase.auth.signUp` **com confirmação nativa desligada**
  (controlamos a verificação), grava `user_metadata` nome/sobrenome/telefone.
- Após criar a sessão, chamar `bootstrap_tenant(empresa, nome, sobrenome)` (já
  existe) para criar tenant + papéis + membership owner + `tenant_id` no
  `app_metadata`.
- Gerar OTP/token (RPC `issue_email_otp(purpose)`), disparar `send-email`
  (`ACCOUNT_VERIFICATION`) com link `/<site>/auth/activate?token=...` e o código.
- Redirecionar para `/auth/verify` (aviso "confirme seu e-mail").

### B3. Rotas de ativação
- `/auth/activate` (GET): valida o token em `adm_otp_emails`, marca o usuário como
  verificado e `consumed_at`. Redireciona ao app.
- `/auth/verify`: tela de aviso + reenviar código + campo para digitar o código.
- Marcar verificação: coluna nova `membership.email_verified_at` **ou**
  `auth.users.email_confirmed_at` via RPC service-definer. Recomendo usar o
  **`email_confirmed_at` do Supabase** (padrão da plataforma) atualizado por RPC
  `confirm_email_otp(token|code)` `security definer`.

### B4. Bloqueio de acesso até verificar
- Em `src/lib/supabase/middleware.ts` (proxy): usuário logado **sem**
  `email_confirmed_at` só acessa `/auth/verify`, `/auth/activate`, `/login`,
  logout. Qualquer outra rota → `/auth/verify`.
- `requireUser`/`requireTenant` também checam verificação como defesa em profundidade.

### B5. Recuperação de senha por OTP/link
- Reaproveitar `adm_otp_emails` com `purpose = RESET_PASSWORD`.
- `/login/forgot`: em vez de `resetPasswordForEmail` nativo, gerar token e disparar
  `send-email` (`PASSWORD_RESET`) com link `/auth/reset?token=...`.
- `/auth/reset`: valida token, abre form de nova senha, RPC
  `reset_password_with_otp(token, nova_senha)` (service definer via edge, pois
  troca de senha de terceiro exige admin API) e consome o token.

**Arquitetura.** Token/código sempre hasheados no banco; expiração de 3h; uso
único; limite de tentativas. O bloqueio mora no proxy (fonte única de verdade de
rota pública/privada) + checagem nos helpers de auth.

---

## Fase C — Assinatura (trial 14 dias + Asaas)

**Objetivo.** Toda empresa nova tem 14 dias grátis. Depois, exige assinatura ativa
via link de pagamento do Asaas. Sem telas de checkout próprias.

### C1. Modelo de assinatura (estruturado para múltiplos planos)
- **Tabela `plan` (catálogo de planos, global):** `id`, `code` (único, ex.
  `STANDARD`), `name`, `amount` (numeric, 99.90), `interval` (default `MONTHLY`),
  `asaas_payment_link_id`/`asaas_plan_ref` (referência no Asaas, se houver),
  `is_active`, `created_at`. **Por enquanto um só registro** (`STANDARD`, 99,90),
  mas o schema já aceita vários. Leitura por `authenticated`; escrita só service
  role.
- **Tabela `subscription` por tenant:** `tenant_id` (único), **`plan_id`** (fk
  `plan`), `status` (`TRIALING` | `ACTIVE` | `PAST_DUE` | `CANCELED`),
  `trial_ends_at` (`created_at + 14 dias`), `asaas_customer_id`,
  `asaas_subscription_id`, `current_period_end`, `updated_at`. O valor vem do
  `plan`, não é fixado na assinatura.
- No `bootstrap_tenant`: criar a `subscription` apontando para o plano padrão
  (`STANDARD`) com `status = TRIALING` e `trial_ends_at = now() + 14 dias`.
- Backfill para tenants existentes (plano padrão + trial a partir de `created_at`).

### C2. Link de pagamento (checkout)
- Página `/subscription` (ou dentro de "Minha empresa"), admin: mostra status,
  dias restantes, o **plano** (hoje só o `STANDARD`) e o botão "Assinar". A UI já
  lê a lista de planos ativos para, no futuro, oferecer a escolha.
- Edge `asaas-create-checkout` (mantém a chave fora do Next): recebe o `plan_id`,
  resolve o tenant pela sessão, e cria/obtém o **link de pagamento** no Asaas com
  `externalReference = tenant_id` e o valor do plano. Redireciona ao link.
- **Toggle `is_prod` (boolean) na função de checkout:** quando `false`, usa
  `ASAAS_API_KEY_SANDBOX` e a URL base de sandbox; quando `true`, usa
  `ASAAS_API_KEY_PROD` e a URL base de produção. **Começa em `false`.** Ambas as
  secrets já existem. O mesmo toggle vale para o webhook (validação/base). Definir
  o valor por variável de ambiente da edge (ex.: `ASAAS_IS_PROD`), com default
  `false`.

### C3. Webhook de pagamento
- Edge `supabase/functions/asaas-webhook/index.ts`: recebe eventos do Asaas
  (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, etc.).
- Validar o header de autenticação do webhook (token do Asaas) e **idempotência**
  por `event.id` (tabela `asaas_webhook_event` com os IDs já processados).
- Resolver o tenant por `externalReference` (ou `asaas_customer_id`), atualizar
  `subscription.status` e `current_period_end`. Disparar `send-email`
  (`SUBSCRIPTION_ACTIVE` / `SUBSCRIPTION_PAST_DUE`).
- Respeita o mesmo `is_prod` da C2 para validar a origem conforme o ambiente.

### C4. Bloqueio por assinatura
- `requireTenant`/layout `(app)` calculam o estado: `TRIALING` dentro do prazo ou
  `ACTIVE` → libera; caso contrário → redireciona para `/subscription` (somente
  essa rota + perfil + logout liberados).
- Decisão a confirmar com o usuário: ao expirar, **bloqueio total** ou **somente
  leitura**. Sugestão MVP: bloqueio total com acesso só à tela de assinatura.

**Arquitetura.** Estado da assinatura no banco, dirigido pelo webhook (fonte da
verdade = Asaas). Chaves do Asaas só nas edges. `externalReference = tenant_id`
liga o pagamento à empresa.

---

## Fase D — Categorias (CRUD em Configurações)

**Objetivo.** Cadastro de categorias (ex.: Elétrica, Civil, Refrigeração) para
classificar ativos, numa aba de Configurações, com modal de criação rápida.

### D1. Backend
- A tabela `category` já existe (`type`, `name`, `color`, `description`). Criar RPCs
  no padrão ADR-0007: `categories_screen(type, busca, limit, offset)` e as actions
  de create/update/delete (ou server actions diretas, já que é tabela simples do
  tenant com RLS). Tipo inicial: `ASSET`.
- Permissão: admin (tabela de domínio de configuração).

### D2. UI
- Nova aba "Categorias" em `src/components/settings/settings-view.tsx` com
  `SearchableTable` + `FormDialog` (nome, cor, descrição).
- **Modal separado de criação rápida** reutilizável, para ser aberto de dentro do
  formulário de ativo ("+ nova categoria") sem sair do cadastro.

**Arquitetura.** Reusar `category.type` para separar categorias de ativo das de OS
e peças já existentes no banco. Começar só por `ASSET` (as de OS/peça seguem o
mesmo molde quando necessário).

---

## Fase E — Seleção em massa (primitiva compartilhada)

**Objetivo.** Uma base única de "marcadores + ação em grupo" usada por ativos,
ordens e preventivas.

### E1. Primitiva
- Estender `src/components/lists/searchable-table.tsx` com modo opcional
  `selectable`: coluna de checkbox, "selecionar todos da página", estado de
  seleção e uma **barra de ações em massa** (aparece quando há seleção).
- A tabela custom de ordens (`work-orders-view.tsx`) ganha o mesmo mecanismo
  (ou extrai-se um hook `useRowSelection` compartilhado).
- Ações recebem a lista de IDs e chamam server actions em lote.

### E2. Ações em lote no backend
- Server actions de exclusão em lote por entidade, respeitando permissão
  (`requireArea(area,"edit")`) e RLS. Uma RPC `bulk_delete` por tabela **ou**
  `delete().in("id", ids)` no server action (mais simples, já com RLS).

**Arquitetura.** Seleção é estado de cliente; a ação é um server action que recebe
IDs e revalida a lista. Confirmar com diálogo antes de excluir. A exclusão em lote
já está ligada em ativos, ordens e preventivas, só para quem tem edição na área.
A mudança de data em grupo das ordens continua na fase G.

---

## Fase F — Ativos

### F1. Importação/Exportação por planilha
- **Exportar**: server action gera CSV/XLSX dos ativos do tenant. Avaliar `xlsx`
  (SheetJS) como dependência; CSV puro evita dependência nova (sugestão: começar
  com CSV, usando as próprias libs do Node).
- **Importar**: modal com upload, download de **modelo**, parse no servidor,
  validação linha a linha (resolver `location` e `category` por nome, checar
  obrigatórios), relatório de erros por linha e commit só das válidas.
- Dedupe por `custom_id` quando presente (update) ou criação nova.

### F2. Categoria do ativo
- Expor `category_id` (type `ASSET`) no `asset-form.tsx` com select + botão
  "+ nova categoria" (modal da Fase D). Persistir em `createAsset`/`updateAsset`.
- Mostrar a categoria na tabela e no detalhe.

### F3. Status "operacional" como TAG colorida
- Badge colorido por status em `assets-view.tsx` (e onde o status aparece). Mapa
  de cores por status em `src/lib/assets/status.ts`. "Operacional" em verde.

### F4. Local de instalação do ativo
- Já existe o campo texto `asset.area`. **Reaproveitar e renomear o rótulo** para
  "Local de instalação" (ex.: Bloco A, Salão de festas) em vez de criar coluna
  nova. Expor com destaque no form e no detalhe. (Decisão a confirmar: manter
  `area` ou criar `installation_place`; recomendo reusar `area` para não migrar
  dados.)

### F5. Histórico de manutenções (timeline com custo de peças)
- Ativos hoje não têm RPC de detalhe (lista é client-side). Criar
  **`asset_detail(p_asset_id)`** no padrão ADR-0007: dados do ativo + lista de OS
  do ativo (data, tipo, status, custo de peças somado de `work_order_part`×`cost`,
  mão de obra) + eventos de `asset_downtime`/mudança de status.
- UI: `asset-drawer.tsx` novo, aberto ao clicar no ativo, com uma **timeline** e o
  **custo acumulado** de manutenção (para avaliar viabilidade do ativo).

### F6. Ação em grupo (excluir)
- Feito na fase E: a lista de ativos usa a seleção e `deleteAssets`, com a mesma
  exclusão do botão individual.

---

## Fase G — Ordens de serviço

### G1. Tipo de OS (Preventiva | Corretiva | Preditiva) — prioritário
- Migration: coluna `work_order.type` text default `CORRECTIVE`
  (`PREVENTIVE`|`CORRECTIVE`|`PREDICTIVE`).
- OS geradas por preventiva entram como `PREVENTIVE` (ajustar
  `generate_due_preventive_work_orders`). Preditiva é manual.
- Expor no `work-order-form.tsx`, no `work_orders_screen`/`work_order_detail`
  (payload + badge), e no relatório.

### G2. Sinalizar OS em atraso
- Derivado: `due_date < now()` e `status <> COMPLETE`. Badge "Em atraso" na lista e
  no detalhe. Sem coluna nova.
- Opcional: filtro rápido "só atrasadas".

### G3. Filtros de localização e tipo
- Acrescentar `p_location_ids[]` e `p_types[]` a `work_orders_screen` e aos
  `list-params` (URL `location`, `type`). UI de filtro já existe para status/
  prioridade; adicionar os dois.

### G4. Ação em grupo (alterar data de início/fim, excluir)
- Primitiva da Fase E na tabela de ordens. Barra de ações: **alterar data de
  início**, **alterar data de fim** (modal com date picker aplicado aos IDs) e
  **excluir** (soft `archived`). Server actions em lote com `requireArea`.

### G5. Enviar relatório da OS por e-mail para o cliente
- O relatório hoje é impressão no cliente (`work-order-report.ts`). Para e-mail,
  gerar o conteúdo no servidor (HTML do relatório) e disparar `send-email`
  (`WORK_ORDER_REPORT`).
- **Destinatário**: hoje a OS não liga a um cliente/contratante. Decisão: adicionar
  `work_order.customer_id` (fk `customer`) **ou** um campo de e-mail avulso no
  modal de envio. Recomendo os dois: vincular cliente quando houver, e permitir
  digitar o e-mail no ato.
- Botão "Enviar por e-mail" no drawer da OS, com modal (destinatário + confirmação).
- Anexos/PDF: no MVP, enviar HTML no corpo; PDF fica como evolução (precisaria de
  render server-side de PDF).

---

## Fase H — Preventivas

### H1. Vários ativos numa mesma programação
- Hoje `preventive_maintenance.asset_id` é único. Opções:
  - (a) Tabela de junção `pm_asset(pm_id, asset_id)` — mais limpo e escalável.
  - (b) `asset_ids uuid[]` na própria tabela — simples, menos relacional.
  - Recomendo **(a)** pela consulta/relatório e integridade referencial.
- `generate_due_preventive_work_orders`: ao vencer, criar **uma OS por ativo**
  vinculado (com `parent_pm_id` e `asset_id`), compartilhando título/tarefas. O
  avanço de `next_run_at` continua por agendamento (não por ativo).
- `preventive_detail` e o form passam a listar/selecionar vários ativos
  (multi-select filtrado por localização). Manter compatibilidade: migrar o
  `asset_id` atual para a junção.
- Custom IDs e nomes das OS geradas precisam diferenciar o ativo.

### H2. Ação em grupo (excluir)
- Primitiva da Fase E na lista de preventivas. Exclusão em lote com confirmação.

---

## Mudanças de banco (resumo)

| Migration | Conteúdo |
|-----------|----------|
| E-mail | `email_template` (global) + seed; grants service-role. |
| OTP | `adm_otp_emails` + RPCs `issue_email_otp`, `confirm_email_otp`; (reset via edge). |
| Assinatura | `plan` (catálogo) + `subscription` (com `plan_id`) + `asaas_webhook_event` (idempotência) + trial no `bootstrap_tenant` + backfill. |
| Categorias | RPC `categories_screen` + grants (tabela `category` já existe). |
| OS tipo | `work_order.type` + ajuste no gerador de preventiva + screens/detail. |
| OS filtros | args de `location`/`type` em `work_orders_screen`. |
| OS cliente | `work_order.customer_id` (opcional) para o envio por e-mail. |
| Preventiva multi-ativo | `pm_asset` + migração do `asset_id` + gerador por ativo. |
| Ativo detalhe | RPC `asset_detail` (timeline + custo). |

Todas as RPCs novas seguem o padrão: `security invoker`, `search_path = public`,
revoke public/anon, grant authenticated. Edges (e-mail, asaas, reset de senha) usam
service role e **não** são expostas a anon sem validação.

---

## Cenários não contemplados no documento (sugestões)

Pontos que, na minha avaliação, faltam para "fechar o MVP" com segurança:

1. **Convite de usuário / entrar em empresa existente.** O middleware já trata
   `/invite` como rota pública, mas **não existe** a tela. Hoje pessoas só entram
   pela edge `create-tenant-user` (admin cria com senha). Sugestão: ou construir o
   fluxo de convite por e-mail (token + definir senha), ou remover a rota `/invite`
   do proxy para não deixar brecha. Recomendo construir, pois casa com a infra de
   e-mail/OTP.

2. **O que acontece quando a assinatura expira.** Bloqueio total vs somente
   leitura; reativação; período de carência. Precisa de decisão de produto.
   (Sugestão MVP: bloqueio total com acesso só à tela de assinatura e logout.)

3. **Segurança do webhook Asaas.** Validação do token do webhook, idempotência por
   evento e tratamento de eventos fora de ordem. Sem isso, o estado da assinatura
   fica frágil.

4. **Sandbox vs produção do Asaas.** O doc cita só `ASAAS_API_KEY_SANDBOX`. Definir
   a env de produção e a URL base por ambiente antes de cobrar de verdade.

5. **Deliverability do Brevo.** Domínio do remetente verificado (SPF/DKIM),
   tratamento de bounce e limites de envio. Afeta OTP e cobrança.

6. **OTP — regras finas.** Limite de reenvio, máximo de tentativas, uso único,
   invalidar tokens antigos ao emitir um novo, e a UX de "link expirado → reenviar".

7. **Troca/confirmação de e-mail da conta** depois de criada (fora do cadastro
   inicial) usando a mesma infra de OTP.

8. **Aceite de termos/LGPD** no cadastro (o modelo de referência já tem o aceite);
   guardar timestamp do aceite.

9. **Timeline do ativo além de OS.** Incluir paradas (`asset_downtime`), mudanças
   de status e custo de peças **e** mão de obra, não só peças, para a conta de
   viabilidade fazer sentido.

10. **Import de planilha — limites.** Tamanho máximo, processamento assíncrono para
    arquivos grandes, sucesso parcial com relatório de erros, e o modelo/colunas
    esperadas documentados.

11. **Preventiva multi-ativo — efeitos colaterais.** Nome/custom_id das OS geradas
    por ativo, e a regra de "5 OS sem reação pausa o agendamento" passa a contar
    como? (por agendamento, não por ativo — confirmar).

12. **Relatório de OS por e-mail — PDF.** No MVP vai HTML no corpo; se o cliente
    exigir anexo PDF, é trabalho extra (render server-side).

13. **Novas áreas de permissão.** Categorias e Assinatura são admin. Ações em lote
    (excluir, alterar datas) devem respeitar `edit` da área correspondente.

14. **Reconciliar `area` vs "local de instalação".** Evitar criar coluna duplicada;
    decidir rótulo único.

---

## Decisões tomadas

Todas as recomendações do plano foram aceitas. Ficam travadas assim:

- **Verificação de e-mail**: usar `auth.users.email_confirmed_at` do Supabase,
  atualizado por RPC após o OTP/link. Ativação por **link** (principal) + **código**
  (alternativa), expiração de 3h, uso único, token/código hasheados.
- **Recuperação de senha**: mesma mecânica de OTP/link (`adm_otp_emails`).
- **Convite de usuário**: **construir** o fluxo `/invite` (token por e-mail + definir
  senha), em vez de remover a rota do proxy.
- **Preventiva multi-ativo**: junção `pm_asset`; uma OS por ativo na geração; a
  regra de "5 OS sem reação pausa" conta **por agendamento**.
- **Expiração da assinatura**: **bloqueio total**, com acesso só à tela de
  assinatura, perfil e logout.
- **Assinatura multi-plano**: catálogo em `plan` + `subscription.plan_id`. **Um
  plano agora** (`STANDARD`, 99,90/mês); back já preparado para vários.
- **Asaas `is_prod`**: toggle boolean na edge de checkout (e no webhook). `false` →
  `ASAAS_API_KEY_SANDBOX`; `true` → `ASAAS_API_KEY_PROD`. **Começa `false`.**
- **Webhook Asaas**: validação do token + idempotência por `event.id`
  (`asaas_webhook_event`).
- **Import/Export de ativos**: CSV nativo (sem dependência `xlsx`), com modelo,
  validação linha a linha e sucesso parcial.
- **Local de instalação**: reusar `asset.area` (rótulo "Local de instalação"), sem
  coluna nova.
- **Templates de e-mail**: tabela `email_template` no banco, **sem UI no MVP**
  (edição por migration/MCP).
- **Cliente na OS**: adicionar `work_order.customer_id` (vincula o cliente) **e**
  permitir e-mail avulso no modal de envio do relatório.
- **Timeline do ativo**: incluir OS (com custo de peças **e** mão de obra), paradas
  (`asset_downtime`) e mudanças de status, via RPC `asset_detail`.
- **Relatório por e-mail**: HTML no corpo no MVP; PDF fica como evolução.
- **Permissões**: Categorias e Assinatura são admin; ações em lote respeitam o
  `edit` da área.
