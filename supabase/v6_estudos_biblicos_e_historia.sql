
-- V6. Requer schema V4/V5 e public.is_site_admin().
-- Rascunhos completos visíveis somente a administradores autenticados.
create table if not exists public.site_estudos (
  slug text primary key check(slug ~ '^[a-z0-9-]{2,100}$'),
  area text not null check(area in ('biblia','historia')),
  titulo text not null check(char_length(titulo) between 2 and 180),
  categoria text not null default 'Geral' check(char_length(categoria)<=80),
  resumo text not null check(char_length(resumo)<=1400),
  questao text not null default '' check(char_length(questao)<=1000),
  referencias text not null default '' check(char_length(referencias)<=700),
  corpo text not null default '' check(char_length(corpo)<=20000),
  fontes text not null default '' check(char_length(fontes)<=2500),
  publicado boolean not null default false,
  atualizado_em timestamptz not null default now()
);
alter table public.site_estudos enable row level security;
drop policy if exists "v6 ler estudos aprovados ou admin" on public.site_estudos;
create policy "v6 ler estudos aprovados ou admin" on public.site_estudos
for select to anon,authenticated using(publicado or (select public.is_site_admin()));
drop policy if exists "v6 inserir estudos admin" on public.site_estudos;
create policy "v6 inserir estudos admin" on public.site_estudos
for insert to authenticated with check ((select public.is_site_admin()));
drop policy if exists "v6 atualizar estudos admin" on public.site_estudos;
create policy "v6 atualizar estudos admin" on public.site_estudos
for update to authenticated using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
drop policy if exists "v6 excluir estudos admin" on public.site_estudos;
create policy "v6 excluir estudos admin" on public.site_estudos
for delete to authenticated using ((select public.is_site_admin()));
revoke all on public.site_estudos from anon,authenticated;
grant select on public.site_estudos to anon,authenticated;
grant insert (slug,area,titulo,categoria,resumo,questao,referencias,corpo,fontes,publicado) on public.site_estudos to authenticated;
grant update (area,titulo,categoria,resumo,questao,referencias,corpo,fontes,publicado) on public.site_estudos to authenticated;
grant delete on public.site_estudos to authenticated;
-- Não exponha credenciais no frontend; valide todas as permissões anon/authenticated/admin.