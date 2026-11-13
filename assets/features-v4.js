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
  function areaAllowed(area){return admin() || ctx?.hasArea?.(area)===true;}
  const tabAreas={cifras:'cifras',hinos:'hinos',midias:'midias',kits:'kits',live:'live',identidade:'identidade'};
  const catalogoBase=new Map();
  function tabAllowed(name){
    if(admin())return true;
    if(name==='agenda')return eventAdmin();
    if(name==='comments')return muralAdmin();
    if(name==='hino-comentarios')return areaAllowed('comentarios_hinos');
    if(name==='verificacoes')return ctx?.canVerify?.()===true;
    if(name==='hinos'||name==='cifras')return areaAllowed('hinos')||areaAllowed('cifras');
    if(name==='historico')return admin()||eventAdmin()||areaAllowed('hinos')||areaAllowed('cifras')||areaAllowed('midias')||areaAllowed('kits')||areaAllowed('live')||areaAllowed('identidade')||areaAllowed('editor_estudos');
    if(name==='estudos')return studyReviewer()||areaAllowed('editor_estudos');
    return Boolean(tabAreas[name]&&areaAllowed(tabAreas[name]));
  }
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
  function eventShareText(item,link){
    // Convite breve para acompanhar o cartaz em imagem; usa caracteres compatíveis com WhatsApp.
    const title=String(item.titulo||'Encontro da igreja').trim();
    const location=String(item.local||'').trim();
    const churchEvent=/^(?:igjal|igreja no jardim leal|igreja do jardim leal|templo(?: da igreja| igjal)?|sede da igreja)$/i.test(normalized(location));
    const date=new Date(item.inicio_em);
    const validDate=!Number.isNaN(date.getTime());
    const day=validDate
      ?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}).format(date)
      :formatDate(item.inicio_em);
    const time=validDate
      ?new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Sao_Paulo'}).format(date).replace(':','h')
      :'';
    const parts=[
      '*'+title+' | IGJAL*',
      'Você e sua família são nossos convidados!',
      '',
      '*Quando:* '+day+(time?' às '+time:''),
      '*Local:* '+(location||'Consulte a agenda')
    ];
    if(churchEvent)parts.push('*Endereço:* Rua João Clementino, 831 - Jardim Leal');
    parts.push('','*Detalhes e localização:*',link,'','Esperamos você!');
    return parts.join('\n');
  }
  function eventLink(item){
    const url=new URL('agenda.html',window.location.href);
    url.searchParams.set('evento',String(item.id));
    return url.href;
  }
  async function copyEventLink(button,url){
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Navegador sem área de transferência');
      await navigator.clipboard.writeText(url);
      button.textContent='✓ Link copiado';
      window.setTimeout(()=>{
        if(button.isConnected)button.textContent='Copiar link';
      },2000);
    }catch(_){
      window.prompt('Copie o link para compartilhar:',url);
    }
  }

  // Convite de evento em PNG 1080x1920 (9:16), gerado com dados oficiais da agenda.
  function inviteRounded(g,x,y,w,h,r,fill){
    const d=Math.min(r,w/2,h/2);
    g.beginPath();g.moveTo(x+d,y);g.lineTo(x+w-d,y);
    g.quadraticCurveTo(x+w,y,x+w,y+d);g.lineTo(x+w,y+h-d);
    g.quadraticCurveTo(x+w,y+h,x+w-d,y+h);g.lineTo(x+d,y+h);
    g.quadraticCurveTo(x,y+h,x,y+h-d);g.lineTo(x,y+d);
    g.quadraticCurveTo(x,y,x+d,y);g.closePath();
    g.fillStyle=fill;g.fill();
  }
  function inviteWrap(g,value,maxWidth){
    const words=String(value||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
    const lines=[];let line='';
    for(const word of words){
      const candidate=line?line+' '+word:word;
      if(!line||g.measureText(candidate).width<=maxWidth){line=candidate;continue;}
      lines.push(line);line=word;
    }
    if(line)lines.push(line);
    return lines;
  }
  function inviteText(g,value,x,y,maxWidth,font,lineHeight,color,maxLines=2,align='left'){
    g.fillStyle=color;g.font=font;g.textAlign=align;
    const lines=inviteWrap(g,value,maxWidth);
    for(let i=0;i<Math.min(maxLines,lines.length);i++){
      const line=lines[i];
      g.fillText(line,x,y+i*lineHeight,maxWidth);
    }
    g.textAlign='left';
    return Math.min(maxLines,lines.length);
  }
  function inviteIsChurch(item){
    const venue=normalized(item.local||'');
    return /^(igjal|igreja no jardim leal|igreja do jardim leal|templo( da igreja| igjal)?|sede da igreja)$/.test(venue);
  }
  function inviteLogo(){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src=new URL('assets/fotos/logo-igreja-oficial.png',window.location.href).href;
    });
  }
  function eventVisualTheme(item){
    const name=normalized(String(item.titulo||'')+' '+String(item.tipo||''));
    if(/musica|orquestra|instrument|coral|louvor|adorac|ensaio/.test(name))
      return {kind:'music',label:'MÚSICA E ADORAÇÃO',main:'#123749',mid:'#285c72',end:'#327d79',accent:'#ffe0a5',light:'#cbe9e4'};
    if(/batism/.test(name))
      return {kind:'water',label:'CELEBRAÇÃO DE FÉ',main:'#123e62',mid:'#327a9d',end:'#60aaad',accent:'#dbf5fa',light:'#cfefff'};
    if(/jovens?|juventude|mocidade|adolesc|crianca|infantil/.test(name))
      return {kind:'youth',label:'ENCONTRO ESPECIAL',main:'#392e67',mid:'#655598',end:'#ad6796',accent:'#ffcfbd',light:'#f0ddff'};
    if(/orac|vigilia|intercess/.test(name))
      return {kind:'prayer',label:'FÉ E COMUNHÃO',main:'#3f374e',mid:'#675c77',end:'#9b7d76',accent:'#ffe6b8',light:'#f3e3eb'};
    if(/mission|evangel|congresso/.test(name))
      return {kind:'mission',label:'ENCONTRO DA IGREJA',main:'#254b4c',mid:'#427566',end:'#8f9364',accent:'#ffebb4',light:'#e2f1d5'};
    return {kind:'church',label:'PROGRAMAÇÃO DA IGJAL',main:'#0c3947',mid:'#235e70',end:'#34847b',accent:'#ffe2aa',light:'#d6f0e8'};
  }
  function eventMotif(g,theme){
    g.save();g.globalAlpha=.16;g.strokeStyle=theme.light;g.lineWidth=3;
    for(let n=0;n<5;n++){
      g.beginPath();g.arc(1040,70,155+n*38,0,Math.PI*2);g.stroke();
    }
    if(theme.kind==='music'){
      g.lineWidth=3;
      for(let row=0;row<5;row++){
        g.beginPath();g.moveTo(690,650+row*25);g.lineTo(1130,650+row*25);g.stroke();
      }
      for(const [x,y] of [[760,680],[965,740]]){
        g.fillStyle=theme.light;g.beginPath();g.ellipse(x,y,17,12,-.32,0,2*Math.PI);g.fill();
        g.beginPath();g.moveTo(x+16,y);g.lineTo(x+16,y-88);g.stroke();
      }
    }else if(theme.kind==='water'){
      for(let i=0;i<5;i++){
        g.beginPath();g.ellipse(890,790,125+i*67,28+i*23,0,0,2*Math.PI);g.stroke();
      }
    }else if(theme.kind==='youth'){
      for(let i=0;i<12;i++){
        g.beginPath();g.arc(760+i*24,775+Math.sin(i*.7)*36,10+i%3*4,0,Math.PI*2);g.stroke();
      }
    }else{
      for(let i=0;i<4;i++){
        g.beginPath();g.moveTo(760+i*62,800);g.lineTo(960+i*62,560);g.stroke();
      }
    }
    g.restore();
  }
  async function createEventInvitationPNG(item){
    if(!item?.titulo)throw new Error('Evento sem título.');
    try{await document.fonts?.ready;}catch(_){/* preserva fonte alternativa */}
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920; // Stories, Status e TikTok: formato vertical 9:16.
    const g=canvas.getContext('2d');
    if(!g)throw new Error('Não foi possível criar a imagem.');
    const theme=eventVisualTheme(item),ink='#173d4b',muted='#647f88';
    g.fillStyle='#f5f8f6';g.fillRect(0,0,1080,1920);
    const bg=g.createLinearGradient(0,0,1080,1130);
    bg.addColorStop(0,theme.main);bg.addColorStop(.55,theme.mid);bg.addColorStop(1,theme.end);
    g.fillStyle=bg;g.fillRect(0,0,1080,1140);
    g.save();g.globalAlpha=.12;
    g.fillStyle='#ffffff';g.beginPath();g.arc(1160,1010,415,0,Math.PI*2);g.fill();
    g.beginPath();g.arc(-150,1040,300,0,Math.PI*2);g.fill();
    g.restore();
    eventMotif(g,theme);

    // Logotipo discreto, sem disputar espaço com o nome do evento.
    const logo=await inviteLogo();
    if(logo){
      const cx=143,cy=166,radius=70;
      g.save();g.beginPath();g.arc(cx,cy,radius,0,2*Math.PI);g.clip();
      g.fillStyle='#fff';g.fillRect(cx-radius,cy-radius,radius*2,radius*2);
      const scale=Math.min(123/logo.width,123/logo.height);
      const w=logo.width*scale,h=logo.height*scale;
      g.drawImage(logo,cx-w/2,cy-h/2,w,h);
      g.restore();
      g.strokeStyle=theme.light;g.lineWidth=4;
      g.beginPath();g.arc(cx,cy,radius+2,0,2*Math.PI);g.stroke();
    }else{
      inviteRounded(g,84,106,118,118,59,'#ffffff');
      inviteText(g,'IGJAL',143,174,105,'800 25px Manrope, Arial, sans-serif',30,theme.main,1,'center');
    }
    inviteText(g,'IGREJA NO JARDIM LEAL',248,149,755,'800 31px Manrope, Arial, sans-serif',38,'#ffffff',1);
    inviteText(g,'MINISTÉRIO OBRA DA RESTAURAÇÃO',248,195,755,
      '600 21px Manrope, Arial, sans-serif',29,theme.light,1);
    inviteRounded(g,80,310,333,64,32,'rgba(255,255,255,.15)');
    inviteText(g,'CONVITE ESPECIAL',246,352,296,'800 26px Manrope, Arial, sans-serif',32,'#ffffff',1,'center');
    inviteText(g,theme.label,82,446,875,'700 27px Manrope, Arial, sans-serif',32,theme.accent,1);

    // Título é o ponto focal, mesmo quando o evento possui nome longo.
    const title=String(item.titulo).replace(/\s+/g,' ').trim();
    let font=96,lines=[];
    for(;font>=45;font-=3){
      g.font='800 '+font+'px Manrope, Arial, sans-serif';
      lines=inviteWrap(g,title,885);
      if(lines.length<=4)break;
    }
    if(lines.length>4)lines=[...lines.slice(0,3),lines.slice(3).join(' ')];
    g.font='800 '+Math.max(45,font)+'px Manrope, Arial, sans-serif';
    g.fillStyle='#ffffff';g.textAlign='left';
    const lineHeight=Math.max(45,font)*1.18;
    let titleY=548+Math.max(0,(4-lines.length)*24);
    lines.forEach((line,i)=>g.fillText(line,82,titleY+i*lineHeight,900));
    g.textAlign='left';
    inviteRounded(g,82,960,118,5,2,theme.accent);
    inviteText(g,'Você e sua família são nossos convidados!',82,1030,870,
      '700 34px Manrope, Arial, sans-serif',43,'#eefaf6',2);

    // Data e horário com alto contraste: leitura imediata num celular.
    g.shadowColor='rgba(11,51,56,.16)';g.shadowBlur=32;g.shadowOffsetY=12;
    inviteRounded(g,73,1110,934,295,32,'#ffffff');
    g.shadowBlur=0;g.shadowOffsetY=0;
    const date=new Date(item.inicio_em);
    const valid=Number.isFinite(date.getTime());
    const fmt=(parts)=>new Intl.DateTimeFormat('pt-BR',{...parts,timeZone:'America/Sao_Paulo'}).format(date);
    const day=valid?fmt({day:'2-digit'}):'--';
    const month=valid?fmt({month:'long'}).toUpperCase():'CONFIRME';
    const year=valid?fmt({year:'numeric'}):'NA AGENDA';
    const weekday=valid?fmt({weekday:'long'}).toUpperCase():'';
    const time=valid?fmt({hour:'2-digit',minute:'2-digit',hour12:false}).replace(':','H'):'--';
    inviteText(g,'DATA',125,1172,420,'800 23px Manrope, Arial, sans-serif',30,theme.mid,1);
    inviteText(g,'HORÁRIO',655,1172,280,'800 23px Manrope, Arial, sans-serif',30,theme.mid,1);
    inviteText(g,day,125,1297,160,'800 96px Manrope, Arial, sans-serif',100,ink,1);
    inviteText(g,month,296,1261,320,'800 35px Manrope, Arial, sans-serif',42,ink,1);
    inviteText(g,year+' · '+weekday,296,1313,331,
      '700 20px Manrope, Arial, sans-serif',27,muted,1);
    g.fillStyle='#e2ece8';g.fillRect(620,1165,2,169);
    inviteText(g,time,652,1278,307,'800 72px Manrope, Arial, sans-serif',78,ink,1);
    inviteText(g,'HORÁRIO LOCAL',654,1319,260,'600 19px Manrope, Arial, sans-serif',26,muted,1);

    inviteRounded(g,73,1440,934,244,30,'#ffffff');
    inviteRounded(g,104,1474,10,51,5,theme.end);
    inviteText(g,'LOCAL DO EVENTO',138,1507,790,'800 25px Manrope, Arial, sans-serif',33,theme.mid,1);
    const venue=String(item.local||'').trim()||'Consulte a programação da igreja';
    inviteText(g,venue,106,1574,850,'800 35px Manrope, Arial, sans-serif',41,ink,2);
    const locationDetail=inviteIsChurch(item)
      ?'Rua João Clementino, 831 — Jardim Leal, Duque de Caxias/RJ'
      :'Confira o endereço completo na agenda da igreja.';
    inviteText(g,locationDetail,106,1640,848,'600 24px Manrope, Arial, sans-serif',32,muted,2);

    inviteText(g,'Esperamos você!',540,1791,906,
      '800 54px Manrope, Arial, sans-serif',60,theme.main,1,'center');
    inviteText(g,'COMPARTILHE ESTE CONVITE',540,1840,930,
      '700 24px Manrope, Arial, sans-serif',30,muted,1,'center');
    inviteText(g,'igrejanojardimleal.github.io',540,1884,930,
      '600 23px Manrope, Arial, sans-serif',28,theme.mid,1,'center');
    return await new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(new Error('Falha ao salvar o PNG.')),'image/png'
    ));
  }
  function eventInviteFilename(item){
    const base=normalized(item.titulo||'evento').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'evento';
    return 'IGJAL-convite-'+base+'.png';
  }
  function saveEventInvitePNG(blob,item){
    const objectUrl=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=objectUrl;anchor.download=eventInviteFilename(item);
    document.body.append(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }
  async function eventInvitationAction(item,link,mode,button,feedback){
    const actionGroup=button.closest('.event-share-actions');
    const imageButtons=actionGroup?Array.from(actionGroup.querySelectorAll('[data-event-image]')):[button];
    imageButtons.forEach(b=>{b.disabled=true;});
    const oldLabel=button.textContent;
    button.textContent='Preparando imagem...';
    if(feedback)feedback.textContent='';
    try{
      const blob=await createEventInvitationPNG(item);
      if(mode==='share'&&typeof navigator.share==='function'){
        const file=new File([blob],eventInviteFilename(item),{type:'image/png'});
        const canShare=typeof navigator.canShare!=='function'||navigator.canShare({files:[file]});
        if(canShare){
          try{
            await navigator.share({
              files:[file],
              title:'Convite IGJAL — '+String(item.titulo||'Evento'),
              text:'Você e sua família são convidados! Veja a programação:\n'+link
            });
            if(feedback)feedback.textContent='Convite disponibilizado para compartilhar.';
            return;
          }catch(err){
            if(err.name==='AbortError'){
              if(feedback)feedback.textContent='Compartilhamento cancelado.';
              return;
            }
            // Alguns navegadores bloqueiam o compartilhamento de arquivos; oferece PNG.
          }
        }
      }
      saveEventInvitePNG(blob,item);
      if(feedback)feedback.textContent='Convite PNG baixado! Envie como foto no WhatsApp. Use “Copiar link” para incluir o acesso à agenda.';
    }catch(err){
      console.warn('[IGJAL] Erro ao criar convite em imagem:',err);
      if(feedback)feedback.textContent='Não foi possível criar a imagem agora. Tente novamente ou compartilhe o texto.';
    }finally{
      button.textContent=oldLabel;
      imageButtons.forEach(b=>{b.disabled=false;});
    }
  }
  function renderEvents(){
    const host=$('agenda-events');if(!host)return;
    host.replaceChildren();
    const now=Date.now()-6e7,limit=Date.now()+90*86400000;
    const arr=eventAll.filter(x=>x.publicado && new Date(x.inicio_em).getTime()>=now && new Date(x.inicio_em).getTime()<=limit)
      .sort((a,b)=>new Date(a.inicio_em)-new Date(b.inicio_em));
    if(!arr.length){host.append(E('div','empty-state','A igreja ainda não publicou os próximos horários e encontros.'));return;}
    const requested=new URLSearchParams(window.location.search).get('evento');
    let focus=null;
    for(const r of arr){
      const card=E('article','event-card');
      if(r.id!==null&&r.id!==undefined){
        card.id='evento-'+String(r.id).replace(/[^0-9a-z_-]/gi,'');
        if(requested===String(r.id))focus=card;
      }
      const date=E('div','event-date');
      const when=new Date(r.inicio_em);
      date.append(E('span','',new Intl.DateTimeFormat('pt-BR',{day:'2-digit'}).format(when)),
        E('small','',new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(when)));
      const body=E('div','event-info');
      body.append(E('h4','',r.titulo),E('strong','',formatDate(r.inicio_em,true)),E('p','',r.descricao||''));
      if(r.local)body.append(E('small','','Local: '+r.local));
      if(r.id!==null&&r.id!==undefined){
        const url=eventLink(r);
        const actions=E('div','event-share-actions');
        const feedback=E('p','event-share-feedback','');
        feedback.setAttribute('role','status');
        feedback.setAttribute('aria-live','polite');
        const shareImage=E('button','event-share-image','Compartilhar imagem 9:16');
        shareImage.type='button';shareImage.dataset.eventImage='share';
        shareImage.setAttribute('aria-label','Compartilhar convite em imagem de '+r.titulo);
        shareImage.addEventListener('click',()=>void eventInvitationAction(r,url,'share',shareImage,feedback));
        const downloadImage=E('button','event-share-download','Baixar PNG');
        downloadImage.type='button';downloadImage.dataset.eventImage='download';
        downloadImage.setAttribute('aria-label','Baixar convite em PNG de '+r.titulo);
        downloadImage.addEventListener('click',()=>void eventInvitationAction(r,url,'download',downloadImage,feedback));
        const whatsapp=E('a','event-share-whatsapp','Compartilhar texto');
        whatsapp.href='https://wa.me/?text='+encodeURIComponent(eventShareText(r,url));
        whatsapp.target='_blank';whatsapp.rel='noopener noreferrer';
        whatsapp.setAttribute('aria-label','Compartilhar texto do convite de '+r.titulo+' no WhatsApp');
        const copy=E('button','event-share-copy','Copiar link');
        copy.type='button';
        copy.setAttribute('aria-label','Copiar link de '+r.titulo);
        copy.addEventListener('click',()=>void copyEventLink(copy,url));
        actions.append(shareImage,downloadImage,whatsapp,copy);
        body.append(actions,feedback);
      }
      card.append(date,body);host.append(card);
    }
    if(requested&&focus){
      focus.classList.add('event-shared-target');
      requestAnimationFrame(()=>focus.scrollIntoView({behavior:'smooth',block:'center'}));
    }
    if(requested&&!focus)host.prepend(E('p','event-shared-missing','Este evento não está mais na programação dos próximos 90 dias. Confira os encontros atuais.'));
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
    ['site_identidade','chave,valor'],
    ['hinos_ocultos','numero']
  ];
    const got=await Promise.all(jobs.map(async([table,cols])=>{const {data,error}=await db.from(table).select(cols);if(error){console.warn('Módulo '+table+' indisponível:',error.message);return [];}return data||[];}));
    for(const [numero,original] of catalogoBase){
      if(!ctx.songs.some(x=>x.number===numero))ctx.songs.push({...original});
    }
    for(const r of got[0]){
      if(!Number.isInteger(r.numero))continue;const existing=ctx.songs.find(x=>x.number===r.numero);
      const next={number:r.numero,title:r.titulo,lyrics:r.letra,chords:r.cifra||'',key:r.tom||'',author:r.autor||''};
      if(existing)Object.assign(existing,next);else ctx.songs.push(next);
    }
    const ocultos=new Set(got[5].map(row=>row.numero));
    for(let index=ctx.songs.length-1;index>=0;index--){
      if(ocultos.has(ctx.songs[index].number))ctx.songs.splice(index,1);
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
  function tableAllowed(table){
    if(!client())return false;
    if(eventTable(table))return eventAdmin();
    const access={hinos_edicoes:'hinos',site_midias:'midias',site_identidade:'identidade',site_estudos:'editor_estudos'};
    return Boolean(access[table]&&areaAllowed(access[table]));
  }
  async function adminUpsert(table,row,onConflict){
    if(!tableAllowed(table))throw new Error('Sem permissão para esta área.');
    const res=await client().from(table).upsert(row,onConflict?{onConflict}:undefined);
    if(res.error)throw res.error;
  }
  async function adminDelete(table,id){
    if(!tableAllowed(table))throw new Error('Acesso negado.');
    const res=await client().from(table).delete().eq('id',id);
    if(res.error)throw res.error;
  }
  const tabNames=['comments','hino-comentarios','cifras','hinos','agenda','midias','kits','live','identidade','estudos','historico','usuarios','verificacoes'];
  function updateAdminTabs(){
    if(!tabAllowed(currentAdminTab))currentAdminTab=tabNames.find(tabAllowed)||'comments';
    const overview=document.querySelector('.admin-overview');
    if(overview)overview.hidden=!admin();
    if($('admin-reload-pix-copies'))$('admin-reload-pix-copies').hidden=!admin();
    if($('admin-enable-notifications'))$('admin-enable-notifications').hidden=!admin();
    document.querySelectorAll('[data-admin-view]').forEach(button=>{
      const name=button.dataset.adminView;
      button.hidden=!tabAllowed(name);
      const active=tabAllowed(name)&&name===currentAdminTab;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    for(const key of tabNames){
      const panel=$(`admin-${key}-panel`);
      if(panel)panel.hidden=!(tabAllowed(key)&&key===currentAdminTab);
    }
  }
  async function loadPanel(name){
    if(!tabAllowed(name))return;
    currentAdminTab=name;updateAdminTabs();
    if(name==='comments'){ctx.loadModeration?.();return;}
    if(name==='hino-comentarios'){await window.IGREJA_COMUNIDADE?.loadModeration?.();return;}
    if(name==='usuarios'){await window.IGREJA_ACESSOS?.refresh?.();return;}
    if(name==='verificacoes'){await window.IGREJA_VERIFICACOES?.refresh?.();return;}
    if(name==='kits'){await window.IGREJA_KITS?.refresh?.();return;}
    if(name==='live'){await window.IGREJA_LIVE?.refreshAdmin?.();return;}
    if(name==='estudos'){await window.IGREJA_ESTUDOS?.refreshAdmin?.(ctx);return;}
    if(!client())return;
    if(name==='cifras')ctx.loadCifras?.();
    if(name==='cifras'||name==='hinos')void window.IGREJA_GESTAO?.refresh?.(name);
    if(name==='agenda')await refreshAgendaAdmin();
    if(name==='midias')await refreshMediaAdmin();
    if(name==='identidade')refreshIdentityForm();
    if(name==='historico')await loadAudit();
    if(name==='historico')void window.IGREJA_GESTAO?.refresh?.('historico');
  }
  function initAdminTabs(){document.querySelectorAll('[data-admin-view]').forEach(b=>b.addEventListener('click',()=>loadPanel(b.dataset.adminView)));updateAdminTabs();}
  function readSongForm(){const num=Number(fieldVal('edit-song-number'));return {numero:num,titulo:fieldVal('edit-song-title'),autor:fieldVal('edit-song-author'),tom:fieldVal('edit-song-key'),letra:fieldVal('edit-song-lyrics'),cifra:fieldVal('edit-song-chords')};}
  function loadSongForm(){const n=Number(fieldVal('edit-song-number'));const s=ctx.songs.find(x=>x.number===n);if(!s){status('admin-hino-status','Número não encontrado. Preencha um novo hino e salve.');return;}for(const [id,val] of [['edit-song-title',s.title],['edit-song-author',s.author],['edit-song-key',s.key],['edit-song-lyrics',s.lyrics],['edit-song-chords',s.chords]])$(id).value=val||'';status('admin-hino-status',`Hino ${n} carregado. Revise e salve as alterações.`);const info=tr?.keyInfo(s.key);if(info&&$('admin-preview-key'))$('admin-preview-key').value=tr.NOTES[info.index];previewSong();}
  function initAdminEditors(){
    if(!$('admin-content'))return;initAdminTabs();$('admin-enable-notifications')?.addEventListener('click',async()=>{if(!('Notification' in window))return status('admin-notification','Este navegador não oferece notificações do sistema.',true);try{const permission=await Notification.requestPermission();status('admin-notification',permission==='granted'?'Alertas autorizados enquanto esta página estiver aberta.':'Sem permissão de notificações. As pendências continuarão no painel.');}catch(_){status('admin-notification','Notificações não disponíveis neste ambiente.',true);}});
    fillPreviewTones();
    const detect=$('admin-detect-key');
    detect?.addEventListener('click',()=>{
      if(!areaAllowed('hinos'))return status('admin-key-suggestion','Acesso ao hinário necessário.',true);
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
    $('admin-event-cancel')?.addEventListener('click',()=>{clearEventEditor();status('admin-event-status','Edição cancelada.');});
    $('admin-event-form')?.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const title=fieldVal('edit-event-title'),date=fieldVal('edit-event-date');
      if(!title||!date)return status('admin-event-status','Informe título e data.',true);
      const row={titulo:title,inicio_em:new Date(date).toISOString(),
        local:fieldVal('edit-event-location'),descricao:fieldVal('edit-event-description'),
        publicado:$('edit-event-published').checked};
      const id=Number(fieldVal('edit-event-id'));
      try{
        if(Number.isInteger(id)&&id>0){
          const {data,error}=await client().from('site_eventos').update(row).eq('id',id).select('id');
          if(error||!data?.length)throw error||new Error('Edição não autorizada.');
        }else await adminUpsert('site_eventos',row);
        clearEventEditor();
        status('admin-event-status',id>0?'Evento atualizado. Responsável registrado no histórico.':'Evento cadastrado. Responsável registrado no histórico.');
        await fetchPublic();await refreshAgendaAdmin();
      }catch(err){status('admin-event-status','Erro: '+err.message,true);}
    });
    $('admin-notice-form')?.addEventListener('submit',async ev=>{ev.preventDefault();if(!fieldVal('edit-notice-title')||!fieldVal('edit-notice-body'))return status('admin-notice-status','Preencha título e aviso.',true);try{await adminUpsert('site_avisos',{titulo:fieldVal('edit-notice-title'),mensagem:fieldVal('edit-notice-body'),valido_ate:fieldVal('edit-notice-until')||null,publicado:$('edit-notice-published').checked});$('admin-notice-form').reset();status('admin-notice-status','Aviso cadastrado.');await fetchPublic();await refreshAgendaAdmin();}catch(err){status('admin-notice-status','Erro: '+err.message,true);}});
    $('admin-media-form')?.addEventListener('submit',async ev=>{ev.preventDefault();const number=Number(fieldVal('edit-media-hino')),type=fieldVal('edit-media-type'),value=fieldVal('edit-media-value');const yt=/^[\w-]{11}$/.test(value)?value:(value.match(/(?:youtu\.be\/|[?&]v=|youtube\.com\/shorts\/)([\w-]{11})/)||[])[1];if(type==='youtube'&&!yt)return status('admin-media-status','Informe um ID/link válido de vídeo do YouTube.',true);if(type==='audio'&&!safeAudio(value))return status('admin-media-status','Informe URL HTTPS de arquivo MP3/OGG/M4A ou caminho assets/audio/...',true);
      try{await adminUpsert('site_midias',{hino_numero:number,tipo:type,youtube_id:type==='youtube'?yt:null,audio_url:type==='audio'?value:null},'hino_numero');status('admin-media-status','Gravação vinculada ao hino.');await fetchPublic();await refreshMediaAdmin();}catch(err){status('admin-media-status','Erro: '+err.message,true);}
    });
    $('admin-identity-form')?.addEventListener('submit',async ev=>{ev.preventDefault();const list=[['history_intro','edit-history-intro'],['history_detail','edit-history-detail'],['logo_url','edit-logo-url'],['hero_photo_url','edit-hero-url'],['history_photo_url','edit-history-url'],['contact','edit-contact']];try{
      for(const [key,id] of list){if(!admin()&&(key==='logo_url'||key==='contact'))continue;const value=fieldVal(id);if(key.includes('_url')&&value&&!safeImage(value))return status('admin-identity-status','Imagem inválida em '+id+'. Use HTTPS ou assets/fotos/arquivo.jpg.',true);await adminUpsert('site_identidade',{chave:key,valor:value},'chave');}
      status('admin-identity-status','Informações oficiais atualizadas.');await fetchPublic();}catch(err){status('admin-identity-status','Erro: '+err.message,true);}
    });
  }
  function moderationLine(title,subtitle,content,btnLabel,onClick){const box=E('article','moderation-item');box.append(E('h3','',title));if(subtitle)box.append(E('small','',subtitle));if(content)box.append(E('p','',content));if(btnLabel){const b=E('button','btn btn-outline',btnLabel);b.type='button';b.addEventListener('click',onClick);box.append(b);}return box;}
  function eventDateLocal(value){
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return '';
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
      timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',
      day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
  }
  function clearEventEditor(){
    const form=$('admin-event-form');
    form?.reset();
    if($('edit-event-id'))$('edit-event-id').value='';
    if($('admin-event-save'))$('admin-event-save').textContent='Adicionar evento';
    if($('admin-event-cancel'))$('admin-event-cancel').hidden=true;
  }
  async function refreshAgendaAdmin(){
    if(!eventEditorEnabled()||!$('admin-event-list'))return;
    for(const [table,hostId,title,describe] of [
       ['site_eventos','admin-event-list',r=>r.titulo,r=>formatDate(r.inicio_em,true)+' • '+(r.publicado?'Publicado':'Rascunho')],
       ['site_avisos','admin-notice-list',r=>r.titulo,r=>r.mensagem.slice(0,100)+' • '+(r.publicado?'Publicado':'Rascunho')]
    ]){
      const {data,error}=await client().from(table).select('*').order('criado_em',{ascending:false}).limit(150);
      const host=$(hostId);host.replaceChildren();
      if(error){host.append(E('p','','Não foi possível carregar os registros.'));continue;}
      for(const row of data||[]){
        const node=moderationLine(title(row),describe(row),'','Excluir',async()=>{
          if(!confirm('Excluir este registro definitivamente?'))return;
          try{
            await adminDelete(table,row.id);
            await fetchPublic();await refreshAgendaAdmin();
          }catch(err){alert('Erro ao excluir: '+err.message);}
        });
        if(table==='site_eventos'){
          node.dataset.igjalEventId=String(row.id);
          const edit=E('button','btn btn-outline btn-sm','Editar evento');
          edit.type='button';
          edit.addEventListener('click',()=>{
            $('edit-event-id').value=String(row.id);
            $('edit-event-title').value=row.titulo||'';
            $('edit-event-date').value=eventDateLocal(row.inicio_em);
            $('edit-event-location').value=row.local||'';
            $('edit-event-description').value=row.descricao||'';
            $('edit-event-published').checked=Boolean(row.publicado);
            $('admin-event-save').textContent='Salvar alterações';
            $('admin-event-cancel').hidden=false;
            status('admin-event-status','Editando evento: '+row.titulo+'. As alterações ficarão registradas com o responsável.');
            $('admin-event-form').scrollIntoView({behavior:'smooth',block:'start'});
          });
          node.append(edit);
        }
        host.append(node);
      }
      if(table==='site_eventos')void window.IGREJA_GESTAO?.annotateEvents?.();
    }
  }
  async function refreshMediaAdmin(){const host=$('admin-media-list');if(!host||!tableAllowed('site_midias'))return;const {data,error}=await client().from('site_midias').select('*').order('hino_numero');host.replaceChildren();if(error){host.append(E('p','','Não foi possível carregar mídias.'));return;}for(const r of data||[]){const box=moderationLine(`Hino ${r.hino_numero} — ${r.tipo==='youtube'?'Vídeo YouTube':'Áudio'}`,'Mídia oficial vinculada',r.youtube_id||r.audio_url,'Remover mídia',async()=>{if(!confirm('Remover mídia deste hino?'))return;const {error}=await client().from('site_midias').delete().eq('hino_numero',r.hino_numero);if(error)return alert('Erro: '+error.message);await fetchPublic();await refreshMediaAdmin();});host.append(box);}}
  function refreshIdentityForm(){
    for(const [key,id] of [['history_intro','edit-history-intro'],['history_detail','edit-history-detail'],['logo_url','edit-logo-url'],['hero_photo_url','edit-hero-url'],['history_photo_url','edit-history-url'],['contact','edit-contact']]){
      const field=$(id);if(!field)continue;
      field.value=identity.get(key)||((key==='history_intro'||key==='history_detail')?window.IGREJA_DATA?.history?.[key==='history_intro'?'intro':'detail']||'':'');
      if(key==='logo_url'||key==='contact')field.disabled=!admin();
    }
  }
  async function loadAudit(){const host=$('admin-audit-list');if(!host||!adminEditorEnabled())return;host.replaceChildren();const {data,error}=await client().from('site_moderacao_historico').select('acao,tipo,referencia_id,criado_em').order('criado_em',{ascending:false}).limit(40);if(error){host.append(E('p','','O histórico será exibido após configurar o banco.'));return;}for(const r of data||[]){host.append(moderationLine(`${r.acao} • ${r.tipo}`,formatDate(r.criado_em,true),`Registro ${r.referencia_id}`));}if(!(data||[]).length)host.append(E('p','','Ainda não há decisões registradas.'));}
  async function pendingCount(){if(!adminEditorEnabled())return;try{const queries=await Promise.all([client().from('comentarios').select('*',{head:true,count:'exact'}).eq('status','pendente'),client().from('cifra_envios').select('*',{head:true,count:'exact'}).eq('status','pendente')]);if(queries.some(x=>x.error))return;const current=(queries[0].count||0)+(queries[1].count||0);if($('admin-v4-queue-total'))$('admin-v4-queue-total').textContent=String(current);if($('pending-badge'))$('pending-badge').textContent=String(current);if($('pending-link'))$('pending-link').hidden=current===0;document.title=current?`(${current}) Administração • Igreja no Jardim Leal`:'Administração • Igreja no Jardim Leal';if(lastPending!==null && current>lastPending && document.visibilityState==='visible'){status('admin-notification',`Há ${current-lastPending} nova(s) pendência(s) para revisar.`);if('Notification' in window&&Notification.permission==='granted'){try{new Notification('Igreja no Jardim Leal — moderação',{body:`${current} envio(s) aguardando análise.`});}catch(_){/* permissões do navegador */}}}lastPending=current;}catch(_){/* servidor ainda não preparado */}}
  async function onAuthChange(){
    if(!ctx)return;
    updateAdminTabs();
    if(tabNames.some(tabAllowed)){
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
  async function init(context){ctx=context;for(const s of ctx?.songs||[])catalogoBase.set(s.number,{...s});initCulto();initPixQR();initAdminEditors();await fetchPublic();await onAuthChange();}
  return {init,keepSong,getMedia,onSongRendered,onAuthChange,loadPanel,reloadPublic:fetchPublic,isCulto:()=>culto};
})();