# Carregamento progressivo

A tela de destino aparece no clique. O miolo que ainda depende do banco entra em shimmer, no formato da própria tela. A tela anterior não fica parada no lugar da próxima.

Este documento define a experiência. O passo a passo está em `docs/plano-carregamento-progressivo.md`.

## Problema

Cada página em `src/app/(app)` espera a permissão e a consulta inteira antes de devolver HTML. O único aviso é o texto "Carregando…" em `src/app/(app)/loading.tsx`, sem a forma da tela de destino.

Isso aparece em dois momentos:

1. **Troca de rota.** Abrir uma ordem, solicitação, ativo ou preventiva usa `router.push`. A página nova só existe quando a consulta termina (`loadWorkOrderDetail` e as equivalentes).
2. **A mesma rota.** Busca, filtro, paginação e troca lista/calendário usam `router.replace` dentro de `startTransition`. A tabela antiga permanece e a paginação só desabilita os botões. Vale para ordens, solicitações, ativos, preventiva, inventário, clientes e fornecedores.

Localizações, pessoas e configurações baixam a lista inteira antes da primeira pintura. A busca seguinte já é no navegador. O painel (`/`) espera o resumo inteiro. Perfil, empresa e assinatura esperam o registro antes de mostrar o formulário.

O menu não entra nessa espera. Na navegação entre telas o layout de `src/app/(app)/layout.tsx` permanece. A demora é o miolo.

## Regra

- O clique troca a URL na hora.
- Título, voltar, filtros e cabeçalho da tabela aparecem junto com a troca.
- Só a região que vem do banco fica em shimmer: linhas da tabela, cards do detalhe ou blocos do painel.
- Quando os dados chegam, essa região é substituída.
- O shimmer repete a estrutura real da tela (mesma grade, mesmos cards), não um texto solto no centro.
- O estado de espera tem `role="status"` e um texto só para leitor de tela.

## Como o App Router faz isso

Há dois mecanismos, e os dois são necessários.

**Troca de rota e primeira abertura.** Um `loading.tsx` no mesmo diretório da `page.tsx` é a casca que o Next mostra enquanto o servidor ainda não devolveu a página. Cada rota alvo tem o seu. O "Carregando…" do grupo `(app)` deixa de ser a experiência dessas rotas.

**Busca, filtro e página na mesma tela.** A página já está montada, então o `loading.tsx` não reaparece. O `navigating` que as listas já ligam no `startTransition` passa a trocar o miolo por shimmer na hora. A consulta continua na page de servidor; a resposta só substitui o shimmer.

O modal de criar e editar continua abrindo na hora. Em ordens, os dados do formulário já vêm com a lista. Essa abertura não entra no shimmer.

## Onde vale

| Tela | Rota | O que espera hoje | O que fica em shimmer |
| --- | --- | --- | --- |
| Painel | `/` | `loadMaintenanceOverview` | Cards e gráficos |
| Ordens | `/work-orders` | `listWorkOrdersScreen` | Linhas da tabela ou o calendário |
| Ordem | `/work-orders/[id]` | `loadWorkOrderDetail` e, para quem edita, `loadWorkOrderEditor` | Cabeçalho, Andamento, tarefas, mão de obra, peças e a coluna lateral |
| Preventivas | `/preventive` | `listPreventiveScreen` | Linhas da tabela |
| Preventiva | `/preventive/[id]` | `loadPreventiveDetail` | Cabeçalho, recorrência, ativos e ordens geradas |
| Solicitações | `/requests` | `listRequestsScreen` | Linhas da tabela |
| Solicitação | `/requests/[id]` | `loadRequestDetail` | Cabeçalho e o corpo da solicitação |
| Ativos | `/assets` | lista, locais e categorias | Linhas da tabela |
| Ativo | `/assets/[id]` | `loadAssetDetail` | Cabeçalho, ficha e histórico |
| Inventário | `/inventory` | `listPartsScreen` | Linhas da tabela |
| Clientes | `/customers` | lista de clientes | Linhas da tabela |
| Fornecedores | `/vendors` | `listVendorsScreen` | Linhas da tabela |
| Localizações | `/locations` | `listLocations` | Linhas, só na primeira abertura |
| Pessoas | `/people` | pessoas, equipes e papéis | Linhas, só na primeira abertura |
| Configurações | `/settings` | dados da página, checklists e categorias | Blocos da página, só na primeira abertura |
| Perfil | `/profile` | `getProfile` | Campos do formulário |
| Empresa | `/company` | `loadCompanyProfile` | Campos do formulário |
| Assinatura | `/subscription` | planos e acesso | Campos da página |
| Ativo público | `/s/[assetId]` | `lookupPublicAsset` | A ficha pública |

## Fora deste ajuste

- Login, verificação de e-mail e redefinição de senha. São formulários leves.
- A folha de impressão em `/work-orders/[id]/print`. Já tem indicador próprio e não é navegação do aplicativo.
- O menu, o sino e o catálogo de filtros. Continuam no layout e não são buscados de novo a cada página da tabela.
- Paginação no navegador das listas que já paginam no banco (ADR-0007).
