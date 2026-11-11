/* Caixinha de Promessas IGJAL - 500 versículos da Almeida Revista e Corrigida (Lisboa, 1911).
   Os quatro períodos diários são iguais para todos, no horário de Brasília.
   O texto vem de edição em domínio público, com ortografia atualizada. */
(() => {
  'use strict';
  const ZONE='America/Sao_Paulo';
  const SOURCE='https://igrejanojardimleal.github.io/portal-igreja-jardim-leal/assets/promessas-arc1911.json?v=20261111-salmos638-destra-v4';
  const $=id=>document.getElementById(id);
  const timezoneParts=new Intl.DateTimeFormat('en-GB',{
    timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  let verses=[],currentSlot=null,currentSelection=null;
  let dbPromessas=null;
  function clientePontos(){
    if(dbPromessas)return dbPromessas;
    const config=window.IGREJA_CONFIG?.supabase;
    if(!config?.url||!config?.anonKey||!window.supabase?.createClient)return null;
    dbPromessas=window.supabase.createClient(config.url,config.anonKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return dbPromessas;
  }
  async function registrarCompartilhamento(){
    try{
      const db=clientePontos();
      if(!db)return;
      const {data}=await db.auth.getSession();
      if(!data?.session?.user)return; // Compartilhamento é livre; pontos exigem login.
      const {error}=await db.rpc('igjal_registrar_interacao',{
        p_tipo:'promessa',p_recurso:'promessa:atual'
      });
      if(error)throw error;
    }catch(err){
      console.warn('[IGJAL] Pontos do compartilhamento indisponíveis:',err.message);
    }
  }

  function localTime(){
    const p={};for(const part of timezoneParts.formatToParts(new Date()))if(part.type!=='literal')p[part.type]=Number(part.value);
    return p;
  }
  function seedRandom(seed){
    let state=(seed|0)||123456789;
    return ()=>{
      state^=state<<13;state^=state>>>17;state^=state<<5;
      return (state>>>0)/4294967296;
    };
  }
  function shuffleForCycle(cycle){
    const shuffled=Array.from({length:verses.length},(_,i)=>i);
    const rng=seedRandom((0x1A1D1911+Math.imul(cycle,7919))|0);
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(rng()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    if(cycle!==0&&shuffled.length>1){
      const prev=shuffleBasic(cycle-1);
      if(shuffled[0]===prev[prev.length-1])[shuffled[0],shuffled[1]]=[shuffled[1],shuffled[0]];
    }
    return shuffled;
  }
  function shuffleBasic(cycle){
    const indices=Array.from({length:verses.length},(_,i)=>i);
    const rng=seedRandom((0x1A1D1911+Math.imul(cycle,7919))|0);
    for(let i=indices.length-1;i>0;i--){
      const j=Math.floor(rng()*(i+1));
      [indices[i],indices[j]]=[indices[j],indices[i]];
    }
    return indices;
  }
  function render(){
    if(!verses.length||!$('igjal-promise-text'))return;
    const local=localTime();
    const hourBlock=Math.floor(local.hour/12);
    const localBlockUtc=Date.UTC(local.year,local.month-1,local.day,hourBlock*12);
    const firstBlock=Date.UTC(2026,10,4,0);
    const number=Math.floor((localBlockUtc-firstBlock)/43200000);
    if(number===currentSlot)return;
    currentSlot=number;
    const index=((number%verses.length)+verses.length)%verses.length;
    const cycle=Math.floor(number/verses.length);
    const order=shuffleForCycle(cycle);
    currentSelection=verses[order[index]];
    // Evita parênteses redundantes quando todo o versículo já vem entre eles.
    const exibicao=currentSelection.text.trim().replace(/^\((.*)\)$/s,'$1');
    $('igjal-promise-text').textContent='“'+exibicao+'”';
    $('igjal-promise-reference').textContent=currentSelection.reference;
    const share=$('igjal-promise-whatsapp');
    if(share){
      const message=currentSelection.text+'\n\n'+currentSelection.reference+'\n\n*Plataforma IGJAL*';
      share.href='https://wa.me/?text='+encodeURIComponent(message);
    }
  }
  async function copyCurrent(){
    if(!currentSelection)return;
    const text=currentSelection.text+'\n\n'+currentSelection.reference+'\n\n*Plataforma IGJAL*';
    const button=$('igjal-promise-copy');
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';
        document.body.append(field);field.select();
        if(!document.execCommand('copy'))throw new Error('Cópia indisponível');
        field.remove();
      }
      if(button){button.textContent='✓ Copiado';setTimeout(()=>button.textContent='Copiar versículo',2200);}
    }catch(err){
      console.warn('[IGJAL] Falha ao copiar:',err.message);
      if(button){button.textContent='Selecione o versículo para copiar';setTimeout(()=>button.textContent='Copiar versículo',3000);}
    }
  }
  async function start(){
    if(!$('igjal-promise-text'))return;
    $('igjal-promise-copy')?.addEventListener('click',copyCurrent);
    $('igjal-promise-whatsapp')?.addEventListener('click',()=>{void registrarCompartilhamento();});
    try{
      const response=await fetch(SOURCE,{cache:'force-cache'});
      if(!response.ok)throw new Error('Arquivo de versículos indisponível');
      const data=await response.json();
      if(data.edition!=='1911'||data.count!==500||!Array.isArray(data.verses)||data.verses.length!==500)
        throw new Error('Acervo não validado');
      if(!data.verses.every(x=>typeof x.reference==='string'&&typeof x.text==='string'))
        throw new Error('Versículos inválidos');
      verses=data.verses;
      render();
      setInterval(()=>{if(!document.hidden)render();},45000);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
    }catch(err){
      console.warn('[IGJAL] Não foi possível carregar a Caixinha de Promessas:',err.message);
      $('igjal-promise-text').textContent='O versículo deste período está temporariamente indisponível.';
      const info=$('igjal-promise-refresh');if(info)info.textContent='Confira sua conexão e atualize a página.';
      if($('igjal-promise-copy'))$('igjal-promise-copy').disabled=true;
      if($('igjal-promise-whatsapp'))$('igjal-promise-whatsapp').hidden=true;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else void start();
})();
