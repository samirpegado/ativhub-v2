# Plano do que falta

Categorias saem do menu e não serão cadastradas. O restante entra nesta ordem, porque a página pública depende da empresa e da fila interna de solicitações.

Menu lateral depois disso:

1. Ordens de serviço
2. Preventiva
3. Solicitações
4. Ativos
5. Localizações
6. Peças e inventário
7. Fornecedores e contratantes
8. Pessoas e equipes
9. Configurações

Listas de verificação saem do menu e passam para Configurações. Categorias somem. Minha empresa fica no menu do perfil, só para administrador.

Padrão de todas as listas novas: busca, filtro e paginação numa RPC, no máximo 20, payload completo da tela. Cadastro em modal. Clique abre o detalhe.

## 1. Fornecedores e contratantes

Cadastro simples. As tabelas `vendor` e `customer` já existem, com RLS. Não ligar a ordem, peça ou ativo nesta etapa.

Uma página, duas abas, no mesmo desenho de peças e conjuntos.

**Fornecedor:** empresa (obrigatório), contato (obrigatório), telefone, e-mail, site, tipo, descrição e valor/hora. Telefone usa `PhoneInput`. Valor usa `CurrencyInput`.

**Contratante:** nome (obrigatório), telefone, e-mail, site, tipo e descrição.

Lista com busca e paginação. O clique abre o painel com os dados e os botões de editar e excluir. Excluir só o cadastro; não há vínculo para proteger.

RPC: `vendors_screen` e `customers_screen`. O detalhe pode ser a própria linha, porque não há filhos.

## 2. Categorias

Fora do MVP. Remover o item desativado do menu. Não criar tela, formulário nem filtro. As colunas `category_id` ficam no banco, sem uso. Se o formulário da ordem ainda mostrar categoria quando existir alguma no banco, esconder o campo.

## 3. Configurações

Só administrador. Dois blocos na mesma página.

**Funções.** Os quatro papéis que já existem: Administrador, Técnico, Solicitante e Somente leitura. Não criar papel novo. Dá para editar a descrição (o texto que já aparece em Pessoas) e marcar, por área do menu, se o papel vê e se edita. Isso grava em `role.permissions`. O menu esconde o que o papel não vê. A ação no servidor recusa o que o papel não edita. O dono da empresa continua administrador.

**Listas de verificação.** A tela que hoje está em `/checklists` muda para dentro de Configurações. O endereço antigo redireciona. O uso da lista dentro da ordem não muda: continua copiando as tarefas para a ordem.

## 4. Cobrança na ordem

Uma escolha só, no cadastro da ordem: sem cobrança, por hora ou valor fixo. Sem nota, sem imposto e sem custo extra.

- **Sem cobrança:** nada muda no painel.
- **Valor fixo:** um campo de dinheiro na ordem (`service_amount`). É o preço do serviço.
- **Por hora:** cada lançamento de tempo e cada parada do temporizador grava a taxa da pessoa naquele momento em `labor.hourly_rate` (a coluna já existe). A taxa vem de `membership.rate`. Mudar o valor da pessoa depois não altera o que já foi lançado. O painel soma horas × taxa.

O painel e o relatório mostram o serviço (fixo ou horas) e, separado, o total das peças já lançadas. A soma dos dois é o total da ordem.

## 5. Solicitação pública

Quem está na frente do equipamento pede manutenção sem login. O QR sozinho não basta: qualquer pessoa que fotografasse a etiqueta poderia abrir solicitações sem fim.

**Como entra.** O QR do ativo, que hoje só guarda o id, passa a abrir `/s/{id do ativo}`. Na mesma página dá para digitar o código de barras, se a pessoa não escanear.

**O que trava o abuso.** A empresa define um PIN de 4 a 6 dígitos em Minha empresa. O PIN não entra no QR. Sem o PIN certo, a página não grava nada. Nome e telefone são obrigatórios. No máximo 3 solicitações ainda abertas por ativo no mesmo dia. A ação no servidor recusa o excesso.

**O que a pessoa preenche.** Nome, telefone, o que aconteceu. O ativo já veio do QR ou do código.

**Para onde vai.** Cai na tabela `request`, que já existe, com status pendente. O menu Solicitações lista isso para quem está logado: busca, paginação, painel. Aprovar cria a ordem com o título, a descrição, o ativo e a localização, e grava `request.work_order_id`. Recusar pede o motivo e marca `cancelled`. Pedido já aprovado não se edita.

## 6. Minha empresa

Não é a conta do usuário (`/profile`). É o cadastro da empresa, só para administrador, aberto pelo menu do perfil. Não entra na barra lateral.

Campos, no mesmo espírito do guia: nome, telefone, site e endereço. O nome já está em `tenant.name`. Telefone, site e endereço entram em `tenant.settings` para não inventar colunas. O logo sobe para `attachments/{tenant}/logo.jpg` e o caminho fica em `tenant.logo_url`, no mesmo fluxo da foto do ativo. O logo aparece nesta tela e no relatório impresso da ordem. A marca do AtivHub no menu não muda.

O PIN da solicitação pública também é definido aqui, guardado em `settings`, e não é exibido de volta por completo depois de salvo: a tela só diz se já existe e permite trocar.
