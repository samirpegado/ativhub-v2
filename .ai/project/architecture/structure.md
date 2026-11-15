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
  `ASAAS_IS_PROD` (padrão falso, sandbox). O webhook `asaas-webhook` só trata
  chamadas com `?app=ativhub`; as demais recebem 200 e são ignoradas. Ele confirma o
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
- `/` é o painel (`maintenance_overview`). Quem edita ordens vê a visão do administrador:
  ordens a fechar, em execução contra o tempo estimado, as OS ainda abertas,
  ativos parados, fechamento semanal e MTTR. O card Em andamento agora lista as OS ainda abertas de 5 em 5, só no navegador; os totais do card seguem a lista inteira. As duas visões usam o período do painel
  (esta semana, últimos 15 ou 30 dias; o padrão é 30 dias). O técnico vê a OS em execução,
  a fila desse período e o cumprimento no prazo.
  `/dashboard` redireciona para `/`. A lista de ordens fica em `/work-orders`.
  O técnico consulta as ordens sem alterar o cadastro: não vê a coluna de ações nem o botão de nova ordem. O clique na linha abre a página
  `/work-orders/[id]`. Quem edita vê o lápis, que abre o cadastro em modal, e o botão de nova ordem. Os filtros (status, prioridade, tipo, local, em atraso e vencimento de/até) ficam num modal ao
  lado desse botão. Status, prioridade e tipo são listas de múltipla escolha:
  nenhuma opção ou todas as opções não filtram a lista. A localização usa o catálogo já carregado, mostra o código antes do nome e o cliente abaixo. A lista também mostra o cliente abaixo da localização. O status segue a ADR-0010: o mesmo selo colorido da lista e do histórico do ativo. Os responsáveis aparecem pelo nome, em no máximo duas linhas. A listagem e os dados do formulário vêm da
  função `work_orders_screen`, chamada no servidor com a sessão do usuário,
  com no máximo 20 ordens por página e RLS do tenant. O intervalo de vencimento
  usa o dia civil em `America/Sao_Paulo`.
  Sem filtro na URL, a lista inclui abertas, em andamento, com status Pausado e concluídas.
  O formulário da ordem não pede cliente nem localização. O ativo é um só e se escolhe na mesma busca com filtros da preventiva; cliente e localização gravados são os do ativo. Aberto a partir do ativo, o formulário mostra esse ativo direto, sem a busca.
  Também pede responsáveis e não edita mais o trabalhador principal
  (`work_order.primary_user_id` permanece no banco). A página da ordem aceita até 3 fotos
  (PNG, JPG ou WebP, no máximo 2 MB). No celular, a foto oferece galeria ou câmera. Cada foto é gravada em JPEG com o maior lado em 512 px e qualidade 0,6. O calendário pede a mesma função com todas as ordens, sem esses filtros. O clique na ordem abre
  `/work-orders/[id]`, que chama `work_order_detail()` no servidor. Enquanto essa consulta não volta, a rota mostra o esqueleto da página (voltar, Andamento e as colunas). O mesmo vale para a solicitação, o ativo e a preventiva: o esqueleto aparece antes da consulta, e a linha da lista abre a ficha por link. Toda lista em tabela deve seguir esse padrão:
  filtros, busca e paginação na RPC, com a query devolvendo os dados completos da tela.
  Enquanto a busca, o filtro, a página ou a troca lista/calendário não voltam, só as linhas (ou o calendário) entram em shimmer; a barra permanece e o campo de busca não perde o foco. A primeira abertura de ordens, solicitações, ativos, preventiva, inventário, clientes, fornecedores e localizações mostra essa mesma casca. A busca de localizações continua no navegador.
  Localizações, ativos, pessoas, equipes e listas de verificação ainda paginam 20 itens no navegador.
  Ativos, ordens e preventivas marcam os registros da página e excluem o lote por server action.
  A aba Calendário mostra dia, semana e mês. A ordem entra no dia do início estimado,
  ou do vencimento quando não há início, com a sigla do tipo. No dia e na semana, o início estimado vira horário e a duração estimada define o tamanho. O clique no dia lista as ordens dele abaixo do calendário; o clique na ordem abre o detalhe. Concluir grava `completed_by`/`completed_on`; a primeira
  saída de `OPEN` (exceto para `ON_HOLD`) grava `first_time_to_react`.
  Iniciar o temporizador passa a ordem para em andamento e pausar passa para pausada.
  O técnico só inicia, conclui, responde tarefas, envia fotos, registra tempo e lança peças nas ordens em que é um dos responsáveis. O técnico conclui por um botão próprio. A ordem só pode ser concluída com tempo de mão de obra registrado e todas as tarefas executadas. Concluir para o temporizador e grava o tempo que estava correndo.
  Concluída, a ordem não aceita tempo, tarefas nem peças até um gestor alterar o status. O gestor troca o status num modal.
  As tarefas pertencem à ordem. Uma lista nomeada (`checklist`) guarda uma
  cópia reutilizável: ao escolhê-la, as tarefas entram na ordem sem vínculo
  permanente com o modelo. Os modelos ficam em Configurações; `/checklists`
  redireciona para lá. A ordem pode ser sem cobrança, por hora ou valor fixo.
  Por hora, o cadastro pede o valor da hora daquele serviço e a cobrança multiplica esse valor pelas horas registradas.
  Na página da ordem, o card de tarefas vem primeiro e o botão Iniciar OS fica junto das ações principais enquanto a ordem não está concluída. Ele liga o temporizador;
  o lançamento manual e o tempo do temporizador podem ser apagados. A página também mostra peças
  e o relatório para impressão. Relatório PDF abre a folha de impressão, no tamanho fixo de uma página. Essa folha também abre sem login: o identificador da ordem é o acesso, e só mostra essa ordem. O envio por e-mail, visível com a ordem concluída, manda um botão para essa folha pelo template WORK_ORDER_REPORT. As fotos ficam na coluna lateral, no máximo 3. O nome longo é cortado com reticências. As tarefas aparecem na ordem em que foram cumpridas, com a data da resposta; as pendentes ficam no fim. Cada uma abre o próprio registro e pode ser cumprida fora da ordem da lista. Cada tarefa guarda `executed_at` e `comment`; editar a ordem preserva essa execução.
  A subtarefa é um item concluído ou pendente. A tabela `work_order_update` permanece, sem tela de escrita.   A peça da ordem é buscada no servidor pelo nome, descrição ou código de barras.
  Ao lançar, o estoque baixa quando `non_stock` é falso, e remover a linha devolve a quantidade.
- `/preventive` lista os agendamentos, sem localização nem ativos. O código usa o prefixo PV-. Um agendamento não é editado: a alteração é excluir e criar outro. `preventive_screen` recebe busca, prioridade,
  limit e offset, no máximo 20, e devolve o payload da tela. O clique abre
  `/preventive/[id]`, que chama `preventive_detail`. Cada agendamento define a recorrência (dia, semana, mês
  ou ano, pela data marcada ou pela conclusão da ordem anterior) e os dados da
  ordem que será criada. `generate_due_preventive_work_orders` cria a ordem
  às 2h da manhã em Brasília no dia marcado, para ela já estar pronta quando o
  trabalho começa. O cron roda no início de cada hora e também ao abrir as ordens
  ou a preventiva. Cinco ordens seguidas sem reação pausam o agendamento.
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
  contratantes vai para clientes, o restante para fornecedores. `/requests` lista solicitações, sem coluna de ações. O código usa o prefixo S-.
  O clique abre `/requests/[id]`, no mesmo padrão visual da ordem. Pendente é a que não foi recusada, não está em tratamento e ainda não tem ordem. Em tratamento é a mesma solicitação aberta. O ativo da solicitação é um só e se escolhe na mesma busca com filtros da preventiva. Aberto a partir do ativo, o formulário mostra esse ativo direto, sem a busca. Por enquanto toda solicitação é de serviço. Com usuário logado, ela aceita uma foto: maior lado em 512 px, JPEG com qualidade 0,6 e no máximo 2 MB. No celular, a foto oferece galeria ou câmera. Quem edita pode alterar ou excluir
  essas, inclusive em lote, na página da solicitação. O administrador também exclui uma solicitação já aprovada; a ordem criada permanece e deixa de apontar para a solicitação. Aprovar chama `approve_request` e abre o formulário da ordem criada.
  O cabeçalho mostra um sino com a quantidade de solicitações pendentes ainda não lidas, exceto o técnico. `request.read_at` guarda a primeira abertura pelo administrador; a abertura pelo técnico não preenche o campo. Na lista, a solicitação não lida aparece em negrito. Ao lado, quem vê ativos tem um QR code: a câmera lê a etiqueta e abre `/assets/[id]`.
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
  O cadastro e a edição do ativo não enviam imagem. `asset.category_id` aponta para uma categoria do tipo `ASSET`.
  O campo `asset.area` aparece como local de instalação. Os filtros da lista seguem a ADR-0009: status é lista suspensa de múltipla escolha. Categoria e localização vêm do catálogo carregado com a aplicação. Nada marcado, ou todos os status marcados, não restringe a lista. Na lista e no filtro de local, o nome do cliente aparece abaixo da localização. O clique no ativo abre
  `/assets/[id]`. O administrador abre Nova OS e o técnico abre Nova solicitação num modal nesta página, já com o ativo escolhido. Depois de criar, a navegação vai para o detalhe da ordem ou da solicitação. O status aparece ao lado do nome. A RPC `asset_detail` devolve confiabilidade, custos e o histórico
  de ordens paginado, no máximo 10 por página. MTTR e MTBF acima de 24 horas aparecem em dias, horas, minutos e segundos.
  A planilha de ativos é CSV, importada e exportada na própria lista. O técnico não vê o botão de exportar.
  A localização e a categoria da planilha são opcionais: nome existente associa, nome novo cria o cadastro, e célula vazia deixa o ativo sem esse vínculo. A categoria nova recebe uma cor aleatória.
  A ordem tem tipo (preventiva, corretiva, preditiva), cliente opcional e sinal de atraso.
  A lista filtra por localização, tipo e atraso. Datas de início e vencimento mudam em lote;
  a exclusão em lote arquiva. O relatório da ordem também sai por e-mail.
  A preventiva guarda vários ativos em `pm_asset` e gera uma ordem para cada um. Os responsáveis da preventiva ficam em `pm_assignee` e entram na ordem em `work_order_assignee`. A página do agendamento lista cada ativo com a localização e o cliente, e as ordens geradas, 10 por página. O card da ordem não repete esses dados.
  O novo agendamento exige prioridade, vencimento, pelo menos um responsável, pelo menos um ativo e ao menos uma tarefa. O botão Salvar só fica ativo com os campos obrigatórios preenchidos. O formulário busca os ativos no servidor e lista todos os que batem com a busca e os filtros, sem limite de quantidade. Os filtros (status, categoria e localização) ficam num modal e, ao aplicar, a lista é gerada de novo na hora. Um botão marca todos os ativos da busca e dos filtros e, com todos marcados, passa a desmarcar.
