/* IGJAL — biblioteca administrativa de letras, cifras, PDFs e autoria de edições.
   Todos os privilégios são confirmados por RLS e RPC do Supabase. */
window.IGREJA_GESTAO = (()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const make=(tag,text,cls)=>{
   const el=document.createElement(tag);
   if(cls)el.className=cls;
   if(text!==undefined&&text!==null)el.textContent=String(text);
   return el;
 };
 const stamp=raw=>{try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw));}catch(_){return '';}};
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const status=(id,message,bad=false)=>{const el=$(id);if(el){el.textContent=message;el.classList.toggle('error',bad);}};
 let ctx=null,hidden=new Set(),history=[],pdfRows=[],sendRows=[];
 const db=()=>ctx?.db?.();
 const can=area=>ctx?.hasArea?.(area)===true;
 const logged=()=>Boolean(ctx?.user?.()?.id);
 const maySee=()=>logged()&&(can('hinos')||can('cifras'));
 const names=()=>ctx?.songs?.()||[];
 const base=()=>window.IGREJA_CATALOGO_ORIGINAL||window.IGREJA_DATA?.songs||[];
 const titleFor=n=>(names().find(x=>x.number===n)||base().find(x=>x.number===n))?.title||'Hino '+n;
 const actionButton=(text,cb,cls='btn btn-outline btn-sm')=>{
   const b=make('button',text,cls);b.type='button';b.addEventListener('click',cb);return b;
 };
 function hymnSnapshot(){
   const map=new Map([...base(),...names()].map(row=>[row.number,row]));
   return [...map.values()].sort((a,b)=>a.number-b.number);
 }
 function renderHymns(){
   const host=$('igjal-hinos-biblioteca');if(!host)return;host.replaceChildren();
   if(!maySee()){status('igjal-hinos-status','Acesso restrito a revisores de hinos e cifras.');return;}
   const query=norm($('igjal-hinos-busca')?.value);
   const all=hymnSnapshot();
   const found=all.filter(s=>!query||norm(s.number+' '+s.title+' '+s.author+' '+s.lyrics+' '+s.chords).includes(query));
   const active=all.filter(s=>!hidden.has(s.number));
   status('igjal-hinos-status',active.length+' hinos ativos • '+hidden.size+' retirados • '+found.length+' resultados. Letras e cifras digitais podem ser conferidas abaixo.');
   if(!found.length){host.append(make('p','Nenhum hino encontrado.','muted'));return;}
   for(const song of found){
     const removed=hidden.has(song.number);
     const row=make('article',null,'igjal-library-item');
     const head=make('div',null,'igjal-library-head');
     const info=make('div');
     info.append(make('strong',String(song.number).padStart(2,'0')+' — '+song.title),
       make('small',song.author||'Autor não informado'));
     const indicators=make('span',removed?'Retirado do site':(song.chords?.trim()?'Letra + cifra digital':'Letra cadastrada'),'igjal-library-badge');
     head.append(info,indicators);
     const actions=make('div',null,'igjal-library-actions');
     const details=make('details',null,'igjal-library-details');
     details.append(make('summary','Conferir letra e cifra'));
     details.append(make('h4','Letra completa'));
     details.append(make('pre',song.lyrics||'Letra não informada','igjal-library-pre'));
     details.append(make('h4','Cifra digital'));
     details.append(make('pre',song.chords||'Cifra digital ainda não cadastrada','igjal-library-pre'));
     actions.append(actionButton('Visualizar',()=>{details.open=!details.open;}));
     if(can('hinos')){
       actions.append(actionButton('Editar',()=>{
         const input=$('edit-song-number');if(!input)return;
         input.value=String(song.number);$('admin-load-hino')?.click();
         $('admin-hino-form')?.scrollIntoView({behavior:'smooth',block:'start'});
       }));
       actions.append(removed
         ?actionButton('Restaurar',()=>void restoreHymn(song))
         :actionButton('Excluir do site',()=>void hideHymn(song),'btn btn-outline btn-sm igjal-danger'));
     }
     row.append(head,actions,details);host.append(row);
   }
 }
 async function loadHymns(){
   if(!maySee()||!db())return;
   const {data,error}=await db().from('hinos_ocultos').select('numero');
   if(error){status('igjal-hinos-status','Falha ao consultar hinos excluídos: '+error.message,true);return;}
   hidden=new Set((data||[]).map(x=>Number(x.numero)));
   renderHymns();
 }
 async function hideHymn(song){
   if(!can('hinos')||!db())return;
   if(!confirm('Excluir o hino '+song.number+' — '+song.title+' da versão pública?\n\nA letra e a cifra ficarão preservadas para restauração. Os créditos não serão apagados.'))return;
   const {error}=await db().from('hinos_ocultos').insert({numero:song.number});
   if(error)return status('igjal-hinos-status','Não foi possível retirar: '+error.message,true);
   hidden.add(song.number);renderHymns();
   status('igjal-hinos-status','Hino '+song.number+' retirado do catálogo público. O conteúdo continua preservado.');
   window.IGREJA_V4?.reloadPublic?.();
 }
 async function restoreHymn(song){
   if(!can('hinos')||!db())return;
   if(!confirm('Restaurar o hino '+song.number+' no site público?'))return;
   const {data,error}=await db().from('hinos_ocultos').delete().eq('numero',song.number).select('numero');
   if(error||!data?.length)return status('igjal-hinos-status','Não foi possível restaurar o hino.',true);
   hidden.delete(song.number);renderHymns();
   status('igjal-hinos-status','Hino '+song.number+' restaurado.');
   window.IGREJA_V4?.reloadPublic?.();
 }
 function isPdf(file){return file&&file.type==='application/pdf'&&file.size<=5*1024*1024&&file.size>=16;}
 async function pdfHeader(file){
   const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
   return String.fromCharCode(...bytes)==='%PDF-';
 }
 async function pdfView(row,isPublic){
   if(!db())return;
   const popup=window.open('about:blank','_blank');
   if(popup)popup.opener=null;
   try{
     const bucket=isPublic?'cifras-publicadas':'cifras-envios';
     const {data,error}=isPublic
        ?db().storage.from(bucket).getPublicUrl(row.storage_path)
        :await db().storage.from(bucket).createSignedUrl(row.storage_path,180);
     if(error)throw error;
     const url=isPublic?data?.publicUrl:data?.signedUrl;
     if(!url)throw new Error('Arquivo não disponível.');
     if(popup)popup.location.replace(url);
     else window.open(url,'_blank','noopener,noreferrer');
   }catch(err){if(popup)popup.close();status('igjal-cifras-status','Não foi possível abrir PDF: '+err.message,true);}
 }
 async function loadPdfs(){
   if(!maySee()||!db())return;
   const [published,received]=await Promise.all([
      db().from('cifras_publicadas').select('hino_numero,voz_confortavel,origem_envio,storage_path,publicado_em').order('hino_numero'),
      db().from('cifra_envios').select('id,hino_numero,nome,tom,voz_confortavel,observacoes,status,storage_path,criado_em').order('criado_em',{ascending:false}).limit(1000)
   ]);
   if(published.error||received.error){
      status('igjal-cifras-status','Erro ao consultar acervo: '+(published.error||received.error).message,true);return;
   }
   pdfRows=published.data||[];sendRows=received.data||[];renderPdfs();
 }
 function renderPdfs(){
   const host=$('igjal-cifras-biblioteca');if(!host)return;host.replaceChildren();
   if(!maySee())return;
   const query=norm($('igjal-cifras-busca')?.value);
   const linked=new Set(pdfRows.map(x=>x.origem_envio).filter(Boolean));
   const records=[
      ...pdfRows.map(item=>({type:'public',item,source:sendRows.find(x=>x.id===item.origem_envio)||null})),
      ...sendRows.filter(x=>!linked.has(x.id)).map(item=>({type:'submission',item,source:item}))
   ];
   const filtered=records.filter(({type,item,source})=>norm(
      item.hino_numero+' '+titleFor(item.hino_numero)+' '+(source?.nome||'')+' '+(source?.tom||'')+' '+(source?.status||'')+' '+item.voz_confortavel
   ).includes(query));
   const chords=names().filter(x=>String(x.chords||'').trim()&&!hidden.has(x.number));
   status('igjal-cifras-status',pdfRows.length+' PDF(s) publicados • '+sendRows.filter(x=>x.status==='pendente').length+' pendentes • '+sendRows.filter(x=>x.status==='rejeitado').length+' rejeitados • '+chords.length+' cifras digitais. '+filtered.length+' PDF(s) no filtro.');
   if(!filtered.length)host.append(make('p','Nenhum PDF correspondente. As cifras digitais aparecem na seção seguinte.','muted'));
   for(const {type,item,source} of filtered){
     const published=type==='public';
     const card=make('article',null,'igjal-library-item');
     const head=make('div',null,'igjal-library-head');
     const left=make('div');
     left.append(make('strong','Hino '+String(item.hino_numero).padStart(2,'0')+' — '+titleFor(item.hino_numero)),
        make('small',published?'PDF publicado'+(source?.tom?' • Tom '+source.tom:''):(source?.nome||'Colaborador')+' • Tom '+(source?.tom||'a confirmar')));
     head.append(left,make('span',published?'Publicado':item.status,'igjal-library-badge'));
     const actions=make('div',null,'igjal-library-actions');
     actions.append(actionButton('Abrir PDF',()=>void pdfView(item,published)));
     if(can('cifras')){
       if(published){
         const upload=make('input');upload.type='file';upload.accept='application/pdf,.pdf';upload.hidden=true;
         upload.addEventListener('change',()=>{if(upload.files?.[0])void replacePdf(item,upload.files[0]);upload.value='';});
         actions.append(actionButton('Substituir PDF',()=>upload.click()),upload);
         actions.append(actionButton('Excluir PDF',()=>void deletePdf(item,true),'btn btn-outline btn-sm igjal-danger'));
       }else{
         if(item.status!=='aprovado'){
           actions.append(actionButton('Excluir envio',()=>void deletePdf(item,false),'btn btn-outline btn-sm igjal-danger'));
         }
       }
       if(source){
          const form=make('details',null,'igjal-library-details');
          form.append(make('summary','Editar informações do envio'));
          const label=make('label','Tom original');
          const input=make('input');input.type='text';input.maxLength=20;input.value=source.tom||'';
          label.append(input);
          const obsLabel=make('label','Observações');
          const observation=make('textarea');observation.maxLength=400;observation.rows=2;observation.value=source.observacoes||'';
          obsLabel.append(observation);
          form.append(label,obsLabel,actionButton('Salvar informações',()=>void updateMetadata(source,input.value,observation.value)));
          card.append(form);
       }
     }
     card.prepend(head,actions);host.append(card);
   }
   const digital=$('igjal-cifras-digitais');if(!digital)return;digital.replaceChildren();
   const list=chords.filter(s=>norm(s.number+' '+s.title+' '+s.author).includes(query));
   const summary=make('p',list.length+' cifras digitais com acordes cadastrados.','muted');digital.append(summary);
   for(const song of list){
      const card=make('details',null,'igjal-library-item igjal-library-digital');
      card.append(make('summary',String(song.number).padStart(2,'0')+' — '+song.title+(song.key?' • Tom '+song.key:'')),
        make('pre',song.chords,'igjal-library-pre'));
      if(can('hinos'))card.append(actionButton('Editar letra e cifra',()=>{
        $('edit-song-number').value=String(song.number);$('admin-load-hino')?.click();
        window.IGREJA_V4?.loadPanel?.('hinos');
        window.setTimeout(()=>$('admin-hino-form')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
      }));
      digital.append(card);
   }
 }
 async function updateMetadata(source,tom,observacoes){
   if(!can('cifras')||!db())return;
   if(!String(tom||'').trim()||String(tom).length>20)return status('igjal-cifras-status','Informe um tom original válido.',true);
   const {data,error}=await db().from('cifra_envios').update({tom:String(tom).trim(),observacoes:String(observacoes||'').slice(0,400)||null})
      .eq('id',source.id).select('id');
   if(error||!data?.length)return status('igjal-cifras-status','Não foi possível editar metadados: '+(error?.message||'acesso negado'),true);
   status('igjal-cifras-status','Informações atualizadas. A edição foi registrada no histórico.');
   await loadPdfs();
 }
 async function replacePdf(row,file){
   if(!can('cifras')||!db())return;
   if(!isPdf(file)||!(await pdfHeader(file)))return status('igjal-cifras-status','Selecione um PDF válido de até 5 MB.',true);
   if(!confirm('Substituir o PDF publicado do hino '+row.hino_numero+'? A nova versão será visível imediatamente.'))return;
   const path='hino-'+row.hino_numero+'-'+Date.now()+'.pdf';
   const {error:upErr}=await db().storage.from('cifras-publicadas').upload(path,file,{contentType:'application/pdf',upsert:false});
   if(upErr)return status('igjal-cifras-status','Falha no envio do PDF: '+upErr.message,true);
   const {data,error}=await db().from('cifras_publicadas').update({storage_path:path,publicado_em:new Date().toISOString()})
      .eq('hino_numero',row.hino_numero).eq('voz_confortavel',row.voz_confortavel).select('storage_path');
   if(error||!data?.length){
     await db().storage.from('cifras-publicadas').remove([path]);
     return status('igjal-cifras-status','Não foi possível publicar o arquivo: '+(error?.message||'permissão negada'),true);
   }
   const cleanup=await db().storage.from('cifras-publicadas').remove([row.storage_path]);
   status('igjal-cifras-status',cleanup.error
     ?'PDF atualizado; o arquivo antigo precisará de limpeza pelo administrador.'
     :'PDF atualizado e substituído. Responsável registrado no histórico.',Boolean(cleanup.error));
   await loadPdfs();
 }
 async function deletePdf(row,published){
   if(!can('cifras')||!db())return;
   const descr=published?'PDF publicado':'envio de cifra';
   if(!confirm('Excluir '+descr+' do hino '+row.hino_numero+'?\n\nO histórico da alteração permanece preservado.'))return;
   const target=published?'cifras_publicadas':'cifra_envios';
   let req=db().from(target).delete();
   if(published)req=req.eq('hino_numero',row.hino_numero).eq('voz_confortavel',row.voz_confortavel);
   else req=req.eq('id',row.id);
   const {data,error}=await req.select(published?'hino_numero':'id');
   if(error||!data?.length)return status('igjal-cifras-status','Não foi possível excluir: '+(error?.message||'acesso negado'),true);
   const storage=await db().storage.from(published?'cifras-publicadas':'cifras-envios').remove([row.storage_path]);
   status('igjal-cifras-status',storage.error
     ?'Registro retirado do site, mas o arquivo físico ainda precisa ser removido por um administrador.'
     :'Registro e PDF removidos. Exclusão registrada no histórico.',Boolean(storage.error));
   await loadPdfs();window.IGREJA_RELOAD_PUBLISHED_CIFRAS?.();
 }
 async function readHistory(){
   if(!logged()||!db())return [];
   const {data,error}=await db().rpc('igjal_consultar_historico_conteudo',{p_limite:400});
   if(error){status('igjal-historico-status','Não foi possível consultar responsáveis: '+error.message,true);return [];}
   history=data||[];return history;
 }
 async function renderHistory(){
   const host=$('igjal-historico-list');
   if(!host||!logged())return;
   const records=await readHistory();
   host.replaceChildren();
   if(!records.length){
     host.append(make('p','Nenhuma alteração rastreada ainda. Registros anteriores à ativação não permitem identificar o responsável original.','muted'));
     return;
   }
   status('igjal-historico-status',records.length+' alterações recentes. Nomes de responsáveis são exibidos apenas na administração.');
   for(const row of records){
     const label=({site_eventos:'Evento',site_avisos:'Aviso',hinos_edicoes:'Hinário',hinos_ocultos:'Retirada de hino',
       cifras_publicadas:'PDF de cifra',cifra_envios:'Envio de cifra',site_celebracoes:'Celebração',
       site_kits_musicas:'Música de ensaio',site_kits_faixas:'Faixa de ensaio',
       site_midias:'Mídia',site_estudos:'Estudo bíblico',site_identidade:'Identidade',site_live_destaque:'Live'})[row.entidade]||row.entidade;
     const box=make('article',null,'igjal-library-item');
     box.append(make('strong',label+' • '+row.titulo+' — '+row.acao),
       make('small','Responsável: '+(row.responsavel_nome||'Não identificado')+
          (ctx?.isAdmin?.()&&row.responsavel_email?' ('+row.responsavel_email+')':'')+' • '+stamp(row.registrado_em)));
     if(row.campos_alterados?.length)box.append(make('small','Campos alterados: '+row.campos_alterados.filter(x=>!['atualizado_em','publicado_em'].includes(x)).join(', ')));
     host.append(box);
   }
 }
 async function annotateEvents(){
   if(!logged())return;
   await readHistory();
   const panel=$('admin-event-list');if(!panel)return;
   const cards=[...panel.querySelectorAll('[data-igjal-event-id]')];
   for(const card of cards){
     const id=card.dataset.igjalEventId;
     const acts=history.filter(x=>x.entidade==='site_eventos'&&x.referencia===id);
     card.querySelector('.igjal-audit-byline')?.remove();
     const created=acts.find(x=>x.acao==='criado');
     const updated=acts.find(x=>x.acao==='editado');
     const byline=make('p',created
       ?'Publicado por: '+(created.responsavel_nome||'Não identificado')+' em '+stamp(created.registrado_em)
       :'Publicado antes do início do registro de responsáveis. Autor original não identificado.','igjal-audit-byline');
     if(updated)byline.append(make('span',' • Última edição: '+updated.responsavel_nome+' em '+stamp(updated.registrado_em)));
     card.append(byline);
   }
 }
 function init(context){
   ctx=context;
   $('igjal-hinos-busca')?.addEventListener('input',renderHymns);
   $('igjal-cifras-busca')?.addEventListener('input',renderPdfs);
   $('igjal-hinos-reload')?.addEventListener('click',()=>void loadHymns());
   $('igjal-cifras-reload')?.addEventListener('click',()=>void loadPdfs());
   $('igjal-historico-reload')?.addEventListener('click',()=>void renderHistory());
   if($('admin-hino-form')&&!can('hinos')){
     for(const e of $('admin-hino-form').querySelectorAll('input,textarea,select,button'))e.disabled=true;
     $('admin-hino-form').insertAdjacentText('beforebegin','Você pode consultar todas as letras e cifras, mas somente revisores do Hinário podem editar esse conteúdo.');
   }
   if(maySee())void Promise.all([loadHymns(),loadPdfs()]);
   if(ctx?.isAdmin?.()||ctx?.isEventsAdmin?.())void readHistory();
 }
 async function refresh(which){
   if(!maySee())return;
   if(which==='hinos')await loadHymns();
   if(which==='cifras')await loadPdfs();
   if(which==='historico')await renderHistory();
   if(which==='agenda')await annotateEvents();
 }
 return {init,refresh,loadHymns,loadPdfs,renderHistory,annotateEvents,onAuthChange:()=>void refresh()};
})();