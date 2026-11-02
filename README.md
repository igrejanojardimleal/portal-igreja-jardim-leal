# Portal IGJAL — V6.3 (GitHub)

**Publicação solicitada pela igreja.** A conta e o repositório foram identificados, mas a visibilidade PUBLIC e a ativação do GitHub Pages ainda precisam ser confirmadas no GitHub. O envio de código ao GitHub não ativa por si só Supabase ou login administrativo.

**Dados do Pix informados pela igreja:** chave `igrejanojardimleal@gmail.com`; titular **GILMAR CALEGÁRIO MURRO**; banco **Nubank**. Antes de pagar, confira no aplicativo bancário. O QR Code continua desativado até confirmação da cidade do titular. Retirada a opção cartão.

**Novidade:** no editor do hinário, o botão “Sugerir tom pelos acordes” analisa cifras digitais, mostra hipóteses e solicita confirmação musical antes de preencher o tom. Não extrai acordes diretamente de PDF e não cria tom definitivo automaticamente.

**Métricas do Pix:** painel preparado para mostrar contagem de cópias, sem registrar dados pessoais. Requer Supabase e execução de `supabase/v6_3_pix_metricas.sql`. É uma métrica aproximada, não comprova pagamentos. O login administrador real depende de Supabase Auth e vínculo explícito do UUID em `site_admins` pelo SQL Editor; nunca coloque senha em repositório público.

**YouTube:** rotina existente busca novas publicações a cada 6h e conserva histórico já capturado. A captura de todo acervo anterior exige importação inicial adicional; não se deve afirmar que o feed sozinho encontra todos os vídeos.

**Ativação GitHub Pages:** repositório público → Settings → Pages → Build and deployment → Source: GitHub Actions. O fluxo `.github/workflows/publicar-site.yml` fará os deploys automáticos em cada push da `main`. Conteúdo estático público funciona sem Supabase; comentários, painel e PDFs dependem do banco.

---

# Portal IGJAL — Igreja no Jardim Leal | Versão 6

Projeto local **multipáginas** destinado à Igreja no Jardim Leal — Obra da Restauração. **Nenhum arquivo foi publicado no GitHub** nem foi criada uma integração real com Supabase nesta entrega. A versão pode ser testada localmente e finalizada posteriormente com a conta da igreja.

## 1. Como visualizar agora

1. Extraia o arquivo ZIP completo, preservando as pastas.
2. Abra `index.html` no navegador (Chrome, Edge ou Firefox).
3. Use o menu para navegar entre as páginas. Algumas funções de leitura e cópia do Pix funcionam mesmo abrindo `file://`.
4. Para testar melhor os arquivos JSON, rode um servidor local dentro da pasta: `python -m http.server 8000` e abra `http://localhost:8000` (opcional).

## 2. Páginas independentes

- `index.html` — Início, atalhos, avisos oficiais publicados e foto principal quando houver.
- `louvores.html` — Hinário com 129 louvores: 71 do Volume 1 e 58 incorporados do novo Volume 2; busca por número, título e trecho; letras e cifras; favoritos; **Modo Culto**; controles de tamanho, próximo/anterior, link compartilhável; reprodução de áudio/vídeo quando houver.
- `agenda.html` — Agenda oficial de cultos, eventos e ensaios e comunicados. Sem horários fictícios: os dados são cadastrados pelo administrador.
- `historia.html` — História e fotografias oficiais (espaços preparados para fotos a serem fornecidas).
- `estudos-biblicos.html` — Estudos Bíblicos: área marcada como “Em elaboração”, sem estudos publicados. Os estudos serão enviados pela liderança e inseridos gradualmente, um por vez, após revisão.
- `historia-da-fe.html` — História da Fé: quatro personagens para começar, com fontes, contexto e distinção entre história documentada e tradição (Cosme e Damião, Martinho Lutero, Jorge da Capadócia e Sebastião).
- `canal.html` — Galeria do canal oficial, miniaturas, links e reprodutor incorporado. A sincronização automatizada via GitHub Action está preparada, **não ativa sem publicação e configuração**.
- `mural.html` — Comentários e respostas; sempre pendentes até avaliação administrativa. Em modo local, **nenhuma mensagem é publicada para outros visitantes**.
- `enviar-cifra.html` — Envio de PDF (até 5 MB) por pessoa logada para análise, nunca publicação automática.
- `contribuir.html` — Chave Pix informada pela igreja: `igrejanojardimleal@gmail.com`. Botão copiar. O QR Code só será gerado quando a igreja confirmar o nome EXATO do beneficiário e a cidade da conta; não inventamos dados. Cartão permanece inativo.
- `administracao.html` — Área de acesso por administrador autenticado: comentários, cifras PDF, letras/cifras, agenda, avisos, vinculação de mídia, identidade/história, **editor de estudos bíblicos** e histórico das decisões.

## 3. Melhorias 1–7

1. **Modo Culto:** modo de leitura com tela cheia, fonte maior, próximo/anterior, favorito por aparelho, link e impressão. Funciona localmente.
2. **Painel completo:** formulários para letras, cifras de texto, novas músicas, agenda, avisos, mídias e identidade, além da moderação. As gravações ficam no Supabase quando a integração estiver ativada. Admin não é simulado em produção.
3. **Identidade real:** mantida a arte temporária e criados caminhos para logo, foto principal e fotografia da história. Arquivos vão em `assets/fotos/`. Fotos ainda não recebidas.
4. **Agenda e avisos:** nova página, avisos destacados na Home, datas validadas com criação administrativa. Nenhum culto ou horário foi inventado.
5. **Repertório:** 129 louvores (71 do Volume 1 + 58 do Volume 2), tom/cifra de texto configurável, PDF aprovado e mídia por hino. No Volume 2, 14 músicas já têm acordes identificados e aparecem na aba Cifras. Para vídeo, informar ID/link do YouTube. Para áudio, hospedar um arquivo oficial em `assets/audio/` ou URL HTTPS.
6. **Moderação + notificações:** comentários, respostas e PDFs passam por aprovação. Administradores autenticados veem contador de pendências em todas as páginas; contagem consultada a cada 60 segundos enquanto a aba está visível. Avisos do navegador dependem da permissão explícita e só funcionam com o portal aberto; **não há push/email com navegador fechado**. Decisões são auditadas por gatilhos SQL.
7. **Ofertas:** atalho Pix compacto em todas as páginas, chave para copiar e área preparada para QR Code seguro. A opção de cartão foi removida; permanece apenas Pix.

**Exclusão solicitada:** não foi implementado o item 8 (PWA, instalar como app ou disponibilidade offline). Não há service worker.

## 4. Como ativar a base de dados

O site público estático pode ser hospedado futuramente no GitHub Pages, mas comentário moderado, upload privado e edição administrativa **precisam do Supabase**.

1. Crie um projeto Supabase pertencente à igreja. Ative autenticação por e-mail e, se desejar, Google OAuth com URLs de redirecionamento da futura hospedagem.
2. No SQL Editor execute `supabase/INSTALACAO_COMPLETA_V4.sql` em projeto **novo**. Em projeto que já recebeu o schema V3, execute apenas `supabase/v4_conteudo_agenda_midias.sql`. A atualização V5 não altera o banco: adiciona somente o motor de transposição e a interface.
3. Revise as políticas RLS dos públicos `anon`/`authenticated`, Storage e `site_admins` antes de publicar. Execute testes completos de acesso (visitante, membro logado e administrador).
4. Em `config.js`, configure `supabase.url` e `supabase.anonKey` **publicável**. **NUNCA** use chave `service_role`, secret ou tokens pessoais no HTML/JS/GitHub público.
5. Crie o usuário que administrará o portal pelo login real. Localize seu UUID em Supabase > Authentication > Users. Insira-o em `site_admins` **pelo SQL Editor**. Exemplo com UUID fictício (não execute sem substituí-lo):

   ```sql
   insert into public.site_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict (user_id) do nothing;
   ```

6. Antes de abrir ao público, configure antispam de **validação no servidor** (por exemplo Edge Function + Turnstile com verificação de token), prevenção de abuso de uploads, limites de requisições e revisão dos PDFs. A checagem em JavaScript **não substitui** varredura de segurança no servidor.
7. Registre os prazos de retenção dos comentários/PDFs, aviso de privacidade e autorizações de imagem/música. O hinário original possui declaração de direitos autorais reservados; confirme permissão de publicação pública com os compositores/departamento.

## 5. Adicionar imagens oficiais depois

- Coloque os arquivos autorizados na pasta `assets/fotos/`.
- No Painel > **Identidade e história**, informe os caminhos exatos, por exemplo `assets/fotos/logo.png`, `assets/fotos/templo.jpg`, `assets/fotos/historia.jpg`.
- Edite a história da igreja no mesmo painel usando apenas informações confirmadas. É possível atualizar também o contato público.

## 6. Pix e QR Code

A chave Pix cadastrada é `igrejanojardimleal@gmail.com`. O campo `config.pix.beneficiary` está vazio, assim como `config.pix.city`, pois o nome do titular e a cidade da conta não foram confirmados. **Não preencha com um nome presumido**. Após validação oficial, configure ambos no `config.js`. A página então gera BR Code Pix sem valor obrigatório; o visitante pode escolher a quantia. A pessoa deverá sempre conferir o recebedor no aplicativo bancário.

## 7. YouTube e gravações

O canal informado pela igreja é `https://www.youtube.com/@igrejanojardimlealobradare8130`. A rotina do repositório `.github/workflows/sincronizar-youtube.yml` busca vídeos publicados e mantém o catálogo `assets/videos.json` quando executada em repositório com GitHub Actions configurado. Uma busca do feed não garante a importação automática de todo o arquivo histórico do canal, que poderá exigir importação adicional.

Para associar vídeo a um hino, use **Administração > Mídias** e insira o ID ou link oficial do YouTube. Para áudio, insira o caminho do arquivo oficial hospedado em `assets/audio/` ou um URL HTTPS para `.mp3`, `.ogg` ou `.m4a`. A igreja ainda não forneceu arquivos de áudio/vídeo para hinos específicos; o estado "em breve" é intencional.

## 8. Segurança e limites do protótipo

- Apenas administradores confirmados pelo Supabase RPC + RLS podem alterar conteúdo, moderar ou abrir PDFs privados. O botão do frontend **não define** permissões.
- Comentários e respostas jamais se tornam aprovados por padrão; gravações e cifras são administradas separadamente.
- O painel só possui funcionalidade real após aplicar as regras SQL e configurar autenticação.
- O contador/alertas funciona enquanto o site está aberto; alertas via e-mail e push remoto ainda não existem.
- O QR Pix não foi ativado sem o beneficiário confirmado.
- Os horários dos cultos, as fotos, a história detalhada e os áudios oficiais continuam pendentes das informações da igreja.
- Todos os links externos e uploads devem ser revisados antes do lançamento.

## 9. Testes realizados

Validação estática da navegação das 9 páginas, JavaScript sem erros em testes automatizados de renderização, pesquisa de 71 hinos, Modo Culto, favoritos, próximos hinos, mural local pendente, bloqueio administrativo sem login e formulários de administrador com **serviço simulado**. **Não houve teste contra Supabase real e GitHub Pages real**; testes de produção obrigatórios antes da publicação.


## 10. NOVO — Transposição musical automática (V5)

A página **Hinário > Cifras** ganhou seletor dos **12 tons**: Dó, Dó#, Ré, Ré#, Mi, Fá, Fá#, Sol, Sol#, Lá, Lá#, Si, além de **− ½ tom**, **+ ½ tom** e **Tom original**. O ajuste atualiza acordes sem recarregar, preserva qualidade (m, 7, sus4, add9, diminutos etc.), baixos em inversão (G/B, Am7/G) e as palavras da letra. As preferências por hino ficam no próprio aparelho (localStorage). O recurso funciona localmente sem banco de dados.

### Ponto essencial sobre PDFs

**Um PDF por si só NÃO é transponível.** PDFs recebidos continuam privados até a aprovação administrativa; uma vez aprovado, o PDF original é disponibilizado, sem modificações. Para disponibilizar a transposição, um administrador precisa converter e **revisar manualmente** os acordes para texto digital, registrando o **tom original** em Administração > Hinário. Nenhum reconhecimento automático de PDF ou IA de leitura musical foi implementado.

### Como digitar uma cifra transponível

No editor administrativo, informe o tom original (ex.: `C`, `Dó`, `F#`, `Bb`, `Am`) e digite a cifra de forma legível. Use linhas contendo somente acordes, com a letra na linha seguinte:

```text
C                   G/B                Am7
Uma frase da letra do louvor...
F                   G7                 C
Outra frase da letra...
```

Ou marque acordes dentro de trechos de letra usando colchetes: `[C]frase [G/B]seguinte`. A visualização administrativa permite conferir a transposição antes de salvar. O código não tenta adivinhar acordes dentro de palavras. Para manter segurança, o campo da letra jamais é alterado pelo transpositor.

**Limitações musicais:** a transposição usa equivalência enarmônica com sustenidos no resultado, conforme os 12 tons solicitados (por exemplo, Bb vira A#). Acordes e cifras precisam ser revisados pelo departamento de música; não são interpretadas partituras, tablaturas, diagramas ou modulações complexas. O seletor escolhe a nota fundamental: cifras menores permanecem menores (Am para Cm). A mudança de tom NÃO altera pitch de áudio/vídeo nem o PDF original.

### Arquivos adicionados

- `assets/transpositor.js`: motor de transposição sem bibliotecas e sem dependência do servidor.
- Controles no `louvores.html`, inclusive no Modo Culto.
- Prévia administrativa e validação do tom original em `administracao.html`.

Nada foi publicado no GitHub e nenhum PWA/offline foi adicionado.

## Atualização de conteúdo — Volume 2 e estudos bíblicos
- A seção pública História da Fé foi retirada do menu e do site.
- Estudos Bíblicos permanece visível com o status **Em elaboração**. Os roteiros preliminares anteriores foram retirados; nenhum estudo é apresentado como oficial.
- O novo documento de hinário acrescentou 58 louvores únicos. Repetições foram consolidadas; versões com título alternativo foram agrupadas quando correspondiam à mesma letra.
- 14 louvores do Volume 2 que já contêm acordes identificáveis estão disponíveis na aba **Cifras**. A aba Cifras lista apenas músicas com cifra cadastrada ou PDF aprovado.
- Os conteúdos continuam em revisão interna. Confirmar autorização dos compositores e responsáveis antes de tornar as letras públicas.


## Versão 7 — Agenda inclusiva e administrador de eventos
- `agenda.html` exibe somente os **próximos 90 dias**, os avisos publicados e as comemorações do mês, sem login para consulta.
- Página inicial exibe um resumo de aniversários e datas especiais.
- Um responsável por eventos autentica-se com Supabase e só pode editar **eventos, avisos e comemorações**; o admin geral mantém todos os privilégios.
- A permissão real é imposta por RLS, conforme `supabase/v7_eventos_celebracoes.sql`. Não basta ocultar botões.
- Datas pessoais precisam de autorização; aniversário não registra ano de nascimento.
- Para ativar: executar todas as migrações anteriores, depois a V7; criar usuário no Supabase Authentication; conceder acesso em `public.site_event_managers`. Nenhuma conta ou senha foi gerada automaticamente.
- O GitHub Pages é hospedagem estática: sem preencher `config.js` com URL/chave pública do Supabase e aplicar SQL, nenhuma edição persistente estará ativa.