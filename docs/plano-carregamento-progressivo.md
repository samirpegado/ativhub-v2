# Plano de implementação — Carregamento progressivo

Base: `docs/carregamento-progressivo.md`. Next.js 16 (App Router, Turbopack), sem `cacheComponents`. As consultas continuam nas pages e nas RPCs atuais. Não há migration.

A ordem abaixo é a de entrega. A fase 0 é pré-requisito de todas. A fase 1 é o modelo; as seguintes repetem o mesmo desenho.

## Convenções

- Shimmer com `animate-pulse` do Tailwind, nas cores já usadas nas superfícies (`bg-[#f5f7fb]` / `bg-muted`). Sem biblioteca nova.
- Cada bloco de espera expõe `role="status"` e um texto apenas para leitor de tela ("Carregando").
- `loading.tsx` fica no mesmo diretório da `page.tsx` e desenha a casca daquela rota.
- Nas listas que já têm `startNavigation`, `navigating === true` substitui o miolo (linhas ou calendário) pelo shimmer e mantém título, busca, filtros e cabeçalho. A paginação deixa de ser o único sinal de espera.
- Clique que abre outro registro usa `<Link>`, para o Next poder pré-carregar a rota. Busca, filtro e página continuam com `router.replace` dentro de `startTransition`.
- `requireArea` permanece na page, antes de devolver a casca. O que sai de cima da espera é a consulta de dados, não a permissão.
- Conferir no navegador: o clique em uma linha mostra o esqueleto da tela de destino, e busca, filtro e paginação trocam só o miolo.

## Fase 0 — Primitiva

**Objetivo.** Uma peça só de shimmer, reutilizada pelo `loading.tsx` e pelas listas.

Arquivos novos em `src/components/loading/`:

- `shimmer.tsx`: retângulo com `animate-pulse`.
- `table-skeleton.tsx`: cabeçalho opcional e N linhas. Recebe a quantidade de colunas.
- `detail-skeleton.tsx`: blocos empilhados (título, faixa, cards). As páginas de detalhe compõem com ele.
- `form-skeleton.tsx`: rótulo e campo, repetidos.

Nenhuma page muda nesta fase.

## Fase 1 — Detalhe da ordem

**Objetivo.** Clicar uma ordem abre na hora a estrutura da página. Os dados preenchem depois. Esta fase fixa o modelo das outras.

Arquivos:

- `src/app/(app)/work-orders/[id]/loading.tsx`: voltar, título, card de Andamento, coluna principal (tarefas, mão de obra, peças) e coluna lateral (informações, responsáveis, fotos).
- `src/components/work-orders/work-orders-view.tsx`: o clique da linha e o do calendário viram `<Link href={/work-orders/${id}}>`. Não entram em `startTransition`.

A page `work-orders/[id]/page.tsx` continua buscando o detalhe. O `loading.tsx` cobre o intervalo. Não fatiar a page nesta fase.

**Pronto quando.** Na lista, o clique mostra o esqueleto da ordem antes de título, tarefas e Andamento existirem. Atualizar a URL direto em `/work-orders/[id]` também mostra esse esqueleto. O selo de status e o restante dos dados aparecem juntos, quando a consulta termina.

## Fase 2 — Outros detalhes

Repetir a fase 1.

| Rota | `loading.tsx` | Clique que vira `<Link>` |
| --- | --- | --- |
| `/requests/[id]` | Cabeçalho e corpo da solicitação | Linha em `requests-view.tsx` |
| `/assets/[id]` | Cabeçalho, ficha e histórico | Linha em `assets-view.tsx` e o retorno do QR em `asset-qr-scan-dialog.tsx` |
| `/preventive/[id]` | Cabeçalho, recorrência, ativos e ordens geradas | Linha em `preventive-view.tsx` |

Também os atalhos que abrem ordem ou solicitação a partir do ativo (`asset-detail.tsx`) e do painel (`admin-dashboard.tsx`, `tech-dashboard.tsx`).

## Fase 3 — Listas que paginam no banco

**Objetivo.** Busca, filtro, paginação e a troca lista/calendário mostram shimmer no miolo sem desmontar a barra da tela.

Em cada view, no ramo em que `navigating` é verdadeiro:

- a barra (título, busca, filtros, botão de criar) permanece;
- o corpo da tabela, ou o calendário, vira `table-skeleton`;
- a paginação pode continuar desabilitada enquanto `navigating` for verdadeiro.

Arquivos, nesta ordem:

1. `work-orders-view.tsx`. No calendário, o texto "Carregando calendário…" também vira o skeleton quando `navigating` está ligado. O `dynamic(..., { loading })` do calendário usa o mesmo skeleton.
2. `requests-view.tsx`
3. `assets-view.tsx`
4. `preventive-view.tsx`
5. `inventory-view.tsx`
6. `parties-view.tsx`, usado por clientes e fornecedores

Cada uma ganha `loading.tsx` ao lado da page, com a mesma casca (título, faixa de filtros e linhas). Cobre a primeira abertura e o acesso direto pela URL.

`WorkOrdersView` e as demais continuam recebendo os dados pela page. Não há segunda consulta para o formulário do modal.

**Pronto quando.** Digitar na busca, aplicar um filtro e mudar de página substituem as linhas pelo shimmer na hora. O campo de busca não perde o foco. Ao concluir, as linhas novas entram no lugar.

## Fase 4 — Painel

- `src/app/(app)/loading.tsx` deixa de ser o texto central para quem entra em `/`. O painel ganha `src/app/(app)/page.tsx` coberto por um `loading.tsx` específico só se o Next não confundir com o do grupo. Como `/` é a page do grupo `(app)`, o próprio `src/app/(app)/loading.tsx` passa a ser o esqueleto do painel (grades de cards). As outras rotas usam o `loading.tsx` da própria pasta, que tem prioridade na navegação para elas.
- `src/app/(app)/page.tsx` segue aguardando `loadMaintenanceOverview`. O esqueleto do `loading.tsx` é o que o usuário vê nesse intervalo.
- O seletor de período em `admin-dashboard.tsx` e `tech-dashboard.tsx` usa `router.push`. Enquanto a transição dura, os cards entram em shimmer pelo mesmo `useTransition` da fase 3, se o componente já puder saber que a troca está em andamento. Se não der para sinalizar sem refazer o painel, o `loading.tsx` da rota basta para a troca de período, e isso fica registrado na verificação.

## Fase 5 — Listas carregadas inteiras

A busca dessas telas continua no navegador, dentro de `SearchableTable` e das views atuais. O shimmer é só a primeira abertura.

`loading.tsx` ao lado de:

- `src/app/(app)/locations/page.tsx`
- `src/app/(app)/people/page.tsx`
- `src/app/(app)/settings/page.tsx`

A page segue aguardando a lista. Não mover busca nem paginação para o banco.

## Fase 6 — Formulários e página pública

`loading.tsx` com `form-skeleton`:

- `src/app/(app)/profile/page.tsx`
- `src/app/(app)/company/page.tsx`
- `src/app/(app)/subscription/page.tsx`

`src/app/s/[assetId]/loading.tsx` repete a ficha pública (identificação do ativo e a área do histórico), sem o menu do aplicativo.

A folha `src/app/(print)/work-orders/[id]/print/loading.tsx` permanece como está.

## Verificação

Em cada fase, no navegador, com a rede lenta o bastante para o intervalo ser visível:

- Abrir a tela pelo menu e pela URL direta mostra a casca, depois os dados.
- Voltar pelo botão do navegador não deixa a tela anterior congelada.
- Na ordem: o clique na lista mostra voltar, Andamento e as colunas antes dos textos reais.
- Nas listas da fase 3: busca, filtro e página trocam só as linhas; o texto digitado permanece.
- Leitor de tela anuncia o estado de carregamento uma vez, pelo `role="status"`.

## Fora do plano

- Encurtar as RPCs ou quebrar o payload da ordem em várias consultas.
- Cache de rota (`cacheComponents` continua desligado).
- Alterar o layout para buscar sino e catálogo de outro jeito.
