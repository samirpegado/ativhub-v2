# Coding Rules

## General

- Prefer existing patterns over introducing a new architecture.
- Keep functions and components focused.
- Avoid hidden side effects.
- Preserve clear naming and typed boundaries.
- Add comments only when the intent is not obvious from the code.

## Reference frontend (`frontend-cmms/`)

`frontend-cmms/` é o Atlas CMMS usado **somente** como modelo visual e de UX.
Não faz parte do app AtivHub. Não importar, não compilar, não copiar a
arquitetura React/MUI/Redux. Regras de negócio e tokens vêm de
`docs/ativhub-mvp-plan.md`.

## CRUD UI

Cadastro e edição de entidades abrem em **modal** na listagem (`FormDialog`).
Não criar rotas `/new` ou `/[id]/edit` para formulários.

Campos de valor usam `CurrencyInput`. A digitação vira real brasileiro
(`R$ 1.234,56`); o servidor lê com `parseMoney`.

Telefone usa `PhoneInput`. A digitação vira `(00) 0000-0000` ou
`(00) 00000-0000`; o servidor grava nesse formato.

## Change policy

- Prefer small edits over broad rewrites.
- Do not rename files or folders without clear repository-wide benefit.
- Do not add dependencies unless the repository clearly benefits.
- When introducing a new pattern, document it in `.ai/project/architecture/decisions.md`.
