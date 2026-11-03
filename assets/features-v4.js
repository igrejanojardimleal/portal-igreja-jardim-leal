/* IGJAL — funcionalidades V4. Módulos públicos são somente leitura; gravar exige RLS de administrador. */
window.IGREJA_V4 = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const config = window.IGREJA_CONFIG || {};
  const mediaOverrides = new Map();
  const identity = new Map();
  let ctx = null, favoritesOnly = false, culto = false, currentAdminTab = 'comments';
  let lastPending = null, adminPoll = null, eventRows = [], noticeRows = [], auditRows = [];
  let noticeAll = [], eventAll = [];
  const FAV_KEY = 'igjal-hinos-favoritos-v1';
  const tr=window.IGREJA_TRANSPOSE;
  function fillPreviewTones(){
    const select=$('admin-preview-key');if(!select||!tr)return;
    select.replaceChildren();
    for(let i=0;i<12;i++){const opt=E('option','',tr.LABELS[i]+' ('+tr.NOTES[i]+')');opt.value=tr.NOTES[i];select.append(opt);}
  }
  function previewSong(){
    const target=$('admin-preview-key'),box=$('admin-preview-output');if(!target||!box||!tr)return;
    const text=fieldVal('edit-song-chords'),key=fieldVal('edit-song-key');
    const info=tr.keyInfo(key);const recognized=tr.countChords(text);
    if(!text){box.textContent='Nenhuma cifra digital digitada. O PDF original fica disponível separadamente.';status('admin-preview-status','');return;}
    if(!info){box.textContent=text;status('admin-preview-status','Informe um tom original válido (ex.: C, Dó#, Am, Bb) para transpor.',true);return;}
    if(!recognized){box.textContent=text;status('admin-preview-status','Nenhum acorde identificado. Use linhas de acordes ou marcadores como [C].',true);return;}
    box.textContent=tr.transpose(text,key,target.value)||text;
    status('admin-preview-status',`${recognized} acorde(s) identificado(s). Prévia em ${tr.LABELS[tr.keyInfo(target.value).index]}. Revise antes de publicar.`);
  }
  function E(tag, klass, text) {const n=document.createElement(tag);if(klass)n.className=klass;if(text!==undefined)n.textContent=String(text);return n;}
  function status(id,msg,bad=false){if(!$(id))return;$(id).textContent=msg;$(id).classList.toggle('error',bad);}
  function normalized(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function safeImage(src){return /^(assets\/fotos\/[\w./-]+\.(?:jpg|jpeg|png|webp|svg)|https:\/\/[\w.-]+(?:\:[0-9]+)?\/[\w\-\/%?.=&]+\.(?:jpg|jpeg|png|webp)(?:\?[\w=&%-]+)?)$/i.test(String(src||'')) && !String(src).includes('..');}
  function formatDate(iso,withTime=false){try{return new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(iso));}catch(_){return '';}}
  function admin(){return ctx?.isAdmin?.()===true;}
  function eventAdmin(){return admin() || ctx?.isEventsAdmin?.()===true;}
  function muralAdmin(){return admin() || ctx?.isMuralModerator?.()===true;}
  function studyReviewer(){return admin() || ctx?.isStudyReviewer?.()===true;}
  function eventTable(table){return ['site_eventos','site_avisos'].includes(table);}
  function client(){return ctx?.db?.()||null;}
  function favRead(){try{const x=JSON.parse(localStorage.getItem(FAV_KEY)||'[]');return Array.isArray(x)?x.filter(Number.isInteger):[];}catch(_){return [];}}
  function favWrite(nums){try{localStorage.setItem(FAV_KEY,JSON.stringify(nums));}catch(_){/* storage opcional */}}
  function isFavorite(n){return favRead().includes(Number(n));}
  function setFavorite(n){if(!Number.isInteger(n))return;const a=new Set(favRead());if(a.has(n))a.delete(n);else a.add(n);favWrite([...a]);onSongRendered({number:n});ctx?.refreshSongs?.();}
  function onSongRendered(song){if(!song)return;const b=$('favorite-song');if(b){const yes=isFavorite(song.number);b.textContent=yes?'★ Salvo':'☆ Favorito';b.setAttribute('aria-pressed',String(yes));}}
  function updateCulto(){
    const dlg=$('song-dialog');if(!dlg)return;
    dlg.classList.toggle('modo-culto',culto);
    document.body.classList.toggle('culto-open',culto && dlg.open);
    // A área da comunidade é exibida apenas fora do Modo Culto.
    const community=dlg.querySelector('.hino-comunidade');
    if(community){
      community.hidden=culto;
      community.setAttribute('aria-hidden',String(culto));
    }
    const b=$('modo-culto');
    if(b){
      b.setAttribute('aria-pressed',String(culto));
      b.textContent=culto?'□ Sair do Modo Culto':'▣ Ativar Modo Culto';
    }
  }
  function switchHymn(delta){const selected=ctx?.getSelectedSong?.();if(!selected)return;const list=[...ctx.songs].sort((a,b)=>a.number-b.number);const index=list.findIndex(x=>x.number===selected.number);if(index<0)return;const next=list[(index+delta+list.length)%list.length];ctx.openSong(next,'letra');if($('song-dialog-content'))$('song-dialog-content').scrollTop=0;if($('culto-status'))$('culto-status').textContent=`Hino ${next.number}: ${next.title}`;updateCulto();}
  function initCulto(){
    if(!$('song-dialog'))return;
    $('favorite-song')?.addEventListener('click',()=>setFavorite(ctx.getSelectedSong()?.number));
    $('favorites-filter')?.addEventListener('click',()=>{favoritesOnly=!favoritesOnly;const b=$('favorites-filter');b.textContent=favoritesOnly?'★ Mostrando favoritos':'☆ Ver favoritos';b.setAttribute('aria-pressed',String(favoritesOnly));ctx.refreshSongs();});
    $('modo-culto')?.addEventListener('click',()=>{culto=!culto;updateCulto();ctx.refreshDialog?.();if(culto){requestAnimationFrame(()=>{const dlg=$('song-dialog');const lyrics=$('song-dialog-content');if(dlg)dlg.scrollTop=0;if(lyrics)lyrics.scrollTop=0;});}});
    $('prev-hino')?.addEventListener('click',()=>switchHymn(-1));
    $('next-hino')?.addEventListener('click',()=>switchHymn(1));
    $('copy-hino-link')?.addEventListener('click',async()=>{const n=ctx.getSelectedSong()?.number;if(!n)return;const url=new URL('louvores.html?hino='+n,location.href).href;try{await navigator.clipboard.writeText(url);status('culto-status','Link copiado.');}catch(_){status('culto-status',url);}});
    $('song-dialog').addEventListener('close',()=>{culto=false;updateCulto();});
    document.addEventListener('keydown',ev=>{
      if(!$('song-dialog')?.open||!culto)return;
      if(ev.target.matches('input,textarea,select'))return;
      if(ev.key==='ArrowRight'){ev.preventDefault();switchHymn(1);}
      if(ev.key==='ArrowLeft'){ev.preventDefault();switchHymn(-1);}
      if(ev.key==='Escape'){culto=false;updateCulto();}
    });
  }
  function keepSong(song){return !favoritesOnly || isFavorite(song.number);}
  function getMedia(n){return mediaOverrides.get(Number(n))||null;}
  function renderAlerts(){
    for(const [id,limit] of [['home-alerts',3],['agenda-notices',50]]){
      const node=$(id);if(!node)continue;node.replaceChildren();const now=new Date().toISOString().slice(0,10);
      const visible=noticeAll.filter(x=>x.publicado && (!x.valido_ate||x.valido_ate>=now)).slice(0,limit);
      if(!visible.length){node.append(E('p','blank-notice',id==='home-alerts'?'Ainda não há avisos cadastrados. A programação oficial será divulgada aqui.':'Não há avisos oficiais ativos neste momento.'));continue;}
      for(const r of visible){const card=E('article','notice-card');card.append(E('span','overline','AVISO OFICIAL'),E('h3','',r.titulo),E('p','',r.mensagem));if(r.valido_ate)card.append(E('small','','Válido até '+formatDate(r.valido_ate)));node.append(card);}
    }
  }
  function renderEvents(){const host=$('agenda-events');if(!host)return;host.replaceChildren();const now=Date.now()-6e7;const limit=Date.now()+90*86400000;const arr=eventAll.filter(x=>x.publicado && new Date(x.inicio_em).getTime()>=now && new Date(x.inicio_em).getTime()<=limit).sort((a,b)=>new Date(a.inicio_em)-new Date(b.inicio_em));if(!arr.length){host.append(E('div','empty-state','A igreja ainda não publicou os próximos horários e encontros.'));return;}
    for(const r of arr){const card=E('article','event-card');const date=E('div','event-date');date.append(E('span','',new Intl.DateTimeFormat('pt-BR',{day:'2-digit'}).format(new Date(r.inicio_em))),E('small','',new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(r.inicio_em))));const body=E('div','event-info');body.append(E('h4','',r.titulo),E('strong','',formatDate(r.inicio_em,true)),E('p','',r.descricao||''));if(r.local)body.append(E('small','','Local: '+r.local));card.append(date,body);host.append(card);}
  }
  function renderIdentity(){
    const intro=identity.get('history_intro'),detail=identity.get('history_detail');
    if(intro && $('history-intro'))$('history-intro').textContent=intro;
    if(detail && $('history-detail'))$('history-detail').textContent=detail;
    const contact=identity.get('contact');if(contact&&$('footer-contact'))$('footer-contact').textContent=contact;
    const hero=identity.get('hero_photo_url');if(hero&&safeImage(hero)&&$('hero-official-photo')){
      $('official-hero-image').src=hero;$('hero-official-photo').hidden=false;const old=document.querySelector('.hero-art');if(old)old.hidden=true;
    }
    const history=identity.get('history_photo_url');if(history&&safeImage(history)&&$('official-history-photo')){
      const wrap=$('official-history-photo');wrap.replaceChildren();const img=E('img');img.src=history;img.alt='Registro fotográfico da história da Igreja no Jardim Leal';img.loading='lazy';wrap.append(img);
    }
    const logo=identity.get('logo_url');if(logo&&safeImage(logo))document.querySelectorAll('.brand-icon').forEach(slot=>{slot.replaceChildren();const img=E('img');img.src=logo;img.alt='Logotipo oficial da Igreja no Jardim Leal';slot.append(img);});
  }
  function fieldVal(id){return ($(id)?.value||'').trim();}
  function fillSelect(){const select=$('edit-media-hino');if(!select)return;select.replaceChildren();for(const song of [...ctx.songs].sort((a,b)=>a.number-b.number)){const opt=E('option','',`${String(song.number).padStart(2,'0')} — ${song.title}`);opt.value=String(song.number);select.append(opt);}}
  async function fetchPublic(){const db=client();if(!db)return;const jobs=[
    ['hinos_edicoes','numero,titulo,letra,cifra,tom,autor'],
    ['site_eventos','id,titulo,inicio_em,local,descricao,publicado'],
    ['site_avisos','id,titulo,mensagem,valido_ate,publicado,criado_em'],
    ['site_midias','hino_numero,tipo,youtube_id,audio_url'],
    ['site_identidade','chave,valor']
  ];
    const got=await Promise.all(jobs.map(async([table,cols])=>{const {data,error}=await db.from(table).select(cols);if(error){console.warn('Módulo '+table+' indisponível:',error.message);return [];}return data||[];}));
    for(const r of got[0]){
      if(!Number.isInteger(r.numero))continue;const existing=ctx.songs.find(x=>x.number===r.numero);
      const next={number:r.numero,title:r.titulo,lyrics:r.letra,chords:r.cifra||'',key:r.tom||'',author:r.autor||''};
      if(existing)Object.assign(existing,next);else ctx.songs.push(next);
    }
    ctx.songs.sort((a,b)=>a.number-b.number);
    eventAll=got[1];noticeAll=got[2];
    mediaOverrides.clear();for(const r of got[3]){if(r.tipo==='youtube'&&/^[\w-]{11}$/.test(r.youtube_id||''))mediaOverrides.set(r.hino_numero,{type:'youtube',youtubeId:r.youtube_id});else if(r.tipo==='audio'&&safeAudio(r.audio_url))mediaOverrides.set(r.hino_numero,{type:'audio',src:r.audio_url});}
    identity.clear();for(const r of got[4])identity.set(r.chave,r.valor);
    renderEvents();renderAlerts();renderIdentity();fillSelect();ctx.refreshSongs?.();if(ctx.getSelectedSong?.())ctx.refreshDialog?.();
  }
  function safeAudio(input){try{const value=String(input||'');return /^assets\/audio\/[\w.-]+\.(?:mp3|ogg|m4a)$/i.test(value)||((new URL(value)).protocol==='https:'&&/\.(mp3|ogg|m4a)(?:\?.*)?$/i.test(value));}catch(_){return false;}}
  // EMV Pix estático conforme padrão do BR Code. Só exibimos após confirmação dos dados oficiais.
  function tlv(id,value){return id+String(value.length).padStart(2,'0')+value;}
  function crc16(s){let crc=0xffff;for(let i=0;i<s.length;i++){crc^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xffff;}}return crc.toString(16).toUpperCase().padStart(4,'0');}
  function pixPayload(key,beneficiary,city){const safe=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 .-]/g,' ').trim();const name=safe(beneficiary).slice(0,25),place=safe(city).slice(0,15);if(!name||!place||!key)return '';
    const mai=tlv('00','br.gov.bcb.pix')+tlv('01',key);const payload=tlv('00','01')+tlv('26',mai)+tlv('52','0000')+tlv('53','986')+tlv('58','BR')+tlv('59',name)+tlv('60',place)+tlv('62',tlv('05','***'))+'6304';return payload+crc16(payload);
  }
  function initPixQR(){const holder=$('pix-qrcode');if(!holder)return;const key=String(config.pix?.key||''),name=String(config.pix?.beneficiary||''),city=String(config.pix?.city||'');if(!name||!city){status('pix-qr-message','QR Code em preparação. Confirme os dados do beneficiário e da cidade da conta antes de ativar. Você já pode copiar a chave Pix oficial.');return;}
    const code=pixPayload(key,name,city);if(!code||typeof window.QRCode!=='function'){status('pix-qr-message','O gerador de QR Code não carregou. Utilize a chave Pix acima.');return;}
    holder.replaceChildren();new window.QRCode(holder,{text:code,width:176,height:176,correctLevel:window.QRCode.CorrectLevel.M});status('pix-qr-message','QR Code da chave Pix da igreja. Confira o nome do beneficiário no aplicativo bancário antes de confirmar.');
  }
  function adminEditorEnabled(){return admin()&&client();}
  function eventEditorEnabled(){return eventAdmin()&&client();}
  async function adminUpsert(table,row,onConflict){if(!(eventTable(table)?eventEditorEnabled():adminEditorEnabled()))throw new Error('Sem permissão para esta área.');const res=await client().from(table).upsert(row,onConflict?{onConflict}:undefined);if(res.error)throw res.error;}
  async function adminDelete(table,id){if(!(eventTable(table)?eventEditorEnabled():adminEditorEnabled()))throw new Error('Acesso negado.');const res=await client().from(table).delete().eq('id',id);if(res.error)throw res.error;}
  function updateAdminTabs(){
    if(!admin()){
      const allowed=(currentAdminTab==='agenda'&&eventAdmin()) ||
        ((currentAdminTab==='comments'||currentAdminTab==='hino-comentarios')&&muralAdmin()) ||
        (currentAdminTab==='estudos'&&studyReviewer());
      if(!allowed){
        if(eventAdmin())currentAdminTab='agenda';
        else if(muralAdmin())currentAdminTab='comments';
        else if(studyReviewer())currentAdminTab='estudos';
      }
    }
    const overview=document.querySelector('.admin-overview');
    if(overview)overview.hidden=!admin();
    if($('admin-reload-pix-copies'))$('admin-reload-pix-copies').hidden=!admin();
    if($('admin-enable-notifications'))$('admin-enable-notifications').hidden=!admin();
    document.querySelectorAll('[data-admin-view]').forEach(button=>{
      const name=button.dataset.adminView;
      button.hidden=!admin() && !((name==='agenda'&&eventAdmin())||((name==='comments'||name==='hino-comentarios')&&muralAdmin())||(name==='estudos'&&studyReviewer()));
      const active=name===currentAdminTab;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    for(const key of ['comments','hino-comentarios','cifras','hinos','agenda','midias','live','identidade','estudos','historico','usuarios']){
      const panel=$(`admin-${key}-panel`);
      if(panel)panel.hidden=key!==currentAdminTab;
    }
  }
  async function loadPanel(name){
    if(!admin() && !((name==='agenda'&&eventAdmin()) || ((name==='comments'||name==='hino-comentarios')&&muralAdmin()) || (name==='estudos'&&studyReviewer())))return;
    currentAdminTab=name;updateAdminTabs();
    if(name==='comments'){ctx.loadModeration?.();return;}
    if(name==='hino-comentarios'){await window.IGREJA_COMUNIDADE?.loadModeration?.();return;}
    if(name==='usuarios'){await window.IGREJA_ACESSOS?.refresh?.();return;}
    if(name==='live'){await window.IGREJA_LIVE?.refreshAdmin?.();return;}
    if(name==='estudos'){await window.IGREJA_ESTUDOS?.refreshAdmin?.(ctx);return;}
    if(!(name==='agenda'?eventEditorEnabled():adminEditorEnabled()))return;
    if(name==='cifras')ctx.loadCifras?.();
    if(name==='agenda')await refreshAgendaAdmin();
    if(name==='midias')await refreshMediaAdmin();
    if(name==='identidade')refreshIdentityForm();
    if(name==='historico')await loadAudit();
    // Estudos são carregados antecipadamente para os revisores na seção específica.
  }
  function initAdminTabs(){document.querySelectorAll('[data-admin-view]').forEach(b=>b.addEventListener('click',()=>loadPanel(b.dataset.adminView)));updateAdminTabs();}
  function readSongForm(){const num=Number(fieldVal('edit-song-number'));return {numero:num,titulo:fieldVal('edit-song-title'),autor:fieldVal('edit-song-author'),tom:fieldVal('edit-song-key'),letra:fieldVal('edit-song-lyrics'),cifra:fieldVal('edit-song-chords')};}
  function loadSongForm(){const n=Number(fieldVal('edit-song-number'));const s=ctx.songs.find(x=>x.number===n);if(!s){status('admin-hino-status','Número não encontrado. Preencha um novo hino e salve.');return;}for(const [id,val] of [['edit-song-title',s.title],['edit-song-author',s.author],['edit-song-key',s.key],['edit-song-lyrics',s.lyrics],['edit-song-chords',s.chords]])$(id).value=val||'';status('admin-hino-status',`Hino ${n} carregado. Revise e salve as alterações.`);const info=tr?.keyInfo(s.key);if(info&&$('admin-preview-key'))$('admin-preview-key').value=tr.NOTES[info.index];previewSong();}
  function initAdminEditors(){
    if(!$('admin-content'))return;initAdminTabs();$('admin-enable-notifications')?.addEventListener('click',async()=>{if(!('Notification' in window))return status('admin-notification','Este navegador não oferece notificações do sistema.',true);try{const permission=await Notification.requestPermission();status('admin-notification',permission==='granted'?'Alertas autorizados enquanto esta página estiver aberta.':'Sem permissão de notificações. As pendências continuarão no painel.');}catch(_){status('admin-notification','Notificações não disponíveis neste ambiente.',true);}});
    fillPreviewTones();
    const detect=$('admin-detect-key');
    detect?.addEventListener('click',()=>{
      if(!admin())return status('admin-key-suggestion','Acesso administrativo necessário.',true);
      const candidate=tr?.suggestKeys?.(fieldVal('edit-song-chords'));
      if(!candidate)return status('admin-key-suggestion','O módulo de análise não carregou.',true);
      if(candidate.status==='insuficiente')return status('admin-key-suggestion',candidate.message,true);
      const alts=candidate.candidates.map(o=>`${o.note} (${o.key})`).join(' • ');
      status('admin-key-suggestion',`${candidate.message} Alternativas: ${alts}. Clique em confirmar somente depois da revisão musical.`);
      const ok=window.confirm(`Tom sugerido: ${candidate.candidates[0].note} (${candidate.candidates[0].key}).\n\nÉ apenas uma hipótese. Você conferiu este tom musicalmente e deseja preencher o campo?`);
      if(ok){$('edit-song-key').value=candidate.candidates[0].key;previewSong();}
    });
    const updatePixCount=async()=>{
      if(!adminEditorEnabled())return;
      try {const {data,error}=await client().rpc('total_copias_pix');
        if(error)throw error;
        status('pix-copies-total',`${Number(data||0).toLocaleString('pt-BR')} cópias do Pix`);
      } catch(_) {status('pix-copies-total','— cópias do Pix (banco não configurado)');}
    };
    $('admin-reload-pix-copies')?.addEventListener('click',updatePixCount);
    if($('pix-copies-total'))window.setInterval(()=>{if(adminEditorEnabled()&&!document.hidden)updatePixCount();},60000);
    window.IGREJA_REFRESH_PIX_ADMIN=updatePixCount;
    ['edit-song-key','edit-song-chords','admin-preview-key'].forEach(id=>$(id)?.addEventListener('input',previewSong));
    $('admin-preview-key')?.addEventListener('change',previewSong);
    $('admin-load-hino')?.addEventListener('click',loadSongForm);
    $('admin-hino-form')?.addEventListener('submit',async(ev)=>{ev.preventDefault();const s=readSongForm();if(!Number.isInteger(s.numero)||s.numero<1||s.numero>9999||!s.titulo||!s.letra)return status('admin-hino-status','Informe número, título e letra completa.',true);if(s.cifra && !tr?.keyInfo(s.tom))return status('admin-hino-status','Para salvar cifra digital, informe um tom original válido (C, C#, D, Am, Bb etc.).',true);if(s.cifra && !tr.countChords(s.cifra))return status('admin-hino-status','Nenhum acorde reconhecido. Use linhas só de acordes ou [C] inline e confira a prévia.',true);try{await adminUpsert('hinos_edicoes',s,'numero');status('admin-hino-status','Hino salvo e publicado.');await fetchPublic();}catch(err){status('admin-hino-status','Erro ao salvar: '+err.message,true);}});
    $('admin-event-form')?.addEventListener('submit',async ev=>{ev.preventDefault();const t=fieldVal('edit-event-title'),raw=fieldVal('edit-event-date');if(!t||!raw)return status('admin-event-status','Informe título e data.',true);try{await adminUpsert('site_eventos',{titulo:t,inicio_em:new Date(raw).toISOString(),local:fieldVal('edit-event-location'),descricao:fieldVal('edit-event-description'),publicado:$('edit-event-published').checked});$('admin-event-form').reset();status('admin-event-status','Evento cadastrado.');await fetchPublic();await refreshAgendaAdmin();}catch(err){status('admin-event-status','Erro: '+err.message,true);}});
    $('admin-notice-form')?.addEventListener('submit',async ev=>{ev.preventDefault();if(!fieldVal('edit-notice-title')||!fieldVal('edit-notice-body'))return status('admin-notice-status','Preencha título e aviso.',true);try{await adminUpsert('site_avisos',{titulo:fieldVal('edit-notice-title'),mensagem:fieldVal('edit-notice-body'),valido_ate:fieldVal('edit-notice-until')||null,publicado:$('edit-notice-published').checked});$('admin-notice-form').reset();status('admin-notice-status','Aviso cadastrado.');await fetchPublic();await refreshAgendaAdmin();}catch(err){status('admin-notice-status','Erro: '+err.message,true);}});
    $('admin-media-form')?.addEventListener('submit',async ev=>{ev.preventDefault();const number=Number(fieldVal('edit-media-hino')),type=fieldVal('edit-media-type'),value=fieldVal('edit-media-value');const yt=/^[\w-]{11}$/.test(value)?value:(value.match(/(?:youtu\.be\/|[?&]v=|youtube\.com\/shorts\/)([\w-]{11})/)||[])[1];if(type==='youtube'&&!yt)return status('admin-media-status','Informe um ID/link válido de vídeo do YouTube.',true);if(type==='audio'&&!safeAudio(value))return status('admin-media-status','Informe URL HTTPS de arquivo MP3/OGG/M4A ou caminho assets/audio/...',true);
      try{await adminUpsert('site_midias',{hino_numero:number,tipo:type,youtube_id:type==='youtube'?yt:null,audio_url:type==='audio'?value:null},'hino_numero');status('admin-media-status','Gravação vinculada ao hino.');await fetchPublic();await refreshMediaAdmin();}catch(err){status('admin-media-status','Erro: '+err.message,true);}
    });
    $('admin-identity-form')?.addEventListener('submit',async ev=>{ev.preventDefault();const list=[['history_intro','edit-history-intro'],['history_detail','edit-history-detail'],['logo_url','edit-logo-url'],['hero_photo_url','edit-hero-url'],['history_photo_url','edit-history-url'],['contact','edit-contact']];try{
      for(const [key,id] of list){const value=fieldVal(id);if(key.includes('_url')&&value&&!safeImage(value))return status('admin-identity-status','Imagem inválida em '+id+'. Use HTTPS ou assets/fotos/arquivo.jpg.',true);await adminUpsert('site_identidade',{chave:key,valor:value},'chave');}
      status('admin-identity-status','Informações oficiais atualizadas.');await fetchPublic();}catch(err){status('admin-identity-status','Erro: '+err.message,true);}
    });
  }
  function moderationLine(title,subtitle,content,btnLabel,onClick){const box=E('article','moderation-item');box.append(E('h3','',title));if(subtitle)box.append(E('small','',subtitle));if(content)box.append(E('p','',content));if(btnLabel){const b=E('button','btn btn-outline',btnLabel);b.type='button';b.addEventListener('click',onClick);box.append(b);}return box;}
  async function refreshAgendaAdmin(){if(!eventEditorEnabled()||!$('admin-event-list'))return;for(const [table,hostId,title,describe] of [['site_eventos','admin-event-list',r=>r.titulo,r=>formatDate(r.inicio_em,true)+' • '+(r.publicado?'Publicado':'Rascunho')],['site_avisos','admin-notice-list',r=>r.titulo,r=>r.mensagem.slice(0,100)+' • '+(r.publicado?'Publicado':'Rascunho')]]){
    const {data,error}=await client().from(table).select('*').order('criado_em',{ascending:false}).limit(100);const host=$(hostId);host.replaceChildren();if(error){host.append(E('p','','Não foi possível carregar os registros.'));continue;}
    for(const row of data||[]){const node=moderationLine(title(row),describe(row),'','Excluir',async()=>{if(!confirm('Excluir este registro definitivamente?'))return;try{await adminDelete(table,row.id);await fetchPublic();await refreshAgendaAdmin();}catch(err){alert('Erro ao excluir: '+err.message);}});host.append(node);}
  }}
  async function refreshMediaAdmin(){const host=$('admin-media-list');if(!host||!adminEditorEnabled())return;const {data,error}=await client().from('site_midias').select('*').order('hino_numero');host.replaceChildren();if(error){host.append(E('p','','Não foi possível carregar mídias.'));return;}for(const r of data||[]){const box=moderationLine(`Hino ${r.hino_numero} — ${r.tipo==='youtube'?'Vídeo YouTube':'Áudio'}`,'Mídia oficial vinculada',r.youtube_id||r.audio_url,'Remover mídia',async()=>{if(!confirm('Remover mídia deste hino?'))return;const {error}=await client().from('site_midias').delete().eq('hino_numero',r.hino_numero);if(error)return alert('Erro: '+error.message);await fetchPublic();await refreshMediaAdmin();});host.append(box);}}
  function refreshIdentityForm(){for(const [key,id] of [['history_intro','edit-history-intro'],['history_detail','edit-history-detail'],['logo_url','edit-logo-url'],['hero_photo_url','edit-hero-url'],['history_photo_url','edit-history-url'],['contact','edit-contact']])if($(id))$(id).value=identity.get(key)||((key==='history_intro'||key==='history_detail')?window.IGREJA_DATA?.history?.[key==='history_intro'?'intro':'detail']||'':'');}
  async function loadAudit(){const host=$('admin-audit-list');if(!host||!adminEditorEnabled())return;host.replaceChildren();const {data,error}=await client().from('site_moderacao_historico').select('acao,tipo,referencia_id,criado_em').order('criado_em',{ascending:false}).limit(40);if(error){host.append(E('p','','O histórico será exibido após configurar o banco.'));return;}for(const r of data||[]){host.append(moderationLine(`${r.acao} • ${r.tipo}`,formatDate(r.criado_em,true),`Registro ${r.referencia_id}`));}if(!(data||[]).length)host.append(E('p','','Ainda não há decisões registradas.'));}
  async function pendingCount(){if(!adminEditorEnabled())return;try{const queries=await Promise.all([client().from('comentarios').select('*',{head:true,count:'exact'}).eq('status','pendente'),client().from('cifra_envios').select('*',{head:true,count:'exact'}).eq('status','pendente')]);if(queries.some(x=>x.error))return;const current=(queries[0].count||0)+(queries[1].count||0);if($('admin-v4-queue-total'))$('admin-v4-queue-total').textContent=String(current);if($('pending-badge'))$('pending-badge').textContent=String(current);if($('pending-link'))$('pending-link').hidden=current===0;document.title=current?`(${current}) Administração • Igreja no Jardim Leal`:'Administração • Igreja no Jardim Leal';if(lastPending!==null && current>lastPending && document.visibilityState==='visible'){status('admin-notification',`Há ${current-lastPending} nova(s) pendência(s) para revisar.`);if('Notification' in window&&Notification.permission==='granted'){try{new Notification('Igreja no Jardim Leal — moderação',{body:`${current} envio(s) aguardando análise.`});}catch(_){/* permissões do navegador */}}}lastPending=current;}catch(_){/* servidor ainda não preparado */}}
  async function onAuthChange(){
    if(!ctx)return;
    updateAdminTabs();
    if(admin()||eventAdmin()||muralAdmin()||studyReviewer()){
      if(admin()){
        await pendingCount();
        if(!adminPoll)adminPoll=setInterval(()=>{if(!document.hidden)pendingCount();},60000);
      }
      await loadPanel(currentAdminTab);
    }else{
      if(adminPoll){clearInterval(adminPoll);adminPoll=null;}
      lastPending=null;
    }
  }
  async function init(context){ctx=context;initCulto();initPixQR();initAdminEditors();await fetchPublic();await onAuthChange();}
  return {init,keepSong,getMedia,onSongRendered,onAuthChange,loadPanel,isCulto:()=>culto};
})();