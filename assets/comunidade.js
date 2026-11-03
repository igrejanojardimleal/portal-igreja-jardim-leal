/* Comentários moderados por hino e downloads disponíveis para membros cadastrados. */
window.IGREJA_COMUNIDADE = (()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  let ctx,selected=null,loading=0;
  const status=(id,value,error=false)=>{const e=$(id);if(e){e.textContent=value;e.style.color=error?'#9e2626':'';}};
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function logged(){return Boolean(ctx?.user?.()&&ctx?.db?.());}
  function updateAccess(){
    const form=$('hino-member-form'),prompt=$('hino-member-prompt');
    if(form)form.hidden=!logged();
    if(prompt)prompt.hidden=logged();
    const down=$('hino-download-actions');
    if(down)down.hidden=!logged();
  }
  function init(context){
    ctx=context;
    const dialog=$('song-dialog');
    if(dialog){
      const target=$('song-media-area');
      const section=document.createElement('section');
      section.className='hino-comunidade';
      section.innerHTML=`
        <h3>Conversas sobre este hino</h3>
        <p class="muted">Compartilhe uma reflexão sobre o louvor. Toda mensagem passa por aprovação.</p>
        <div id="hino-download-actions" class="hino-download-actions" hidden>
          <button class="btn btn-outline btn-sm" type="button" id="member-download-song">Baixar texto (.txt)</button>
          <button class="btn btn-outline btn-sm" type="button" id="member-save-pdf">Salvar em PDF</button>
        </div>
        <div id="hino-comments-feed" class="comments-list"></div>
        <p id="hino-member-prompt">Para comentar ou baixar a letra, <button type="button" class="btn btn-outline btn-sm" id="hino-open-login">entre ou crie sua conta</button>.</p>
        <form id="hino-member-form" hidden>
          <p class="muted">O comentário aparecerá com seu nome e sobrenome cadastrados em Minha conta.</p>
          <label for="hino-comment-body">Comentário sobre o hino</label>
          <textarea id="hino-comment-body" required minlength="3" maxlength="600" rows="3" placeholder="Compartilhe sua palavra..."></textarea>
          <button type="submit" class="btn btn-primary btn-sm">Enviar para aprovação</button>
          <p role="status" class="form-status" id="hino-comment-status"></p>
        </form>`;
      if(target)target.insertAdjacentElement('afterend',section);
      else dialog.querySelector('.modal-inner')?.append(section);
      $('hino-open-login').addEventListener('click',()=>{
        dialog.close();
        $('login-button')?.click();
      });
      $('hino-member-form').addEventListener('submit',async ev=>{
        ev.preventDefault();
        if(!logged()){status('hino-comment-status','Entre com sua conta antes de comentar.',true);return;}
        if(!selected)return;
        const n=window.IGREJA_MEMBROS?.displayName?.(ctx.user())||'';
        const msg=$('hino-comment-body').value.trim();
        if(!n){status('hino-comment-status','Complete seu nome e sobrenome em Minha conta.',true);return;}
        if(msg.length<3||msg.length>600){
          status('hino-comment-status','Escreva um comentário entre 3 e 600 caracteres.',true);return;
        }
        const button=ev.currentTarget.querySelector('button[type=submit]');button.disabled=true;
        status('hino-comment-status','Enviando para revisão...');
        try{
          const {error}=await ctx.db().from('hino_comentarios').insert({
            hino_numero:selected.number,nome:n,mensagem:msg,user_id:ctx.user().id
          });
          if(error)throw error;
          $('hino-comment-body').value='';
          status('hino-comment-status','Mensagem recebida. Ficará visível depois da aprovação.');
        }catch(e){status('hino-comment-status','Falha ao enviar: '+e.message,true);}
        finally{button.disabled=false;}
      });
      $('member-download-song').addEventListener('click',()=>{
        if(!logged()||!selected){status('hino-comment-status','Entre na sua conta antes de baixar.',true);return;}
        const base=`Hino ${selected.number} — ${selected.title}\n${selected.author||''}\n\n`;
        const body=$('song-dialog-content')?.textContent||selected.lyrics||'';
        const blob=new Blob([base+body],{type:'text/plain;charset=utf-8'});
        const url=URL.createObjectURL(blob);
        const a=make('a');a.href=url;a.download=`hino-${selected.number}.txt`;
        a.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),1500);
      });
      $('member-save-pdf').addEventListener('click',()=>{
        if(!logged())return;
        $('print-song')?.click();
        status('hino-comment-status','Na janela de impressão, escolha “Salvar como PDF”.');
      });
    }
    $('admin-hinos-comentarios-reload')?.addEventListener('click',loadModeration);
    updateAccess();
    if(context.selectedSong?.()) void songChanged(context.selectedSong());
  }
  function renderComments(rows){
    const host=$('hino-comments-feed');if(!host)return;
    host.replaceChildren();
    if(!rows.length){host.append(make('p','muted','Ainda não há comentários aprovados para este hino.'));return;}
    for(const row of rows){
      const article=make('article','comment-item');
      const title=make('strong','',row.nome);
      const when=make('small','', ' · '+new Date(row.criado_em).toLocaleDateString('pt-BR'));
      const p=make('p','comment-message',row.mensagem);
      article.append(title,when,p);host.append(article);
    }
  }
  async function songChanged(song){
    if(!song)return; const old=selected?.number;selected=song;updateAccess();
    if(old===song.number && $('hino-comments-feed')?.dataset.loadedHino===String(song.number))return;
    const host=$('hino-comments-feed');if(!host)return;
    host.textContent='Carregando comentários...';
    if(!ctx?.db?.()){host.textContent='Os comentários serão carregados quando o serviço estiver disponível.';return;}
    const thisLoad=++loading;
    const {data,error}=await ctx.db().from('hino_comentarios')
      .select('id,nome,mensagem,criado_em,status').eq('hino_numero',song.number)
      .eq('status','aprovado').order('criado_em',{ascending:false}).limit(100);
    if(thisLoad!==loading)return;
    if(error){host.textContent='Não foi possível carregar comentários.';return;}
    host.dataset.loadedHino=String(song.number);
    renderComments(data||[]);
  }
  async function loadModeration(){
    if(!ctx?.db?.()||!ctx?.canModerate?.())return;
    const host=$('admin-hinos-comentarios-list');if(!host)return;
    host.textContent='Consultando comentários dos hinos...';
    const {data,error}=await ctx.db().from('hino_comentarios')
      .select('id,hino_numero,nome,mensagem,criado_em,status')
      .eq('status','pendente').order('criado_em',{ascending:true}).limit(200);
    if(error){host.textContent='Falha ao consultar: '+error.message;return;}
    host.replaceChildren();
    status('admin-hinos-comentarios-status',`${data.length} comentário(s) aguardando aprovação.`);
    if(!data.length){host.append(make('p','muted','Nenhuma mensagem pendente nos hinos.'));return;}
    for(const row of data){
      const card=make('article','comment-item');
      card.append(make('strong','',`Hino ${row.hino_numero} · ${row.nome}`));
      card.append(make('p','comment-message',row.mensagem));
      const actions=make('div','admin-actions');
      for(const [action,label] of [['aprovado','Aprovar'],['rejeitado','Rejeitar']]){
        const button=make('button',action==='aprovado'?'btn btn-primary btn-sm':'btn btn-outline btn-sm',label);
        button.type='button';
        button.addEventListener('click',async()=>{
          if(!window.confirm(label+' comentário de '+row.nome+'?'))return;
          button.disabled=true;
          const {error:err}=await ctx.db().from('hino_comentarios').update({status:action}).eq('id',row.id);
          if(err){status('admin-hinos-comentarios-status','Falha ao moderar: '+err.message,true);button.disabled=false;}
          else await loadModeration();
        });
        actions.append(button);
      }
      card.append(actions);host.append(card);
    }
  }
  function onAuthChange(){updateAccess();if(selected)void songChanged({...selected,number:selected.number});}
  return {init,onAuthChange,songChanged,loadModeration};
})();