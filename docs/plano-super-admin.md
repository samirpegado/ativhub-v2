# Plano de desenvolvimento do Super Admin

O Super Admin do AtivHub terá um painel interno para consultar todas as empresas cadastradas, os clientes de cada uma e o volume de ativos, ordens de serviço (OS), clientes, localizações e pessoas. A primeira entrega cobre o painel e o último login disponível. O registro de último acesso ao tenant e o Run as entram nas fases seguintes.

## Ativação da conta

Aplicar as migrations `platform_admin` e `platform_admin_password_login` antes de publicar o app. A primeira concede acesso a `admin@sgapps.org` por meio do UUID `204a038b-d164-47d4-9495-39b32ca2ef89`, desde que a conta exista no Auth. Uma restrição no banco limita a concessão a esse UUID. A conta usa o login de e-mail e senha do AtivHub para abrir `/admin/tenants`. [Migration inicial](../supabase/migrations/20261124180250_platform_admin.sql) · [Login por senha](../supabase/migrations/20261125123059_platform_admin_password_login.sql)

Para suspender o acesso, atualizar a concessão a partir de um contexto administrativo no banco.

```sql
update platform_private.platform_admin
set revoked_at = now()
where user_id = '204a038b-d164-47d4-9495-39b32ca2ef89'::uuid;
```

A próxima consulta verifica a revogação. Para reativar a mesma conta, definir `revoked_at` como `null` no registro autorizado.

## Base atual

- O schema conectado do Supabase tem `tenant`, `customer`, `asset`, `work_order`, `location`, `membership` e `role`. `membership.user_id` liga a pessoa ao Supabase Auth. `auth.users.last_sign_in_at` já existe. O repositório e o schema consultado não apresentam um registro de atividade por vínculo.
- O `ADMIN` atual é um papel dentro da empresa. O app resolve o tenant pelo `app_metadata.tenant_id`, aplica RLS às tabelas operacionais e trata a vigência da assinatura nas rotas do app. O painel global precisa funcionar com uma conta da plataforma sem vínculo com empresa e incluir empresas com assinatura vencida. [Autenticação atual](../src/lib/auth/current-user.ts) · [Proxy e assinatura](../src/lib/supabase/middleware.ts)
- O PIN usado no QR está em `customer.request_pin`. [Migração do PIN de cliente](../supabase/migrations/20261104200000_customer_pin_and_location_link.sql) · [Regra de segurança](../.ai/project/rules/security.md)
- Já existe uma prévia do painel da pessoa no mesmo tenant. Ela oferece componentes e regras de visibilidade para reaproveitar no Run as. Alguns links ainda levam a rotas operacionais. Abrir certas páginas operacionais pode marcar uma solicitação como lida ou disparar a geração de OS preventivas. [Prévia da pessoa](<../src/app/(app)/people/[id]/page.tsx>) · [Leitura de solicitações](<../src/app/(app)/requests/[id]/page.tsx>) · [Geração de preventivas](../src/lib/preventive/queries.ts)

## Fase 1 — Acesso global e auditoria

1. Criar `platform_admin` em schema privado com concessão exclusiva ao UUID autorizado do Supabase Auth. A concessão e a revogação ficam fora do cadastro público e da administração de tenant. Consultar a autorização vigente a cada operação privilegiada.
2. Criar um grupo App Router independente de `(app)` para `/admin/tenants`. Usar o login de e-mail e senha, com e-mail confirmado e sessão ativa no Supabase. Ajustar o destino do login e a exceção de assinatura para esse namespace. O proxy cuida dos redirecionamentos. Cada consulta administrativa valida o acesso na origem dos dados.
3. Criar RPCs administrativas específicas, chamadas no servidor com a sessão do operador. Manter as implementações que exigem privilégio em schema fora da Data API, com `search_path` fixo, nomes de objetos qualificados e verificação do `auth.uid()`, da sessão e do privilégio global. Expor somente funções de entrada `SECURITY INVOKER`, com grants explícitos e validação também na função privada. Preservar as políticas RLS do app. [Funções e privilégios no Supabase](https://supabase.com/docs/guides/database/functions#secure-a-database-function)
4. Auditar as consultas administrativas com operador, ação, URL lógica ou recurso, tenant quando aplicável e data/hora. Guardar a trilha em schema privado, com acesso e prazo de retenção definidos antes da publicação. Restringir os eventos a identificadores e metadados da operação.

## Fase 2 — Lista e detalhe de empresas

1. Em `/admin/tenants`, listar nome da empresa, data de cadastro e os cinco totais. Oferecer busca por empresa e paginação no banco com até 20 linhas por página e ordenação estável. Incluir empresas com contadores zerados. Seguir o padrão de listas e estados de carregamento do AtivHub. [Regras de listas](../.ai/project/rules/coding.md)
2. Em `/admin/tenants/[id]`, mostrar os totais e abas **Clientes** e **Pessoas**, com busca e paginação próprias. Em Clientes, apresentar nome e tipo, identificando o cliente interno. Em Pessoas, apresentar nome, e-mail, papel, situação e data/hora de último login. Projetar somente os campos usados pela tela. O cadastro operacional de clientes devolve PIN e CPF/CNPJ, e a projeção global usa apenas os campos de consulta descritos aqui. [RPC de clientes](../supabase/migrations/20261104233000_assets_phase_and_internal_customer.sql#L258)
3. Agregar cada tabela pelo `tenant_id` depois de selecionar a página de empresas. Usar uma chamada de banco por tela ou aba, sem multiplicar linhas entre entidades. Os índices existentes cobrem `tenant_id` em ativos, OS, localizações e pessoas. Avaliar um índice geral de clientes por tenant com `EXPLAIN` e massa representativa, pois os índices atuais de clientes por tenant são parciais.

| Indicador | Regra proposta |
| --- | --- |
| Ativos | Registros de `asset` não arquivados. |
| OS | Registros de `work_order` não arquivados, em qualquer situação, incluindo as concluídas. |
| Clientes | Todos os registros de `customer`, com o número de clientes externos e o cadastro interno identificados. |
| Localizações | Todos os registros de `location`, incluindo aqueles sem cliente vinculado. |
| Pessoas | Vínculos em `membership` naquele tenant, com total e distinção entre habilitados e desabilitados. |

O último login é `auth.users.last_sign_in_at` associado aos vínculos da página. O horário é da conta de autenticação e pode incluir reautenticação para troca de senha. Para valor nulo, exibir **Sem login registrado**. [Reautenticação do perfil](<../src/app/(app)/profile/actions.ts>)

## Fase 3 — Último acesso ao tenant

- Criar `membership_activity` com um registro por vínculo e `last_access_at` em UTC. Atualizar pelo relógio do banco em uma operação que derive usuário e tenant da sessão e confira o vínculo habilitado. Limitar a persistência a uma atualização por vínculo a cada cinco minutos, inclusive com abas concorrentes.
- Instrumentar a abertura concluída de uma tela operacional visível e interações válidas no aplicativo autenticado, inclusive na WebView Android. Requisições de prefetch, renovação de sessão, tarefas em segundo plano, QR público e prévias de suporte ficam fora dessa medição.
- Mostrar **Último acesso ao tenant** com data, hora e fuso na aba Pessoas. Manter **Último login** como campo distinto. A coluna de acesso começa a registrar dados após a publicação. Até a primeira atividade medida, mostrar **Sem acesso registrado**.

## Fase 4 — Run as somente leitura

1. Adicionar **Ver como pessoa** à aba Pessoas para operadores com autorização específica de suporte. Selecionar um vínculo habilitado, informar um motivo e confirmar a operação. Criar uma sessão de suporte revogável, com validade inicial proposta de 15 minutos, ligada à sessão do operador, ao tenant e ao vínculo selecionado. [Sessões no Supabase](https://supabase.com/docs/guides/auth/sessions#access-token-jwt-claims)
2. Abrir uma rota administrativa dedicada com uma faixa que mostre empresa, pessoa, tempo restante e **Encerrar visualização**. Começar pelo painel inicial e pela indicação da tela de entrada do papel. Reaproveitar os componentes visuais e o cálculo de permissões. Os links da prévia levam somente a telas assistidas implementadas. A prévia apresenta o estado esperado da conta alvo, inclusive um eventual bloqueio de assinatura.
3. Validar a sessão de suporte e os direitos atuais do alvo em cada leitura. Usar consultas próprias que respeitem tenant, papel e escopo do vínculo para reproduzir o que a pessoa vê. A identidade autenticada continua sendo a do operador. A prévia usa dados somente leitura, com endpoints apartados do fluxo operacional, inclusive para ações automáticas disparadas por páginas comuns.
4. Auditar início, leituras, encerramento, expiração ou revogação, com operador, vínculo alvo, tenant, motivo e horário. O acesso termina na expiração, no logout, na revogação ou se o alvo perder elegibilidade. Liberar para operadores autorizados após validar o painel global.

## Critérios de aceite

- O Super Admin autenticado por e-mail e senha navega por todas as empresas, inclusive empresa vazia ou vencida. Uma conta sem o privilégio global, inclusive `ADMIN` de empresa, recebe acesso negado por URL direta e por chamada à RPC. Revogar o privilégio bloqueia a próxima consulta.
- Busca e paginação retornam os mesmos totais e regras do detalhe. Cobrir duas empresas com dados diferentes, cliente interno, localização sem cliente, OS concluída e arquivada, ativo arquivado e pessoa desabilitada. Verificar a ausência de PINs, documentos e credenciais nas respostas e nos logs.
- Uma sessão já aberta pode atualizar o último acesso sem novo login. O registro respeita tenant, pessoa e o intervalo de gravação, inclusive com abas concorrentes. Aberturas em segundo plano e sessões de suporte ficam fora da medição. Verificar valores nulos e a exibição de data e hora na web e no Android.
- O Run as mostra a visão compatível com o papel de destino. A sessão vale para um único vínculo, expira e pode ser encerrada. A auditoria identifica o operador. Edições, timers, envio de e-mail, marcação de leitura e geração de preventivas ficam fora desse fluxo.
- Validar as migrations e a autorização com dados de dois tenants em ambiente de teste, inspecionar as consultas e rodar `npm run lint`, `npm run typecheck` e `npm run build`. Versionar migrations e tipos do Supabase. Registrar a arquitetura, o provisionamento e as regras de acesso em `.ai/project/` junto com a implementação.

## Ordem de entrega

Publicar primeiro o painel com as contagens, a lista de clientes e pessoas e o horário de último login. Ativar a medição de último acesso em seguida. Liberar o Run as de painel como entrega opcional. Qualquer suporte que precise alterar dados exige um escopo de produto separado.
