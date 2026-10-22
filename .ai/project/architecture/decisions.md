# Architecture Decisions

Use this file as a lightweight ADR log.

## Template

### ADR-0001 - Title

- **Status**: proposed | accepted | superseded
- **Context**: `TODO`
- **Decision**: `TODO`
- **Consequences**: `TODO`

### ADR-0007 - Listas por RPC

- **Status**: accepted
- **Context**: A tela de ordens fazia várias consultas e a paginação no
  navegador não combinava com filtro e busca. A função `work_orders_screen`
  passou a receber busca, filtros, `limit` e `offset` e a devolver o payload
  da tela inteiro. O clique usa `work_order_detail`.
- **Decision**: Toda lista em tabela segue esse padrão. A RPC filtra, busca e
  pagina no banco (no máximo 20 itens) e traz os dados completos da tela numa
  query. O servidor do Next chama a função com a sessão do usuário. O detalhe
  de um item clicado vem de outra RPC, também completa.
- **Consequences**: Peças e conjuntos já usam esse padrão. Localizações,
  ativos, pessoas, equipes e listas de verificação ainda paginam no navegador
  sobre o conjunto carregado. O calendário de ordens continua pedindo a mesma
  função sem filtro e sem paginação, só com a aba aberta.

### ADR-0006 - Build contido na VM

- **Status**: accepted
- **Context**: A VM de deploy tem pouca CPU. Cada push fazia o Coolify rodar
  `npm ci` e `next build` nela, e o host caía no meio do build. Publicar a
  imagem pronta no GHCR exigia token e login de registry no Coolify.
- **Decision**: O Coolify continua buildando o `Dockerfile`. O `npm ci` e o
  `next build` rodam com `nice -n 19`, `RAYON_NUM_THREADS=1`,
  `UV_THREADPOOL_SIZE=1` e heap do Node em 1 GB.
- **Consequences**: O deploy demora mais e a VM segue utilizável. Se o heap
  não bastar, o build falha dentro do container em vez de derrubar o host.
  As `NEXT_PUBLIC_*` continuam marcadas como disponíveis no build.

### ADR-0005 - Cache curto das telas autenticadas

- **Status**: accepted
- **Context**: Cada navegação esperava o servidor, e cada consulta da página
  chamava de novo a autenticação do Supabase.
- **Decision**: Deduplicar cliente, sessão e tenant com `cache()` do React no
  mesmo request. Manter `cacheComponents` desligado. URLs assinadas de uma
  lista saem numa única chamada. Não usar `staleTimes`: o padrão do Next para
  página dinâmica é buscar de novo a cada navegação, e o cache experimental de
  30s deixaria a tela desatualizada.
- **Consequences**: Cada clique ainda espera o servidor, mas a request não
  repete `getUser` nem uma assinatura por foto.

### ADR-0004 - Valor em real brasileiro

- **Status**: accepted
- **Context**: Campos de dinheiro precisam de um formato único, legível enquanto
  o usuário digita.
- **Decision**: `CurrencyInput` trata os dígitos como centavos e exibe
  `R$ 1.234,56`. `parseMoney` converte esse texto de volta para número.
- **Consequences**: Todo campo de valor novo usa esse componente.

### ADR-0003 - Cadastro em modal

- **Status**: accepted
- **Context**: Formulários em páginas `/new` e `/[id]/edit` quebram o fluxo da
  listagem e divergem do modelo visual (Atlas).
- **Decision**: Criar e editar entidades em modal (`FormDialog`) na própria
  listagem. Tabelas de listagem usam cabeçalho acinzentado.
- **Consequences**: Server actions de create/update revalidam a lista e
  devolvem sucesso, sem redirect.

### ADR-0002 - Endereço de localização em partes

- **Status**: accepted
- **Context**: Localização precisa de endereço brasileiro completo, consultável
  por CEP, sem perder o texto único usado em listagens.
- **Decision**: Guardar `postal_code`, `street`, `number`, `complement`,
  `neighborhood`, `city` e `state`. Manter `address` como string formatada.
  Preencher via ViaCEP no front.
- **Consequences**: Formulário de localização consulta um serviço externo;
  CEP incompleto é rejeitado no servidor.
