-- Templates globais do produto. Sem tenant_id: o texto muda sem redeploy.
-- Só a service role (edge functions) lê e grava. Anon e authenticated não têm acesso.

create table public.email_template (
  code text primary key,
  subject text not null,
  html text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint email_template_code_check check (code ~ '^[A-Z0-9_]{1,64}$')
);

comment on table public.email_template is
  'Corpo dos e-mails transacionais. Variáveis no formato {{nome}}.';

-- Chave opcional para não reenviar o mesmo disparo. Não guarda o corpo.
create table public.email_dispatch (
  idempotency_key text primary key,
  template_code text not null,
  recipient text not null,
  created_at timestamptz not null default now(),
  constraint email_dispatch_key_check check (char_length(idempotency_key) between 8 and 200)
);

alter table public.email_template enable row level security;
alter table public.email_dispatch enable row level security;

revoke all on table public.email_template from public, anon, authenticated;
revoke all on table public.email_dispatch from public, anon, authenticated;

insert into public.email_template (code, subject, html) values
(
  'ACCOUNT_VERIFICATION',
  'Confirme seu e-mail no AtivHub',
  $html$<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>Olá, {{name}}.</p><p>Confirme o e-mail para entrar no AtivHub. O link vale por 3 horas.</p><p><a href="{{link}}">Confirmar e-mail</a></p><p>Se o link não abrir, use o código <strong>{{code}}</strong>.</p><p>Se você não criou esta conta, ignore esta mensagem.</p></body></html>$html$
),
(
  'PASSWORD_RESET',
  'Redefina sua senha no AtivHub',
  $html$<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>Olá, {{name}}.</p><p>Recebemos um pedido para redefinir a senha. O link vale por 3 horas.</p><p><a href="{{link}}">Redefinir senha</a></p><p>Se o link não abrir, use o código <strong>{{code}}</strong>.</p><p>Se você não pediu isso, ignore esta mensagem.</p></body></html>$html$
),
(
  'WORK_ORDER_REPORT',
  'Relatório da ordem {{customId}}',
  $html$<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>Olá, {{recipientName}}.</p><p>{{companyName}} enviou o relatório da ordem <strong>{{customId}}</strong> — {{title}}.</p><p>{{summary}}</p></body></html>$html$
),
(
  'TRIAL_ENDING',
  'Seu período de teste no AtivHub termina em {{daysLeft}} dias',
  $html$<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>Olá, {{name}}.</p><p>O teste de {{companyName}} termina em {{daysLeft}} dias. Para continuar usando o AtivHub, assine o plano.</p><p><a href="{{link}}">Assinar agora</a></p></body></html>$html$
),
(
  'SUBSCRIPTION_ACTIVE',
  'Assinatura ativa no AtivHub',
  $html$<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>Olá, {{name}}.</p><p>O pagamento de {{companyName}} foi confirmado. O plano {{planName}} está ativo.</p></body></html>$html$
),
(
  'SUBSCRIPTION_PAST_DUE',
  'Não confirmamos o pagamento da assinatura',
  $html$<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>Olá, {{name}}.</p><p>Não confirmamos o pagamento de {{companyName}}. Regularize a assinatura para continuar usando o AtivHub.</p><p><a href="{{link}}">Ver assinatura</a></p></body></html>$html$
);
