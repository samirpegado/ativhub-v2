# Project Structure

## Intent

Describe the real structural organization of the repository and the architectural boundaries.

<!-- BEGIN: AUTO-STRUCTURE -->
## Detected top-level directories
- `.agents/`
- `.ai/`
- `.cursor/`
- `.docs/`
- `.github/`
- `.kiro/`
- `.vscode/`
- `docs/`
- `public/`
- `scripts/`
- `src/`
- `supabase/`

## Detected top-level files
- `.env.example`
- `.env.local`
- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `components.json`
- `eslint.config.mjs`
- `GEMINI.md`
- `next-env.d.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `README.md`
- `tsconfig.json`
- `tsconfig.tsbuildinfo`
<!-- END: AUTO-STRUCTURE -->

## Manual notes

- App Next.js (App Router) vive em `src/`. `frontend-cmms/` é o Atlas CMMS usado
  só como modelo visual/UX — não entra no build, no tsconfig nem no git.
- Schema e RLS no Supabase projeto `ativhub`; SQL versionado em
  `supabase/migrations/`.
- E-mail transacional sai só da edge `send-email`, que lê `email_template`
  (global, sem tenant) e chama a Brevo. O Next não fala com a Brevo. A função
  aceita apenas a service role. `email_dispatch` guarda a chave de idempotência,
  sem o corpo da mensagem.
- O cadastro em `/register` chama a edge `account-access`, que cria o usuário
  sem confirmar o e-mail, a empresa e o papel de administrador. O link e o código
  ficam hasheados em `adm_otp_emails` por 3 horas. O app só abre depois de
  `email_confirmed_at`. A recuperação de senha usa a mesma tabela.
- Cada empresa nasce com 14 dias de teste no plano `STANDARD` (R$ 99,90/mês).
  O catálogo fica em `plan` e a situação em `subscription`. O administrador abre
  o link do Asaas em `/subscription`. A edge `asaas-create-checkout` usa
  `ASAAS_IS_PROD` (padrão falso, sandbox). O webhook `asaas-webhook` confirma o
  pagamento. Sem teste vigente ou assinatura ativa, só `/subscription`, o perfil
  e o logout continuam disponíveis.
- Auth via `@supabase/ssr` (cookies) + `src/proxy.ts` (convenção Next 16).
- Tenant ativo em `auth.jwt().app_metadata.tenant_id`, lido por
  `current_tenant_id()`.
- `/profile` é a conta do usuário: foto, atividade de OT e dados pessoais.
  A foto é reduzida no navegador para no máximo 256×256 em JPEG (qualidade 0,72) antes do Storage.
  Cargo (`job_title`) só muda com papel ADMIN.
- `/people` lista pessoas e equipes. Nova pessoa chama a edge function
  `create-tenant-user`, que cria o usuário no Auth e a membership no tenant.
  Papéis de cadastro: Administrador, Técnico, Solicitante e Somente leitura.
  O texto de cada papel vem de `role.description`.
- `/dashboard` é o painel das ordens (`work_orders_dashboard`) de quem edita: totais,
  agenda, filtros e quem está com o temporizador ligado. O item só aparece no menu
  quando a pessoa pode editar ordens. `/` continua a lista de ordens para quem edita.
  O técnico entra em `/` e vê só as ordens atribuídas, em cards, e executa sem alterar
  o cadastro. A lista abre o cadastro em modal. Os filtros (status,
  prioridade, tipo, local, em atraso e vencimento de/até) ficam num modal ao
  lado de "+ Ordem de serviço". A listagem e os dados do formulário vêm da
  função `work_orders_screen`, chamada no servidor com a sessão do usuário,
  com no máximo 20 ordens por página e RLS do tenant. O intervalo de vencimento
  usa o dia civil em `America/Sao_Paulo`.
  Sem filtro na URL, a lista inclui abertas, em andamento, em espera e concluídas.
  O formulário da ordem pede responsáveis e não edita mais o trabalhador principal
  (`work_order.primary_user_id` permanece no banco). O painel da ordem aceita foto
  além de arquivo. O calendário pede a mesma função com todas as ordens, sem esses filtros. O clique na ordem chama
  `work_order_detail()` no servidor para o painel. Toda lista em tabela deve seguir esse padrão:
  filtros, busca e paginação na RPC, com a query devolvendo os dados completos da tela.
  Localizações, ativos, pessoas, equipes e listas de verificação ainda paginam 20 itens no navegador.
  Ativos, ordens e preventivas marcam os registros da página e excluem o lote por server action.
  A aba Calendário
  usa FullCalendar: o evento fica no início estimado, ou no vencimento quando
  não há início. O clique abre o detalhe; um dia vazio abre uma ordem nova
  com esse vencimento. Concluir grava `completed_by`/`completed_on`; a primeira
  saída de `OPEN` (exceto para `ON_HOLD`) grava `first_time_to_react`.
  As tarefas pertencem à ordem. Uma lista nomeada (`checklist`) guarda uma
  cópia reutilizável: ao escolhê-la, as tarefas entram na ordem sem vínculo
  permanente com o modelo. Os modelos ficam em Configurações; `/checklists`
  redireciona para lá. A ordem pode ser sem cobrança, por hora ou valor fixo.
  O clique
  na ordem abre um painel com status, temporizador, mão de obra (lançamento manual
  e o tempo do temporizador, que pode ser apagado), peças usadas, arquivos, relatório para impressão e a aba
  Timeline. Cada tarefa guarda `executed_at` e `comment`; editar a ordem preserva essa execução.
  A subtarefa é um item concluído ou pendente. A tabela `work_order_update` permanece, sem tela de escrita. A peça lançada vem do inventário: o estoque baixa, exceto quando
  a peça não controla estoque, e remover a linha devolve a quantidade.
- `/preventive` lista os agendamentos. `preventive_screen` recebe busca, prioridade,
  limit e offset, no máximo 20, e devolve o payload da tela. O clique chama
  `preventive_detail`. Cada agendamento define a recorrência (dia, semana, mês
  ou ano, pela data marcada ou pela conclusão da ordem anterior) e os dados da
  ordem que será criada. `generate_due_preventive_work_orders` cria a ordem
  quando a data chega. Ela roda de hora em hora e também ao abrir as ordens ou
  a preventiva. Cinco ordens seguidas sem reação pausam o agendamento.
- `/inventory` lista peças e conjuntos. `parts_screen` e `part_sets_screen`
  recebem busca, filtro de estoque (peças), limit e offset, no máximo 20, e
  devolvem o payload da tela. O clique chama `part_detail` ou `part_set_detail`.
  A quantidade é a fonte da verdade; um ajuste grava `stock_movement`. O consumo
  numa ordem grava `WO_CONSUME` e a remoção grava `WO_RETURN`. Peça sem
  controle (`non_stock`) não entra no alerta de estoque baixo nem muda a quantidade
  ao ser usada. Conjunto agrupa
  peças e o custo é a soma dos custos unitários.
- `/customers` lista clientes e `/vendors` lista fornecedores. O cadastro de
  fornecedor não pede mais valor/hora (`vendor.rate` permanece no banco). As duas telas
  usam a permissão `parties`. `/parties` redireciona: a aba antiga de
  contratantes vai para clientes, o restante para fornecedores. `/requests` lista solicitações.
  Pendente é a que não foi recusada e ainda não tem ordem. Quem edita pode alterar ou excluir
  essas, inclusive em lote. Aprovar chama `approve_request` e abre o formulário da ordem criada.
  O cabeçalho mostra um sino com a quantidade pendente para quem vê solicitações.
  `/settings` (só administrador) edita os quatro papéis, as listas de verificação e as
  categorias de ativo (`category.type = ASSET`, cor oculta na tela e preservada em `category.color`), cada um na sua aba. `/checklists`
  redireciona para a aba de listas. A categoria do ativo também se cria no formulário
  do ativo. Minha empresa fica em `/company`, aberta pelo
  menu do perfil, não pela barra lateral. O QR do ativo abre `/s/{id}`, também com sessão iniciada.
  O diálogo do QR imprime uma etiqueta com o código, o QR e o nome, para colar no ativo.
  Cada cliente tem um PIN de 4 dígitos (`customer.request_pin`), gerado no
  cadastro e editável por quem altera clientes. CPF ou CNPJ
  (`customer.tax_id`) é opcional, validado no formulário e único por empresa. A localização aponta para um
  cliente (`location.customer_id`); sem esse vínculo o QR do ativo não abre.
  O PIN antigo da localização e o da empresa (`settings.requestPin`) saíram.
  Na página pública, o PIN do cliente da localização emite um token de 30
  minutos (`public_access_session`). Com ele, o visitante vê as ordens não
  arquivadas do ativo, com custos, baixa o relatório e abre solicitação. Dez
  PINs errados em 15 minutos travam o cliente. Ativo sem localização não abre.
  `public_session_asset` e `public_asset_history` não são concedidas a `anon`.
- CRUD autenticado em `/locations` e `/assets` (lista + modal de criar/editar).
  Endereço de localização em campos separados; `address` é o texto formatado.
  A imagem do ativo fica em `attachments/{tenant}/assets/` e o caminho em
  `asset.image_url`. `asset.category_id` aponta para uma categoria do tipo `ASSET`.
  O campo `asset.area` aparece como local de instalação. O clique no ativo abre o
  histórico em `asset_detail`: ordens com custo de peças e mão de obra, e paradas.
  A planilha de ativos é CSV, importada e exportada na própria lista.
  A localização e a categoria da planilha são opcionais: nome existente associa, nome novo cria o cadastro, e célula vazia deixa o ativo sem esse vínculo. A categoria nova recebe uma cor aleatória.
  A ordem tem tipo (preventiva, corretiva, preditiva), cliente opcional e sinal de atraso.
  A lista filtra por localização, tipo e atraso. Datas de início e vencimento mudam em lote;
  a exclusão em lote arquiva. O relatório da ordem também sai por e-mail.
  A preventiva guarda vários ativos em `pm_asset` e gera uma ordem para cada um.
