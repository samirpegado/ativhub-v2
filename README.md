# AtivHub

CMMS multiempresa para manutenção industrial e predial. Cada empresa enxerga só os próprios dados: ordens de serviço, ativos, localizações, pessoas e equipes.

## O que já está no app

- **Ordens de serviço**: lista, calendário, filtros e cadastro. O clique abre o detalhe, com temporizador, mão de obra, peças, arquivos, atualizações e relatório para impressão. Cada ordem tem tarefas (texto, número, status, inspeção ou múltipla escolha). Uma lista de verificação salva pode ser reutilizada em outras ordens.
- **Listas de verificação**: consulta e edição dos modelos de tarefas usados nas ordens.
- **Ativos**: cadastro com foto, localização e QR do próprio ativo.
- **Localizações**: endereço separado, com preenchimento pelo CEP.
- **Preventiva**: agendamentos que geram ordens de serviço na recorrência escolhida, por data ou depois que a ordem anterior é concluída.
- **Peças e inventário**: lista de peças com busca, filtro de estoque e paginação, e conjuntos de peças. O clique abre o detalhe, com movimentos de estoque. Usar a peça numa ordem baixa o estoque; remover devolve a quantidade.
- **Pessoas e equipes**: papéis Administrador, Técnico, Solicitante e Somente leitura. O administrador cria o acesso da pessoa na empresa.
- **Fornecedores e contratantes**: cadastro simples, em duas abas.
- **Solicitações**: fila interna do que chega pelo QR do ativo. Aprovar cria a ordem; recusar pede o motivo.
- **Configurações**: texto e permissões dos quatro papéis, e as listas de verificação.
- **Minha conta**: foto, dados pessoais, senha e atividade nas ordens. O cargo só é alterado por um administrador.
- **Minha empresa**: no menu do perfil, só para administrador. Nome, contato, endereço, logo e o PIN da solicitação pública.

Categorias não fazem parte desta versão.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 e Supabase (Postgres, Auth, Storage e RLS).

## Rodar localmente

Requisitos: Node.js 22 e um projeto Supabase com as migrations de `supabase/migrations` aplicadas.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). A primeira conta cria a empresa.

Variáveis em `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`NEXT_PUBLIC_SITE_URL` é opcional no ambiente local. No deploy, use a URL pública do app para o link de redefinição de senha.

## Deploy no Coolify

O `Dockerfile` gera a imagem na VM e escuta na porta **3000**. O build roda com prioridade baixa e heap do Node limitado a 1 GB, para a máquina fraca continuar respondendo. O deploy demora mais.

Crie o recurso como **Dockerfile**, apontando para este repositório. Marque estas variáveis como disponíveis no build:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

## Scripts

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run lint
npm run typecheck
```
