-- O relatório por e-mail passa a ser um link para a folha da ordem.
-- O identificador da ordem é o acesso: a página de impressão não exige login.

update public.email_template
set
  subject = 'Ordem de serviço {{customId}}',
  html = $html$<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1a1f2b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:32px"><tr><td><p style="margin:0 0 16px;font-size:16px;line-height:1.5">Olá, {{recipientName}}.</p><p style="margin:0 0 24px;font-size:16px;line-height:1.5">{{companyName}} enviou a ordem de serviço <strong>{{customId}}</strong> — {{title}}.</p><p style="margin:0 0 24px"><a href="{{link}}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:8px">Ver ordem de serviço</a></p><p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280">O botão abre somente esta ordem. Se não funcionar, copie o endereço:<br>{{link}}</p></td></tr></table></td></tr></table></body></html>$html$,
  updated_at = now()
where code = 'WORK_ORDER_REPORT';
