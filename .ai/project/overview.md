# Project Overview

## Identity

- **Project name**: AtivHub
- **Internal codename**: ativhub-v2
- **Repository purpose**: Reconstruir o CMMS como SaaS multi-tenant (Next.js + Supabase)
- **Primary team / squad**: Devfy
- **Primary stakeholders**: operação de manutenção industrial/predial
- **Primary users**: administradores, técnicos e solicitantes de manutenção
- **Central problem**: gerir ordens de serviço, preventiva, ativos e estoque por empresa

## Business context

O AtivHub é um CMMS (gestão de manutenção). O MVP cobre o fluxo operacional
básico: OT, preventiva, solicitações, ativos, localizações, peças, pessoas e
equipes — sem workflows, portal público, cobrança ou PO. O front em
`frontend-cmms/` é só modelo visual (Atlas); o app é o Next.js em `src/`.

<!-- BEGIN: AUTO-SUMMARY -->
Resumo inferido automaticamente a partir do repositório:

- Variante detectada: `nextjs-web`
- Diretórios principais: `.agents/`, `.ai/`, `.cursor/`, `.docs/`, `.github/`, `.kiro/`, `.vscode/`, `docs/`
- Arquivos principais: `.env.example`, `.env.local`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `components.json`, `eslint.config.mjs`, `GEMINI.md`
<!-- END: AUTO-SUMMARY -->

## Core flows

- Cadastro do dono: cria tenant + papéis default + membership ADMIN
- Operação: solicitação → aprovação → ordem de serviço → conclusão
- Preventiva: agenda gera OT; estoque move com consumo/estorno na OT
- Cadastro: localizações (endereço por CEP/ViaCEP), ativos ligados a elas,
  pessoas (papel, nome, e-mail, telefone, senha) e equipes

## Out of scope

- Pedidos de compra, medidores completos, workflows, portal público, cobrança (v2)
- Código do `frontend-cmms/` (referência visual apenas)
