# Acesso ao portal — perfis administrativos

A autenticação do portal é feita por Supabase Auth, com login Google ou por link de e-mail. **Não há senhas ou usuários administrativos já criados**. O GitHub Pages é público e não guarda credenciais.

Perfis previstos:
- **Administração geral** — aprova comentários, revisa cifras, gerencia hinos, mídias, agenda e consulta métricas do Pix. Atribuição: tabela `public.site_admins`.
- **Agenda e avisos** — atualiza eventos, avisos e comemorações. Atribuição: tabela `public.site_event_managers`.
- **Moderador do mural** — aprova ou rejeita comentários e respostas, sem permissão para editar eventos, Pix ou hinário. Atribuição: tabela `public.site_mural_moderators`.

Para ativar:
1. Crie o projeto Supabase da igreja; faça as configurações de segurança e e-mail.
2. Aplique os SQLs na ordem documentada, incluindo `supabase/v9_moderacao_mural.sql`.
3. Configure somente a URL pública e chave `anon/publishable` em `config.js`. **Nunca** coloque `service_role` ou outras chaves secretas no GitHub.
4. Crie as contas reais em Authentication > Users; atribua privilégios pelos UUIDs no SQL Editor.
5. Teste com três contas diferentes, inclusive os acessos negados, antes de compartilhar o portal.

Enquanto o Supabase estiver vazio em `config.js`, os três logins permanecem indisponíveis.
