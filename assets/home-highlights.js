/* IGJAL - cartões vivos da programação. Datas no fuso de São Paulo, sem dados inventados. */
(() => {
  'use strict';
  const BASE = 'https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/';
  const ZONE = 'America/Sao_Paulo';
  const $ = id => document.getElementById(id);
  const cfg = window.IGREJA_CONFIG || {};
  const serviceNames = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const dateFormat = new Intl.DateTimeFormat('pt-BR',{timeZone:ZONE,weekday:'long',day:'2-digit',month:'long'});
  const shortDateFormat = new Intl.DateTimeFormat('pt-BR',{timeZone:ZONE,day:'2-digit',month:'2-digit',year:'numeric'});
  const timeFormat = new Intl.DateTimeFormat('pt-BR',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const partFormat = new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const publicKey = String(cfg.supabase?.anonKey||'');
  const publicUrl = String(cfg.supabase?.url||'').replace(/\/$/,'');
  const isValidId = id => /^[A-Za-z0-9_-]{11}$/.test(String(id||''));
  let blessedMessages=[],blessingTimer=null,mostRecentVideosRefresh=0;

  function saoPauloParts(value){
    const obj={};for(const p of partFormat.formatToParts(value)){if(p.type!=='literal')obj[p.type]=Number(p.value);}
    return obj;
  }
  function zonedToEpoch(y,m,d,h,min){
    const requested=Date.UTC(y,m-1,d,h,min);
    let value=requested;
    for(let i=0;i<3;i++){
      const p=saoPauloParts(new Date(value));
      const seen=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
      value+=requested-seen;
    }
    return value;
  }
  function renderNextWorship(){
    const title=$('igjal-next-culto-title'),date=$('igjal-next-culto-date');
    if(!title||!date)return;
    const weekdays=Array.isArray(cfg.weeklyServices)?cfg.weeklyServices:[];
    const byDay=new Map(weekdays.map(item=>[item.day,item]));
    const now=Date.now();
    const local=saoPauloParts(new Date(now));
    const upcoming=[];
    for(let offset=0;offset<9;offset++){
      const day=new Date(Date.UTC(local.year,local.month-1,local.day+offset));
      const entry=byDay.get(serviceNames[day.getUTCDay()]);
      if(!entry||entry.closed)continue;
      for(const meeting of entry.meetings||[]){
        if(!/\bculto\b/i.test(meeting))continue;
        const match=String(meeting).match(/(\d{1,2})h(\d{2})/);
        if(!match)continue;
        const starts=zonedToEpoch(day.getUTCFullYear(),day.getUTCMonth()+1,day.getUTCDate(),Number(match[1]),Number(match[2]));
        if(starts<=now)continue;
        const label=String(meeting).split(/\s+[—–-]\s+/).slice(1).join(' — ')||'Culto da igreja';
        upcoming.push({starts,label});
      }
    }
    upcoming.sort((a,b)=>a.starts-b.starts);
    if(!upcoming.length){
      title.textContent='Consulte os horários de culto';
      date.textContent='Veja a agenda oficial da IGJAL';
      return;
    }
    const next=upcoming[0];
    title.textContent=next.label;
    date.textContent=dateFormat.format(next.starts)+' · '+timeFormat.format(next.starts).replace(':','h');
    const note=$('igjal-next-culto-note');
    if(note)note.textContent='Horário de Brasília · atualizado automaticamente';
  }
  function renderLastVideo(){
    const title=$('igjal-last-culto-title'),date=$('igjal-last-culto-date'),link=$('igjal-last-culto-link');
    if(!title||!date||!link)return;
    const collection=window.IGREJA_PREVIEW_VIDEOS?.videos;
    const rows=Array.isArray(collection)?collection:[];
    const valid=rows.filter(v=>v.category==='lives'&&isValidId(v.id)&&v.published&&
      Number.isFinite(Date.parse(v.published))&&Date.parse(v.published)<=Date.now()+3600000)
      .sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));
    const video=valid[0];
    if(!video){
      title.textContent='Veja os cultos gravados';
      date.textContent='Acesse o canal oficial da igreja';
      link.href=BASE+'canal.html';
      link.removeAttribute('target');
      return;
    }
    const heading=String(video.title||'Transmissão da IGJAL').trim();
    title.textContent=/est[aá] ao vivo!/i.test(heading)?'Transmissão gravada da IGJAL':heading;
    date.textContent='Publicado em '+shortDateFormat.format(new Date(video.published));
    link.href='https://www.youtube.com/watch?v='+video.id;
    link.target='_blank';link.rel='noopener noreferrer';
    link.setAttribute('aria-label','Assistir à última transmissão publicada: '+title.textContent);
  }
  async function publicRows(table,params){
    if(!publicKey||!publicUrl)return [];
    const url=publicUrl+'/rest/v1/'+table+'?'+params;
    const response=await fetch(url,{headers:{'apikey':publicKey,'Accept':'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error('Consulta pública temporariamente indisponível: '+response.status);
    const data=await response.json();
    return Array.isArray(data)?data:[];
  }
  async function loadPublishedEvents(){
    const note=$('igjal-next-event-note');if(!note)return;
    try{
      const params=new URLSearchParams({
        select:'titulo,inicio_em,local,publicado',
        publicado:'eq.true',
        inicio_em:'gte.'+new Date().toISOString(),
        order:'inicio_em.asc',
        limit:'1'
      });
      const found=await publicRows('site_eventos',params.toString());
      const item=found[0];
      if(!item){note.hidden=true;return;}
      const epoch=Date.parse(item.inicio_em);
      if(!Number.isFinite(epoch)||epoch<Date.now()){note.hidden=true;return;}
      note.textContent='Evento confirmado: '+item.titulo+' · '+shortDateFormat.format(epoch)+' às '+timeFormat.format(epoch).replace(':','h');
      note.hidden=false;
    }catch(err){console.warn('[IGJAL] Não foi possível atualizar os eventos:',err.message);note.hidden=true;}
  }
  function renderBlessing(){
    const quote=$('igjal-front-mural-text'),author=$('igjal-front-mural-author');
    if(!quote||!blessedMessages.length)return;
    const current=blessedMessages.shift();
    blessedMessages.push(current);
    quote.textContent='“'+String(current.mensagem||'').trim()+'”';
    if(author)author.textContent='— '+String(current.nome||'Comunidade IGJAL');
    const box=$('igjal-front-mural');if(box)box.hidden=false;
  }
  async function loadMural(){
    if(!$('igjal-front-mural'))return;
    try{
      const query=new URLSearchParams({
        select:'nome,mensagem,criado_em',
        status:'eq.aprovado',
        parent_id:'is.null',
        order:'criado_em.desc',
        limit:'15'
      });
      const rows=await publicRows('comentarios',query.toString());
      blessedMessages=rows.filter(r=>typeof r.mensagem==='string'&&r.mensagem.trim().length>=3);
      if(!blessedMessages.length){$('igjal-front-mural').hidden=true;return;}
      renderBlessing();
      if(blessingTimer)clearInterval(blessingTimer);
      if(blessedMessages.length>1 && !matchMedia('(prefers-reduced-motion: reduce)').matches){
        blessingTimer=setInterval(()=>{if(!document.hidden)renderBlessing();},14000);
      }
    }catch(err){console.warn('[IGJAL] Falha ao carregar mensagem do mural:',err.message);}
  }
  function updateAll(){
    renderNextWorship();
    renderLastVideo();
    void loadPublishedEvents();
    void loadMural();
  }
  function reloadVideosIfOld(){
    const now=Date.now();
    if(now-mostRecentVideosRefresh<15*60000)return;
    mostRecentVideosRefresh=now;
    const script=document.createElement('script');
    script.src=BASE+'assets/videos.js?v='+Math.floor(now/(15*60000));
    script.onload=renderLastVideo;
    script.onerror=()=>console.warn('[IGJAL] Catálogo de vídeos indisponível no momento.');
    document.head.append(script);
  }
  function start(){
    if(!$('igjal-next-culto-title'))return;
    mostRecentVideosRefresh=Date.now();
    updateAll();
    setInterval(()=>{if(!document.hidden){updateAll();reloadVideosIfOld();}},5*60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateAll();reloadVideosIfOld();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
