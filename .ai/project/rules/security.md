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

## Acesso público do QR

- O PIN da localização fica em texto: o gestor precisa lê-lo e repassá-lo.
- O visitante só lê histórico, relatório e solicitação depois de
  `public_asset_unlock`, que devolve um token de 30 minutos.
- Dez erros em 15 minutos travam o PIN daquela localização.
- `public_session_asset` e `public_asset_history` não podem ser concedidas a
  `anon` nem `authenticated`.

## Always do

- Prefer environment variables for secrets.
- Document sensitive integrations and required scopes.
- Review auth, validation, file upload, and external request paths carefully.
- Flag any uncertainty involving privacy, authorization, or data exposure.
