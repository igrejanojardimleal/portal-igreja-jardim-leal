-- IGJAL: terceiro perfil, moderador de comentários.
-- Execute APÓS supabase/schema.sql, supabase/v4_conteudo_agenda_midias.sql
-- e supabase/v7_eventos_celebracoes.sql, com privilégios de administrador do projeto.
-- Não coloque credenciais neste arquivo ou no GitHub.
BEGIN;
create table if not exists public.site_mural_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  adicionado_em timestamptz not null default now()
);
alter table public.site_mural_moderators enable row level security;
revoke all on public.site_mural_moderators from anon,authenticated;

create or replace function public.can_moderate_mural()
returns boolean
language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and ((select public.is_site_admin()) or exists (
      select 1 from public.site_mural_moderators m
      where m.user_id=(select auth.uid())
    ));
$$;
revoke all on function public.can_moderate_mural() from public;
grant execute on function public.can_moderate_mural() to authenticated;
grant execute on function public.can_moderate_mural() to anon;

-- O visitante só vê comentários aprovados; o moderador vê os pendentes.
drop policy if exists "Leitura publica so conteudo aprovado" on public.comentarios;
create policy "Leitura publica so conteudo aprovado"
on public.comentarios for select to anon,authenticated
using (status='aprovado' or (select public.can_moderate_mural()));

drop policy if exists "Somente admin modera" on public.comentarios;
create policy "Somente admin modera"
on public.comentarios for update to authenticated
using ((select public.can_moderate_mural()))
with check ((select public.can_moderate_mural()));

-- Permitir somente mudança de status pela interface de moderação.
revoke update(nome,mensagem,status) on public.comentarios from authenticated;
grant update(status) on public.comentarios to authenticated;
-- A exclusão continua reservada aos administradores gerais.
COMMIT;

-- COMO AUTORIZAR UMA CONTA DE MODERAÇÃO (APÓS CONFIGURAR SUPABASE):
-- 1. Em Authentication > Users crie/identifique a conta (login por Google ou link mágico).
-- 2. Copie o UUID do usuário autorizado.
-- 3. No SQL Editor execute, usando o UUID real:
-- insert into public.site_mural_moderators(user_id)
-- values ('00000000-0000-0000-0000-000000000000')
-- on conflict(user_id) do nothing;
--
-- Administração geral: tabela public.site_admins.
-- Agenda e avisos: tabela public.site_event_managers.
-- Moderação mural: tabela public.site_mural_moderators.
--
-- Segurança: testa todos os perfis com contas reais e RLS antes de ativar em produção.
