-- Executar depois da instalação principal do banco. Somente eventos, sem IP, e-mail ou chave PIX.
create table if not exists public.pix_copias (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now()
);
alter table public.pix_copias enable row level security;
revoke all on public.pix_copias from anon, authenticated;

create or replace function public.registrar_copia_pix()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.pix_copias default values;
end;
$$;
revoke all on function public.registrar_copia_pix() from public;
grant execute on function public.registrar_copia_pix() to anon,authenticated;

create or replace function public.total_copias_pix()
returns bigint language plpgsql stable security definer set search_path = ''
as $$
declare result bigint;
begin
  if not public.is_site_admin() then raise exception 'Acesso negado'; end if;
  select count(*) into result from public.pix_copias;
  return result;
end;
$$;
revoke all on function public.total_copias_pix() from public;
grant execute on function public.total_copias_pix() to authenticated;
-- Apenas uma contagem indicativa; chamadas automatizadas podem inflá-la e não provam transferências efetuadas.