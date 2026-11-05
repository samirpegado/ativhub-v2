Ordem de Serviço

remover o campo Trabalhador principal. Deixar so responsaveis. remova a label adicionais.
por default mantenha nos filtros concluido marcado.
as atualizações devem deixar de existir e no lugar deve exibir uma timeline. que vai ser a data e hora que cada tarefa foi executada.
opção de poder adicionar uma foto na os
exibir os dados do cliente no cabeçario (pegar da relação com a localização)


Ativos
Adicionar botão com modal de filtros para facilitar a busca. Categoria, Status e Localização.
Ao selecionar os ativos aparecer uma opção de imprimir qr codes. Nesse caso exibir os qr codes numa unica impressão para facilitar para o usuario apenas imprimir e recortar

Fonecedores
remover o input Valor/Hora

Solicitações:
Opção de editar e apagar, Seleção do datatable
ao aprovar uma solicitação, abrir o modal da OS criada para que o usuário possa completar alguma informação
opção de anexar foto em solicitações.

Notificações:
Criar o icone de notificações ao lado do avatar do usuário. Mostrar o icone, com numero de solicitações pendentes. Ao clicar no icone de notificações na navegar para as solicitações, listando as pendentes.

Tarefas:
nas adições das tarefas na Pre-visualização, da a opção de manusear os inputs para que o usuário veja de fato como é o funcionamento de cada item
Remover status de subtarefa
a executação das tarefas deve deixar de ser atomica e cada tarfa deve registrar a data e hora que foi executada e um campo de adicionar um comentário sobre a tarefa.


Categorias de ativos:
Ocultar o input de cor e remover do datatable tbm. pra agora nao esta sendo util.

Manutenção orgânica x terceiros:
Suportar as duas frentes mantendo a tabela de clientes. Marcar um "cliente interno" por empresa (coluna customer.is_internal, índice único parcial where is_internal, no máximo um por tenant). A existência desse cliente interno define o comportamento, sem modo rígido por empresa.
No primeiro cliente (lista vazia em /customers), abrir modal perguntando: Manutenção própria (interna) ou Manutenção para terceiros. Se interna, criar o cliente automaticamente com os dados da empresa (tenant.name, telefone, site; tax_id em branco) e oferecer "vincular todas as localizações sem cliente a Minha empresa". Selo "Minha empresa" na lista. Modal dismissível, com ação secundária "Usar minha empresa como cliente" enquanto não existir interno.
Trocar de modalidade depois: orgânica -> terceiros não desfaz nada (interno convive com externos); para deixar de ser orgânica, excluir o cliente interno (localizações voltam a customer_id null via ON DELETE SET NULL, avisar que o QR fecha até religar).
Relatórios sem duplicar empresa e cliente: cabeçalho sempre mostra a empresa; bloco "Cliente" só aparece quando existe cliente e ele não é interno (casar com o ajuste do cabeçalho da OS acima).
Opcionais: pré-selecionar o cliente interno em localização/OS quando houver interno e nenhum externo; guardar settings.maintenanceMode só para textos e defaults. PIN e QR seguem iguais (interno também tem request_pin). Migração: coluna is_internal + índice + customers_screen retornando a flag.

na criação/fechamento da os alem de selcioanr o ativo o adminmistrador deve poder informar o status do ativo com um timestamp, de maneira que seja possivel depois contabilizar o tempo que a maquina ficou parada. e exibir uma especie de dashboard do ativo nos detalhes de cada ativo. 

----------------------------------------

visualização do tecnico

a visualização do tecnico deve ser diferente da do gestor.

padrão mobile first

deve ser mais enxuta, com cards no lugar de data table.

com as seguintes atribuições:

realizar ordens de serviço. (não pode criar novas ordens e nem editar, so o administrador)
cronemetrar o tempo
executar as atividades
adicionar anexos
adicionar peças a ordem

criar nova solicitação de ordem para determinado ativo

ativos, solicitações, peças e inventários - apenas leitura e detalhes. não pode editar e nem criar. apenas o administrador

primeira pagina do tecnico deverá ser um dashboard com as ordens atribuidas a ele, quantas ele ja fechou, quantidade a fechar

agenda do que ha pra ser executado.

pra o administrador um dashboard completo das ordens de serviço, com quem esta executando, 

ambos os dashboards precisam ter filtros por data, por tecnico (no caso do administrador), filtrar por localização, por tipo de OS, por status e por prioridade, (por situação Em atraso, no prazo)

na visualização do detalhe da os para o tecnico ele nao poderá alterar o status livremente. quando ele adicionar um registro de tempo ou iniciar o temporizador a os deve passar para em andamento. se ele pausar o temporizador ela vai para em espera e deve haver um botao para mudar para concluido. 

e nao pode concluir uma os sem tempo registrado, e se tiver taregas nao pode concluir sem finalizar as tarefas.