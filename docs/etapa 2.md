Ativos:
Importação/Exportação de ativos com planilha
Adicionar categoria do ativo (Elétrica/ civil/ refrigeração etc.) adição dessas categorias em modal separado. o crud, bem como o datatable deve ficar nas configurações em outra aba.
Colorir Status "operacional" como TAG
Adicionar localidade do ativo Ex: Bloco A, Salão de festas etc. novo campo na tabela que seja pra dar detalhes onde o ativo esta instalado/armazenado
Histórico de manutenções do ativo. Elaborar como time line, incluindo o custo com peças. (importante pra definir se o custo operacional de manutenção do ativo é viável).
Adicionar marcadores para fazer ação em grupo. (excluir)

 
Ordens de serviço:
Colocar para aparecer nas ordens de serviço o tipo de OS. (Preventiva, corretiva ou preditiva) Importante
Sinalizar OS em atraso
Adicionar marcadores para fazer ação em grupo (Alterar data de iniciar e data de finalizar, excluir).
Adicionar filtro de localização e tipo


Preventivas
Adicionar marcadores para fazer ação em grupo. (excluir)
Adicionar vário ativos em uma mesma programação para que o disparo das OS seja feito para todos.
Ordem de serviço. Ter a opção de enviar relatórios por email para cliente.

dados para envio de e-mail ja estao nas secrets do supabase para as edge functions
BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME


implementar o cadastro de nova conta.
frontend-cmms ver aqui o formulário.

é um formulário simples, mas no nosso caso precisamos implementar uma logica de confirmação de e-mail via otp

criar uma tabela para gerir no nosso lado esse fluxo. adm_otp_emails

quando o usuario for cadastrado associar ao id dele um otp/token com prazo de expiração de 3h.

pode ser um formulatio pra o usuario adicionar o codigo otp/token na criando a conta, ou um link de ativação (talvez o link seja mais pratico, analise o que é melhor para o contexto do app)

a logica deve impedir o acesso ao app ate que o e-mail esteja verificado.

implementar tbm a logica de recuperação de senha usando a mesma logica de otp/token ou link de recuperação.

e-mails
criar uma tabela de templates de email
para ficar mais facil a alteraçao do corpo dos emails sem precisar mexer nas edges.

implementar a logica de assinatura.
por default novos usuarios tem 14 dias de uso free do software, depois ja tem que pedir a assinatura

o checkout será pelo asaas a chave de api ja esta em ASAAS_API_KEY_SANDBOX
melhor que a logica de assinatura seja atraves do checkout usando o link de pagamento do proprio asaas pra facilitar e nao precisar-mos criar telas de formulario de checkout.

criar apenas o webhook que vai processar o pagamento. acredito que o dado a se passar no momento do checkout seja o tenant_id para identificar a assinatura. por enquanto o valor será de 99,90

