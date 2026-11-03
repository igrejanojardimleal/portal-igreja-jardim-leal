# Ativação do Supabase: Igreja no Jardim Leal

Projeto: `portal-igreja-jardim-leal`
URL **pública**, já cadastrada no `config.js`: `https://tzexkzhygvmtbggjglxg.supabase.co`.
Site oficial: `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/`.

## O que já está feito
- GitHub Pages publicado.
- SQL principal V4 e arquivos V6 (estudos), V6.3 (métricas Pix), V7 (eventos) e V9 (moderação) foram executados no painel pelo responsável, segundo confirmação dele.
- O arquivo `config.js` já contém a URL pública do projeto.
- **A chave publishable ainda está vazia e o login real ainda não está ativo.**
- Nenhuma conta administrativa foi criada ou autorizada automaticamente.

## Passos obrigatórios no painel da igreja

### 1. Endereços permitidos na autenticação
Supabase > Authentication > URL Configuration:
- Site URL: `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/`
- Redirect URLs, adicionar **explicitamente**:
  - `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/index.html`
  - `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/louvores.html`
  - `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/agenda.html`
  - `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/mural.html`
  - `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/administracao.html`
Para simplificar, pode usar também o padrão `https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/**`, mas priorize URLs explícitas em produção.

### 2. Conferir autenticação e entrega de e-mail
Authentication > Sign In / Providers: Email habilitado. Google depende de configuração OAuth separada e não funciona apenas por existir botão no portal.
**IMPORTANTE:** o serviço SMTP padrão do Supabase é só para testes, envia para e-mails autorizados da equipe do projeto e tem limite baixo. Para convidar outras pessoas e ativar links mágicos públicos, configure SMTP próprio. Não coloque usuário/senha do SMTP no GitHub.

### 3. Criar contas pessoais reais
Supabase > Authentication > Users > Add user > Send invitation.
- Geral: `igrejanojardimleal@gmail.com` (se esse for realmente o e-mail controlado pelo administrador geral).
- Agenda: usar o e-mail pessoal do responsável autorizado.
- Mural: usar o e-mail pessoal do moderador autorizado.

Cada responsável deverá usar o próprio e-mail (não compartilhar senha). Depois de aceitas as contas, conferir no painel se o e-mail foi confirmado. Caso o convite não chegue, verificar SMTP e se o destinatário está autorizado.

### 4. Conceder papéis no SQL Editor APÓS os usuários existirem
Revisar os endereços e executar **cada comando separadamente**, apenas após confirmar as contas.

**Consulta segura dos usuários:**
```sql
select id,email,email_confirmed_at from auth.users
order by created_at desc;
```

**Administrador geral — somente após confirmar a conta oficial:**
```sql
insert into public.site_admins(user_id)
select id from auth.users
where lower(email)='igrejanojardimleal@gmail.com' and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

**Administrador de eventos — substituir pelo e-mail real:**
```sql
insert into public.site_event_managers(user_id)
select id from auth.users
where lower(email)=lower('EMAIL-REAL-DA-AGENDA@exemplo.com') and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

**Moderador do mural — substituir pelo e-mail real:**
```sql
insert into public.site_mural_moderators(user_id)
select id from auth.users
where lower(email)=lower('EMAIL-REAL-DO-MURAL@exemplo.com') and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

Depois, conferir vínculo de permissões:
```sql
select u.email,
       (a.user_id is not null) as administrador_geral,
       (e.user_id is not null) as agenda_avisos,
       (m.user_id is not null) as moderador_mural
from auth.users u
left join public.site_admins a on a.user_id=u.id
left join public.site_event_managers e on e.user_id=u.id
left join public.site_mural_moderators m on m.user_id=u.id
order by u.email;
```
ATENÇÃO: sucesso na execução de um INSERT com SELECT não garante inserção se o usuário não existir ou não estiver confirmado. Conferir o SELECT final.

### 5. Conectar o site ao Supabase
Supabase > Project Settings > API Keys ou botão Connect:
- Escolher exclusivamente a chave **publishable** `sb_publishable_...`. Ela pode estar no frontend público; quem protege os dados são os grants e RLS.
- No `config.js`, preencher `supabase.anonKey` com essa chave publicável. O nome legado `anonKey` continua funcional com a nova chave.
- **NUNCA** colocar chave `sb_secret_...`, `service_role`, senha de banco, token do Supabase ou SMTP no GitHub, no chat ou no navegador.
- Testar moderação, login, envio de PDF e escrita de eventos antes de promover o funcionamento para visitantes.

### 6. Testes de permissão que precisam ser feitos com contas reais
- Anônimo: ler hinos/estudos publicados/agenda/vídeos; comentários publicados; enviar comentário pendente. Nunca aprovar conteúdos.
- Conta comum: não pode modificar agenda, mural, hinos ou métricas.
- Agenda: apenas eventos/avisos/comemorações; não aprova mural nem cifras.
- Mural: apenas comentários e respostas pendentes; não edita agenda.
- Geral: acesso às áreas administrativas, comentários, cifras e totalizador Pix.
- Testar enviar comentários/respostas e confirmar que não são publicados automaticamente.
- Para uploads PDF: exigir login, conferir buckets e permissões, validar arquivos no servidor e adicionar anti-spam antes de liberar ao público.

Documentação oficial: https://supabase.com/docs/guides/auth/redirect-urls e https://supabase.com/docs/guides/getting-started/api-keys
