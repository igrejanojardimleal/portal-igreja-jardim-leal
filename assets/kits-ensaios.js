/* Biblioteca de kits de ensaio da Igreja no Jardim Leal.
 * Os áudios/vídeos são hospedados externamente: o site só armazena links.
 * Um player é criado apenas quando o visitante solicita a faixa. */
window.IGREJA_KITS = (()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const e=(tag,cls,t)=>{
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(t!==undefined)n.textContent=String(t);
    return n;
  };
  let ctx=null,musicas=[],faixas=[],inited=false,activePlayer=null,searchTerm='';
  const canManage=()=>!!ctx?.db?.() && (ctx?.isAdmin?.()===true||ctx?.hasArea?.('kits')===true);
  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const note=(id,message,bad=false)=>{const n=$(id);if(n){n.textContent=message;n.style.color=bad?'#a63b44':'';}};
  const youtubeId=raw=>{
    try{
      const u=new URL(clean(raw));
      if(u.protocol!=='https:')return null;
      const host=u.hostname.toLowerCase();
      let id=null;
      if(host==='youtu.be'||host==='www.youtu.be')id=u.pathname.split('/')[1];
      else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
        if(u.pathname==='/watch')id=u.searchParams.get('v');
        else if(/^\/(live|shorts|embed)\//.test(u.pathname))id=u.pathname.split('/')[2];
      }
      return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:null;
    }catch(_){return null;}
  };
  const audioLink=raw=>{
    try{
      const u=new URL(clean(raw));
      return u.protocol==='https:'&&/\.(mp3|m4a|ogg|wav)$/i.test(u.pathname)&&!u.username&&!u.password
        ?u.href:null;
    }catch(_){return null;}
  };
  const canonicalLink=(type,url)=>{
    if(type==='youtube'){
      const id=youtubeId(url);
      return id?'https://www.youtube.com/watch?v='+id:null;
    }
    if(type==='audio')return audioLink(url);
    return null;
  };
  function stopPlayer(){
    if(activePlayer){activePlayer.replaceChildren();activePlayer=null;}
  }
  function playTrack(track,target){
    const link=canonicalLink(track.tipo,track.url);
    if(!link)return;
    if(activePlayer===target){stopPlayer();return;}
    stopPlayer();
    activePlayer=target;
    if(track.tipo==='audio'){
      const player=e('audio','kit-native-audio');
      player.controls=true;
      player.preload='none';
      player.src=link;
      player.setAttribute('aria-label','Ouvir '+track.voz);
      target.append(player);
      player.play().catch(()=>{}); // navegador pode exigir clique direto no controle
    }else{
      const id=youtubeId(link);
      if(!id)return;
      const frame=e('iframe','kit-youtube-player');
      frame.src='https://www.youtube-nocookie.com/embed/'+id+'?rel=0';
      frame.title='Kit de ensaio — '+track.voz;
      frame.loading='lazy';
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.allow='accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen=true;
      target.append(frame);
    }
  }
  function tracksFor(song,onlyPublished=true){
    return faixas.filter(t=>Number(t.musica_id)===Number(song.id)&&(!onlyPublished||t.publicado))
      .sort((a,b)=>(a.ordem||0)-(b.ordem||0)||a.voz.localeCompare(b.voz,'pt-BR'));
  }
  function trackRow(track){
    const row=e('div','kit-track-row');
    const info=e('div','kit-track-info');
    info.append(e('span','kit-track-icon',track.tipo==='audio'?'♫':'▶'));
    const details=e('div','');
    details.append(e('strong','',track.voz));
    if(track.observacao)details.append(e('small','',track.observacao));
    info.append(details);
    const action=e('div','kit-track-actions');
    const btn=e('button','btn btn-outline btn-sm',track.tipo==='youtube'?'Ouvir no player':'Ouvir áudio');
    btn.type='button';
    const player=e('div','kit-track-player');
    btn.addEventListener('click',()=>playTrack(track,player));
    action.append(btn);
    const link=canonicalLink(track.tipo,track.url);
    if(link){
      const external=e('a','kit-external-link','Abrir origem ↗');
      external.href=link;external.target='_blank';external.rel='noopener noreferrer';
      action.append(external);
    }
    row.append(info,action,player);
    return row;
  }
  function renderPublic(){
    const root=$('kits-public-list');
    if(!root)return;
    const visible=musicas
      .filter(m=>m.publicado)
      .sort((a,b)=>a.titulo.localeCompare(b.titulo,'pt-BR'))
      .filter(m=>!searchTerm||norm(m.titulo+' '+(m.descricao||'')+' '+tracksFor(m).map(t=>t.voz).join(' ')).includes(searchTerm));
    stopPlayer();
    root.replaceChildren();
    const count=$('kits-results-count');
    if(count)count.textContent=visible.length+' música(s) encontrada(s)';
    if(!visible.length){
      const empty=e('div','kits-empty');
      empty.append(e('span','kits-empty-icon','♫'));
      empty.append(e('h2','',searchTerm?'Nenhuma música encontrada':'Kits de ensaio em preparação'));
      empty.append(e('p','',searchTerm?'Experimente outro título ou nome de voz.':'Assim que a equipe publicar os primeiros kits, eles aparecerão aqui separados por música e por voz.'));
      root.append(empty);return;
    }
    for(const song of visible){
      const list=tracksFor(song);
      const details=e('details','kit-song-card');
      const summary=e('summary','kit-song-header');
      summary.append(e('span','kit-song-symbol','♫'));
      const title=e('div','kit-song-title');
      title.append(e('h2','',song.titulo));
      const c=e('span','kit-song-counter',list.length+' '+(list.length===1?'faixa':'faixas')+' disponíveis');
      title.append(c);
      summary.append(title,e('span','kit-song-arrow','⌄'));
      const body=e('div','kit-song-body');
      if(song.descricao)body.append(e('p','kit-song-description',song.descricao));
      if(!list.length)body.append(e('p','muted','Os áudios desta música estão em preparação.'));
      else{
        const listRoot=e('div','kit-track-list');
        for(const track of list)listRoot.append(trackRow(track));
        body.append(listRoot);
      }
      details.append(summary,body);
      details.addEventListener('toggle',()=>{if(!details.open)stopPlayer();});
      root.append(details);
    }
  }
  async function refresh(){
    const db=ctx?.db?.();
    if(!db)return;
    const [songResult,trackResult]=await Promise.all([
      db.from('site_kits_musicas').select('id,titulo,descricao,publicado,criado_em,atualizado_em').order('titulo',{ascending:true}),
      db.from('site_kits_faixas').select('id,musica_id,voz,tipo,url,observacao,ordem,publicado').order('ordem',{ascending:true})
    ]);
    if(songResult.error||trackResult.error){
      const msg=(songResult.error||trackResult.error).message;
      console.warn('Falha ao carregar kits de ensaio:',msg);
      note('kits-public-status','Não foi possível carregar os kits. Atualize a página.',true);
      note('kits-admin-status',msg,true);
      return;
    }
    musicas=songResult.data||[];
    faixas=trackResult.data||[];
    renderPublic();
    renderAdmin();
    note('kits-public-status','');
  }
  function setOptions(select,items,placeholder,selected){
    if(!select)return;
    select.replaceChildren();
    const start=e('option','',placeholder);start.value='';select.append(start);
    for(const item of items){
      const option=e('option','',item.titulo);
      option.value=String(item.id);
      select.append(option);
    }
    select.value=selected!=null?String(selected):'';
    if(!select.value)select.value='';
  }
  function resetSongForm(){
    $('kits-song-form')?.reset();
    $('kits-admin-song-id').value='';
    $('kits-song-save').textContent='Salvar música';
    $('kits-song-delete').hidden=true;
  }
  function fillSongForm(){
    const selected=musicas.find(m=>String(m.id)===$('kits-admin-song-id').value);
    if(!selected){resetSongForm();return;}
    $('kits-song-title').value=selected.titulo;
    $('kits-song-description').value=selected.descricao||'';
    $('kits-song-published').checked=Boolean(selected.publicado);
    $('kits-song-save').textContent='Salvar alterações';
    $('kits-song-delete').hidden=false;
  }
  function resetTrackForm(keepSong=true){
    const song=keepSong?$('kits-admin-track-song').value:'';
    $('kits-track-form')?.reset();
    $('kits-admin-track-song').value=song;
    $('kits-admin-track-id').value='';
    $('kits-track-save').textContent='Adicionar faixa';
    $('kits-track-delete').hidden=true;
  }
  function fillTrackForm(){
    const selected=faixas.find(t=>String(t.id)===$('kits-admin-track-id').value);
    if(!selected){resetTrackForm();return;}
    $('kits-admin-track-song').value=String(selected.musica_id);
    $('kits-track-voice').value=selected.voz;
    $('kits-track-type').value=selected.tipo;
    $('kits-track-url').value=selected.url;
    $('kits-track-note').value=selected.observacao||'';
    $('kits-track-order').value=selected.ordem||0;
    $('kits-track-published').checked=Boolean(selected.publicado);
    $('kits-track-save').textContent='Salvar alterações';
    $('kits-track-delete').hidden=false;
  }
  function renderAdmin(){
    const panel=$('admin-kits-panel');
    if(!panel)return;
    if(!canManage()){panel.hidden=true;return;}
    const songSelect=$('kits-admin-song-id'),trackSong=$('kits-admin-track-song'),trackSelect=$('kits-admin-track-id');
    const oldSong=songSelect.value,oldTrackSong=trackSong.value,oldTrack=trackSelect.value;
    const sorted=[...musicas].sort((a,b)=>a.titulo.localeCompare(b.titulo,'pt-BR'));
    setOptions(songSelect,sorted,'Nova música',oldSong);
    setOptions(trackSong,sorted,'Selecione a música',oldTrackSong);
    const options=faixas.filter(t=>String(t.musica_id)===trackSong.value)
      .sort((a,b)=>(a.ordem||0)-(b.ordem||0)||a.voz.localeCompare(b.voz,'pt-BR'));
    if(trackSelect){
      trackSelect.replaceChildren();
      const op=e('option','','Nova faixa de voz');op.value='';trackSelect.append(op);
      for(const t of options){
        const opt=e('option','',t.voz+(t.publicado?'':' (oculta)'));opt.value=String(t.id);
        trackSelect.append(opt);
      }
      trackSelect.value=options.some(t=>String(t.id)===oldTrack)?oldTrack:'';
    }
    const list=$('kits-admin-list');
    if(list){
      list.replaceChildren();
      if(!musicas.length)list.append(e('p','muted','Nenhuma música cadastrada. Use o formulário acima para criar a primeira.'));
      for(const song of sorted){
        const card=e('article','kit-admin-item');
        const label=e('div','');
        label.append(e('strong','',song.titulo));
        label.append(e('small','',tracksFor(song,false).length+' faixa(s) · '+(song.publicado?'Publicada':'Rascunho')));
        const open=e('button','btn btn-outline btn-sm','Gerenciar');
        open.type='button';
        open.addEventListener('click',()=>{
          $('kits-admin-song-id').value=String(song.id);fillSongForm();
          $('kits-admin-track-song').value=String(song.id);
          renderAdmin();
          $('kits-admin-song-id').value=String(song.id);fillSongForm();
          $('kits-song-form')?.scrollIntoView({behavior:'smooth',block:'start'});
        });
        card.append(label,open);list.append(card);
      }
    }
    note('kits-admin-count',musicas.length+' música(s) • '+faixas.length+' faixa(s) cadastradas.');
  }
  async function saveSong(event){
    event.preventDefault();
    if(!canManage())return;
    const titulo=clean($('kits-song-title').value);
    const descricao=clean($('kits-song-description').value);
    if(titulo.length<2||titulo.length>180||descricao.length>1200){note('kits-admin-status','Confira o título e a descrição.',true);return;}
    const id=$('kits-admin-song-id').value;
    const record={titulo,descricao,publicado:$('kits-song-published').checked,atualizado_em:new Date().toISOString()};
    const btn=$('kits-song-save');btn.disabled=true;
    let query=id?ctx.db().from('site_kits_musicas').update(record).eq('id',id):ctx.db().from('site_kits_musicas').insert(record);
    const {data,error}=await query.select('id').maybeSingle();
    btn.disabled=false;
    if(error||!data){note('kits-admin-status','Falha ao salvar a música: '+(error?.message||'Sem permissão'),true);return;}
    await refresh();
    $('kits-admin-song-id').value=String(data.id);fillSongForm();
    $('kits-admin-track-song').value=String(data.id);renderAdmin();
    note('kits-admin-status','Música salva. Agora adicione as vozes no formulário de faixas.');
  }
  async function removeSong(){
    if(!canManage())return;
    const id=$('kits-admin-song-id').value,m=musicas.find(s=>String(s.id)===id);
    if(!m||!window.confirm('Excluir '+m.titulo+' e TODOS os kits de voz vinculados?'))return;
    const {data,error}=await ctx.db().from('site_kits_musicas').delete().eq('id',id).select('id').maybeSingle();
    if(error||!data){note('kits-admin-status','Não foi possível excluir: '+(error?.message||'Sem permissão'),true);return;}
    resetSongForm();resetTrackForm(false);await refresh();note('kits-admin-status','Música e seus kits excluídos.');
  }
  async function saveTrack(event){
    event.preventDefault();
    if(!canManage())return;
    const musica_id=Number($('kits-admin-track-song').value),voz=clean($('kits-track-voice').value),
      tipo=$('kits-track-type').value,url=canonicalLink(tipo,$('kits-track-url').value),
      observacao=clean($('kits-track-note').value),ordem=Number($('kits-track-order').value);
    if(!musicas.some(m=>Number(m.id)===musica_id)){note('kits-track-status','Selecione a música primeiro.',true);return;}
    if(voz.length<2||voz.length>80||!url||observacao.length>250||!Number.isInteger(ordem)||ordem<0||ordem>10000){
      note('kits-track-status','Verifique a voz, a ordem e o link. YouTube: link de vídeo; áudio: endereço HTTPS terminado em MP3, M4A, OGG ou WAV.',true);
      return;
    }
    const id=$('kits-admin-track-id').value;
    const record={musica_id,voz,tipo,url,observacao,ordem,publicado:$('kits-track-published').checked};
    const btn=$('kits-track-save');btn.disabled=true;
    const query=id?ctx.db().from('site_kits_faixas').update(record).eq('id',id):ctx.db().from('site_kits_faixas').insert(record);
    const {data,error}=await query.select('id').maybeSingle();btn.disabled=false;
    if(error||!data){note('kits-track-status','Não foi possível salvar faixa: '+(error?.message||'Sem permissão'),true);return;}
    await refresh();
    $('kits-admin-track-song').value=String(musica_id);
    renderAdmin();
    $('kits-admin-track-id').value=String(data.id);
    fillTrackForm();
    note('kits-track-status','Faixa cadastrada. A gravação permanece hospedada fora do portal.');
  }
  async function removeTrack(){
    if(!canManage())return;
    const id=$('kits-admin-track-id').value,t=faixas.find(x=>String(x.id)===id);
    if(!t||!window.confirm('Excluir a faixa '+t.voz+'?'))return;
    const {data,error}=await ctx.db().from('site_kits_faixas').delete().eq('id',id).select('id').maybeSingle();
    if(error||!data){note('kits-track-status','Não foi possível excluir: '+(error?.message||'Sem permissão'),true);return;}
    resetTrackForm();await refresh();note('kits-track-status','Faixa excluída.');
  }
  function init(context){
    ctx=context;
    if(!inited){
      inited=true;
      const search=$('kits-search');
      search?.addEventListener('input',()=>{searchTerm=norm(search.value);renderPublic();});
      $('kits-song-form')?.addEventListener('submit',saveSong);
      $('kits-admin-song-id')?.addEventListener('change',fillSongForm);
      $('kits-song-delete')?.addEventListener('click',removeSong);
      $('kits-song-cancel')?.addEventListener('click',resetSongForm);
      $('kits-track-form')?.addEventListener('submit',saveTrack);
      $('kits-admin-track-song')?.addEventListener('change',()=>{
        $('kits-admin-track-id').value='';
        renderAdmin();resetTrackForm();
      });
      $('kits-admin-track-id')?.addEventListener('change',fillTrackForm);
      $('kits-track-delete')?.addEventListener('click',removeTrack);
      $('kits-track-cancel')?.addEventListener('click',()=>resetTrackForm());
    }
    void refresh();
  }
  function onAuthChange(){
    if(!ctx)return;
    void refresh();
  }
  return {init,onAuthChange,refresh,canonicalLink};
})();