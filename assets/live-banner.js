/* Igreja no Jardim Leal — destaque manual de transmissões no YouTube.
   O administrador cadastra o link e escolhe o status; nenhuma live é detectada por suposição. */
window.IGREJA_LIVE = (() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const TABLE='site_live_destaque';
  let ctx=null, publicTimer=null, adminLoaded=false;
  const canManage=()=>!!ctx?.db?.() && (ctx?.isAdmin?.()===true || ctx?.hasArea?.('live')===true);
  const validId=id=>/^[A-Za-z0-9_-]{11}$/.test(String(id||''));
  const watch=id=>'https://www.youtube.com/watch?v='+id;
  const thumbnail=id=>'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
  const text=(parent,tag,cls,value)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(value!==undefined)el.textContent=String(value);
    parent.append(el);return el;
  };
  function extractVideoId(raw){
    try{
      const u=new URL(String(raw||'').trim());
      if(u.protocol!=='https:')return null;
      const hostname=u.hostname.toLowerCase();
      let id=null;
      if(['youtu.be','www.youtu.be'].includes(hostname))id=u.pathname.split('/')[1];
      else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(hostname)){
        if(u.pathname==='/watch')id=u.searchParams.get('v');
        else if(/^\/(live|embed|shorts)\//.test(u.pathname))id=u.pathname.split('/')[2];
      }
      return validId(id)?id:null;
    }catch(_){return null;}
  }
  function formatDate(value){
    if(!value)return '';
    const date=new Date(value);
    if(!Number.isFinite(date.valueOf()))return '';
    return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(date);
  }
  function formatInputDate(value){
    if(!value)return '';
    const d=new Date(value);
    if(!Number.isFinite(d.valueOf()))return '';
    const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
    return local.replace(' ','T');
  }
  function setStatus(msg,err=false){
    const p=$('admin-live-status');
    if(p){p.textContent=msg;p.classList.toggle('error',err);p.style.color=err?'#a52d31':'';}
  }
  function showPreview(id){
    const box=$('admin-live-preview');
    const img=$('admin-live-image');
    if(!box||!img)return;
    box.hidden=!validId(id);
    if(validId(id)){img.src=thumbnail(id);img.alt='Miniatura do vídeo selecionado no YouTube';}
    else img.removeAttribute('src');
  }
  function fillAdmin(row){
    if(!$('admin-live-form'))return;
    $('admin-live-url').value=row?.video_id?watch(row.video_id):'';
    $('admin-live-title').value=row?.titulo||'Culto da Igreja no Jardim Leal';
    $('admin-live-mode').value=row?.modo||'desativada';
    $('admin-live-when').value=formatInputDate(row?.previsto_em);
    showPreview(row?.video_id);
  }
  async function refreshAdmin(){
    if(!canManage()||!ctx?.db?.()||!$('admin-live-form'))return;
    setStatus('Consultando o destaque do canal...');
    const {data,error}=await ctx.db().from(TABLE)
      .select('id,video_id,titulo,modo,previsto_em,atualizado_em')
      .eq('id',1).maybeSingle();
    if(error){setStatus('Não foi possível carregar a configuração: '+error.message,true);return;}
    if(!data){setStatus('Configuração da live não encontrada no banco.',true);return;}
    fillAdmin(data);
    adminLoaded=true;
    setStatus('Configuração carregada. Somente o administrador geral ou o gestor de lives pode salvar alterações.');
  }
  async function save(row){
    const {data,error}=await ctx.db().from(TABLE).update(row).eq('id',1)
      .select('id,video_id,titulo,modo,previsto_em,atualizado_em').maybeSingle();
    if(error)throw error;
    if(!data)throw Error('Alteração não autorizada ou registro inexistente.');
    return data;
  }
  async function saveAdmin(event){
    event.preventDefault();
    if(!canManage()||!ctx?.db?.()){
      setStatus('Somente pessoas autorizadas a gerenciar lives podem alterar o destaque.',true);return;
    }
    const raw=$('admin-live-url').value.trim();
    const id=extractVideoId(raw);
    const modo=$('admin-live-mode').value;
    const titulo=$('admin-live-title').value.trim()||'Culto da Igreja no Jardim Leal';
    if(raw&&!id){setStatus('Informe um link válido de vídeo ou live do YouTube.',true);return;}
    if(modo!=='desativada'&&!id){setStatus('Cole primeiro o link do YouTube para ativar o destaque.',true);return;}
    if(!['desativada','programada','ao_vivo'].includes(modo)){setStatus('Escolha uma situação válida.',true);return;}
    if(titulo.length>180){setStatus('Título muito longo (máximo de 180 caracteres).',true);return;}
    const when=$('admin-live-when').value;
    const whenDate=when?new Date(when):null;
    if(whenDate && !Number.isFinite(whenDate.valueOf())){setStatus('Confira a data e o horário informados.',true);return;}
    const btn=$('admin-live-save');
    btn.disabled=true;setStatus('Salvando o destaque da transmissão...');
    try{
      const record=await save({
        video_id:id,titulo,modo,previsto_em:whenDate?.toISOString()||null,atualizado_em:new Date().toISOString()
      });
      fillAdmin(record);
      setStatus(modo==='ao_vivo'?'Live destacada! A miniatura levará os visitantes ao YouTube.':modo==='programada'?'Próxima transmissão cadastrada. Ative “Ao vivo” quando o culto começar.':'Destaque ocultado. O vídeo continua no YouTube.');
      await refreshPublic();
    }catch(e){setStatus('Não foi possível salvar: '+e.message,true);}
    finally{btn.disabled=false;}
  }
  async function deactivate(){
    if(!canManage()||!ctx?.db?.())return;
    if(!window.confirm('Encerrar o destaque no site? A gravação continuará disponível no YouTube.'))return;
    const btn=$('admin-live-hide');btn.disabled=true;
    setStatus('Ocultando o destaque...');
    try{
      const data=await save({modo:'desativada',atualizado_em:new Date().toISOString()});
      fillAdmin(data);setStatus('Destaque encerrado e ocultado do site.');await refreshPublic();
    }catch(e){setStatus('Não foi possível encerrar: '+e.message,true);}
    finally{btn.disabled=false;}
  }
  function showPublic(row){
    const host=$('live-spotlight');
    if(!host)return;
    host.replaceChildren();
    if(!row||!validId(row.video_id)||!['programada','ao_vivo'].includes(row.modo)){
      host.hidden=true;return;
    }
    const live=row.modo==='ao_vivo',id=row.video_id;
    const box=text(host,'section','igjal-live-card'+(live?'':' igjal-live-upcoming'));
    const info=text(box,'div','igjal-live-info');
    text(info,'span','igjal-live-badge',live?'● TRANSMISSÃO AO VIVO':'◷ PRÓXIMA TRANSMISSÃO');
    text(info,'h2','igjal-live-title',row.titulo||'Culto da Igreja no Jardim Leal');
    const desc=live?'A igreja está transmitindo! Clique para acompanhar no YouTube.':(row.previsto_em?'Programada para '+formatDate(row.previsto_em)+'.':'A próxima transmissão será realizada em breve.');
    text(info,'p','igjal-live-description',desc);
    const btn=text(info,'a','btn btn-primary igjal-live-link',live?'▶ Assistir ao vivo no YouTube ↗':'▶ Abrir transmissão programada ↗');
    btn.href=watch(id);btn.target='_blank';btn.rel='noopener noreferrer';
    const pic=text(box,'a','igjal-live-player igjal-live-cover');
    pic.href=watch(id);pic.target='_blank';pic.rel='noopener noreferrer';
    pic.setAttribute('aria-label','Abrir no YouTube: '+(row.titulo||'transmissão da igreja'));
    const img=text(pic,'img');img.src=thumbnail(id);img.alt='Miniatura oficial da transmissão';img.loading='lazy';
    text(pic,'span','igjal-live-play','▶ Assistir no YouTube');
    host.hidden=false;
  }
  async function refreshPublic(){
    const host=$('live-spotlight');
    if(!host||!ctx?.db?.())return;
    const {data,error}=await ctx.db().from(TABLE)
      .select('video_id,titulo,modo,previsto_em').eq('id',1).maybeSingle();
    if(error){console.warn('Não foi possível carregar destaque da live:',error.message);return;}
    showPublic(data);
  }
  function onAuthChange(){
    const adminPanel=$('admin-live-panel');
    if(adminPanel&&!canManage())adminPanel.hidden=true;
    if(canManage()&&!adminLoaded)void refreshAdmin();
    if($('live-spotlight'))void refreshPublic();
  }
  function init(context){
    ctx=context;
    const form=$('admin-live-form');
    if(form){
      form.addEventListener('submit',saveAdmin);
      $('admin-live-url')?.addEventListener('input',()=>showPreview(extractVideoId($('admin-live-url').value)));
      $('admin-live-refresh')?.addEventListener('click',refreshAdmin);
      $('admin-live-hide')?.addEventListener('click',deactivate);
    }
    if($('live-spotlight')){
      void refreshPublic();
      if(!publicTimer)publicTimer=setInterval(()=>{if(!document.hidden)void refreshPublic();},60000);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshPublic();});
    }
    onAuthChange();
  }
  return {init,onAuthChange,refreshAdmin,refreshPublic,extractVideoId};
})();