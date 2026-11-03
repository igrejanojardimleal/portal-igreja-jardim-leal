-- Duas versões de PDF para o mesmo hino, uma por classificação vocal.
-- Executar após a migração que adiciona voz_confortavel.
alter table public.cifras_publicadas drop constraint if exists cifras_publicadas_pkey;
alter table public.cifras_publicadas
  add constraint cifras_publicadas_pkey primary key (hino_numero, voz_confortavel);
