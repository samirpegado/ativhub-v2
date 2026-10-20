-- Endereço de localização em campos separados (Brasil / ViaCEP).
-- `address` permanece como texto formatado para listagem.

alter table public.location
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text;

comment on column public.location.postal_code is 'CEP';
comment on column public.location.street is 'Logradouro';
comment on column public.location.number is 'Número';
comment on column public.location.complement is 'Complemento';
comment on column public.location.neighborhood is 'Bairro';
comment on column public.location.city is 'Cidade';
comment on column public.location.state is 'UF';
comment on column public.location.address is 'Endereço completo formatado a partir dos campos separados';
