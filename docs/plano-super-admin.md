# Plano de desenvolvimento do Super Admin

O Super Admin do AtivHub consulta todas as empresas cadastradas e seus totais de ativos, ordens de serviço (OS), clientes, localizações e pessoas. A ficha da empresa abre em Pessoas, onde o operador pode ver o último login, o último acesso ao tenant e abrir uma prévia de suporte.

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

- O schema do Supabase tem `tenant`, `customer`, `asset`, `work_order`, `location`, `membership` e `role`. `membership.user_id` liga a pessoa ao Supabase Auth. `auth.users.last_sign_in_at` fornece o último login. O último uso do tenant começa a ser medido com o registro de atividade por vínculo.
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
2. Em `/admin/tenants/[id]`, mostrar os totais e a seção **Pessoas**, com busca e paginação. A lista apresenta nome, e-mail, papel, situação e data e hora de último login. Clientes aparecem nos indicadores da empresa.
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

- `platform_private.membership_activity` grava um timestamp UTC por vínculo com `record_membership_access`. A RPC deriva usuário e tenant da sessão e confere vínculo habilitado e assinatura vigente. O banco limita a gravação a uma vez a cada cinco minutos por vínculo.
- A abertura de uma página operacional visível e interações em primeiro plano registram atividade. Prefetch, renovação de sessão, tarefas em segundo plano, QR público, perfil, assinatura e prévias de suporte ficam fora dessa medição.
- A seção Pessoas mostra **Último acesso ao tenant** e **Último login**, ambos em horário de Brasília. A atividade começa a ser medida após a publicação do app. Até a primeira atividade medida, a coluna exibe **Sem acesso registrado**.

## Fase 4 — Run as somente leitura

1. Na seção Pessoas, selecione **Ver como** em um vínculo habilitado e informe o motivo. A autorização de suporte pertence ao Super Admin. Cada prévia dura 15 minutos e fica vinculada à sessão do operador, ao tenant e à pessoa selecionada. [Sessões no Supabase](https://supabase.com/docs/guides/auth/sessions#access-token-jwt-claims)
2. `/admin/support/[id]` mostra empresa, pessoa, papel, tempo restante e **Encerrar visualização**. Ela exibe o painel inicial de manutenção ou indica a área em que a pessoa começa. Para assinatura vencida, a prévia indica o aviso de assinatura.
3. A consulta de suporte revalida a sessão, o papel e a elegibilidade do vínculo. A consulta compartilhada do painel limita os dados à empresa e ao escopo do vínculo. A prévia é somente leitura e a identidade autenticada é a do operador.
4. As tabelas privadas `support_preview` e `support_preview_audit` guardam o contexto, o motivo e os eventos. Revogar o operador fecha as prévias abertas. A expiração bloqueia novas leituras e é registrada quando a prévia é consultada ou encerrada.

## Critérios de aceite

- O Super Admin autenticado por e-mail e senha navega por todas as empresas, inclusive empresa vazia ou vencida. Uma conta sem o privilégio global, inclusive `ADMIN` de empresa, recebe acesso negado por URL direta e por chamada à RPC. Revogar o privilégio bloqueia a próxima consulta.
- Busca e paginação retornam os mesmos totais e regras do detalhe. Cobrir duas empresas com dados diferentes, cliente interno, localização sem cliente, OS concluída e arquivada, ativo arquivado e pessoa desabilitada. Verificar a ausência de PINs, documentos e credenciais nas respostas e nos logs.
- Uma sessão já aberta pode atualizar o último acesso sem novo login. O registro respeita tenant, pessoa e o intervalo de gravação, inclusive com abas concorrentes. Aberturas em segundo plano e sessões de suporte ficam fora da medição. Verificar valores nulos e a exibição de data e hora na web e no Android.
- O Run as mostra a visão compatível com o papel de destino. A sessão vale para um único vínculo, expira e pode ser encerrada. A auditoria identifica o operador. Edições, timers, envio de e-mail, marcação de leitura e geração de preventivas ficam fora desse fluxo.
- Validar as migrations e a autorização com dados de dois tenants em ambiente de teste, inspecionar as consultas e rodar `npm run lint`, `npm run typecheck` e `npm run build`. Versionar migrations e tipos do Supabase. Registrar a arquitetura, o provisionamento e as regras de acesso em `.ai/project/` junto com a implementação.

## Ordem de entrega

Aplicar as migrations de atividade e de prévia de suporte antes de publicar a versão do app que inclui **Último acesso ao tenant** e **Ver como**. [Atividade](../supabase/migrations/20261125124259_membership_activity.sql) · [Prévia de suporte](../supabase/migrations/20261125124346_platform_support_preview.sql)
