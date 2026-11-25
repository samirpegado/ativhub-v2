# Security Rules

## Never do

- Never commit secrets, tokens, or credentials.
- Never print secrets to logs.
- Never disable validation just to satisfy a demo flow.
- Never trust user input without explicit validation.

## Multi-tenant

- Toda tabela de negócio tem `tenant_id` e RLS. O claim
  `app_metadata.tenant_id` é a fonte da função `current_tenant_id()`.
- Permissões finas (`role.permissions`) são checadas na aplicação; o RLS
  garante só o isolamento por tenant.
- `membership.job_title` só muda com papel ADMIN: a action omite o campo
  para os demais e o trigger `protect_membership_job_title` recusa o resto.
- Criar pessoa é só ADMIN, via edge function `create-tenant-user` (service
  role). O papel só muda se `is_tenant_admin()`; o e-mail da membership
  acompanha o Auth e o cliente não altera.

## Administração da plataforma

- A migration restringe o cadastro de Super Admin ao único UUID autorizado no
  Supabase Auth. A autorização é lida do schema privado em cada consulta.
- Para consultar empresas, as RPCs exigem e-mail confirmado, concessão ativa
  e sessão Auth vigente da conta autorizada. As funções públicas são
  `SECURITY INVOKER`. A implementação privilegiada e a trilha de auditoria
  ficam em schema privado.
- A consulta global de clientes retorna nome, tipo e indicação de cliente
  interno. A auditoria guarda o operador, a ação, o tenant quando aplicável e
  o horário da consulta.
- O registro de último acesso deriva a pessoa e o tenant da sessão autenticada.
  A RPC confere vínculo habilitado e assinatura vigente. A tabela de atividade
  fica no schema privado.
- **Ver como** exige permissão de suporte e uma sessão vinculada ao operador,
  à sessão dele no Auth e ao vínculo alvo. O banco revalida o papel e a
  assinatura do alvo em cada leitura. O contexto e os eventos ficam em tabelas
  privadas. Revogar a permissão do operador encerra as prévias abertas.

## Acesso público do QR

- O PIN do cliente (`customer.request_pin`) fica em texto para o gestor consultar
  e repassar. A localização aponta para o cliente.
- O visitante só lê histórico, relatório e solicitação depois de
  `public_asset_unlock`, que devolve um token de 30 minutos.
- Dez erros em 15 minutos travam o PIN daquele cliente.
- `public_session_asset` e `public_asset_history` não podem ser concedidas a
  `anon` nem `authenticated`.

## Always do

- Prefer environment variables for secrets.
- Document sensitive integrations and required scopes.
- Review auth, validation, file upload, and external request paths carefully.
- Flag any uncertainty involving privacy, authorization, or data exposure.
