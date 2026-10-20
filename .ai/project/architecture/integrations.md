# Integrations

## External services

- **ViaCEP** (`https://viacep.com.br/ws/{cep}/json/`): preenchimento de
  endereço no cadastro de localização, chamado no browser ao completar 8
  dígitos do CEP. Sem autenticação.

## Internal services

- Edge function `create-tenant-user`: administrador autenticado cria um
  usuário (e-mail e senha) e a membership no tenant ativo. JWT obrigatório.

## Contracts and interfaces

- `TODO`
