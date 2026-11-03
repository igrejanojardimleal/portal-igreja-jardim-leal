/* IGJAL V6. Biblioteca de roteiros (não oficiais) + estudos completos publicados pela liderança. */
window.IGREJA_ESTUDOS = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const E = (tag, text, klass) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    if (klass) el.className = klass;
    return el;
  };
  const starter = window.IGREJA_ROTEIROS || {biblia:[],historia:[]};
  let ctx = null, area = null, filter = 'Todos', publicItems = [], editableItems = [];
  const norm = text => String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isAdmin = () => ctx?.isAdmin?.() === true;
  const canEditStudies = () => isAdmin() || ctx?.hasArea?.('editor_estudos') === true;
  const isReviewer = () => isAdmin() || ctx?.isStudyReviewer?.() === true;
  const isTeacher = () => isAdmin() || ctx?.isStudyTeacher?.() === true;
  const sourceLinks = text => String(text||'').split(/[\r\n]+/).map(s=>s.trim()).filter(s=>/^https:\/\/[^\s<>"']{4,500}$/.test(s)).slice(0,8);
  const catalog = a => [...(starter[a]||[])].map(x=>({...x, publicado:false}));
  const setStatus=(message,error=false)=>{const node=$('estudo-status');if(node){node.textContent=message;node.classList.toggle('error',error);}};
  const val=id=>String($(id)?.value||'').trim();

  async function fetchArea(a){
    const base = catalog(a), db = ctx?.db?.();
    if (!db) return base;
    try {
      const {data,error}=await db.from('site_estudos').select('slug,area,titulo,categoria,resumo,questao,referencias,corpo,fontes,publicado,autor_nome').eq('area',a).eq('publicado',true).order('titulo');
      if(error){console.warn('Estudos ainda não configurados:',error.message);return base;}
      const map = new Map(base.map(x=>[x.slug,x]));
      for(const row of data||[]) map.set(row.slug,{...row,publicado:true});
      return [...map.values()].sort((x,y)=>x.titulo.localeCompare(y.titulo,'pt-BR'));
    }catch(e){console.warn('Biblioteca local:',e);return base;}
  }
  function closeDetail(){const dlg=$('library-dialog');if(dlg?.open)dlg.close();}
  function openDetail(item){
    const dlg=$('library-dialog');if(!dlg)return;
    $('library-dialog-title').textContent=item.titulo;
    $('library-dialog-category').textContent=item.categoria+(item.autor_nome?' • Por '+item.autor_nome:'');
    $('library-dialog-badge').textContent=item.publicado?'ESTUDO PUBLICADO':'ROTEIRO INICIAL';
    $('library-dialog-summary').textContent=item.resumo;
    $('library-dialog-question').textContent=item.questao||'Perguntas e pontos de estudo serão detalhados pela liderança.';
    $('library-dialog-references').textContent=item.referencias||'Este tema histórico utiliza referências bibliográficas, indicadas abaixo.';
    $('library-verses-label').textContent=item.area==='biblia'?'Textos bíblicos para leitura':'Base histórica';
    const full=$('library-dialog-full');full.replaceChildren();
    if(item.publicado && item.corpo){full.append(E('h3','Estudo completo'));full.append(E('p',item.corpo));}
    const sources=$('library-dialog-sources');sources.replaceChildren();
    const links=sourceLinks(item.fontes);
    if(links.length){sources.append(E('h3','Fontes para consulta'));for(const url of links){const row=E('p');const a=E('a',url);a.href=url;a.target='_blank';a.rel='noopener noreferrer nofollow';row.append(a);sources.append(row);}}
    $('library-dialog-disclaimer').textContent=item.publicado?'Estudo disponibilizado após revisão editorial da igreja.':'Roteiro inicial. A liderança poderá ampliar, corrigir e aprovar o estudo completo antes de publicá-lo.';
    if(!dlg.open)dlg.showModal();
  }
  function render(){
    const grid=$('library-grid');if(!grid)return;
    grid.replaceChildren();
    const q=norm($('library-search')?.value);
    const items=publicItems.filter(x=>(filter==='Todos'||x.categoria===filter)&&norm([x.titulo,x.categoria,x.resumo,x.questao,x.referencias,x.corpo,x.autor_nome].join(' ')).includes(q));
    $('library-count').textContent=items.length===1?'1 assunto encontrado':`${items.length} assuntos encontrados`;
    if(!items.length){grid.append(E('p','Nenhum resultado. Experimente outra palavra ou categoria.','empty-state'));return;}
    for(const item of items){
      const card=E('article',undefined,'library-card');
      card.append(E('span',item.publicado?'Estudo completo':'Roteiro para estudo','library-kind'));
      card.append(E('h3',item.titulo));
      if(item.autor_nome)card.append(E('p','Por '+item.autor_nome,'library-author'));
      card.append(E('p',item.resumo));
      if(item.referencias)card.append(E('div',item.referencias,'library-ref'));
      const b=E('button',item.publicado?'Abrir estudo →':'Ver roteiro →');b.type='button';b.addEventListener('click',()=>openDetail(item));card.append(b);grid.append(card);
    }
  }
  function renderFilters(){
    const cats=$('library-categories');if(!cats)return;
    cats.replaceChildren();const options=['Todos',...new Set(publicItems.map(s=>s.categoria))];
    for(const c of options){const b=E('button',c,'library-filter');b.type='button';b.setAttribute('aria-pressed',String(filter===c));b.addEventListener('click',()=>{filter=c;renderFilters();render();});cats.append(b);}
  }
  async function refreshPage(){
    if(!area)return;
    publicItems=await fetchArea(area);renderFilters();render();
    const note=$('library-empty-note'),publicSection=$('library-public-section');
    if(note)note.hidden=publicItems.length>0;
    if(publicSection)publicSection.hidden=publicItems.length===0;
    const slug=new URLSearchParams(location.search).get('estudo');
    if(slug){const found=publicItems.find(x=>x.slug===slug);if(found && !$('library-dialog').open)openDetail(found);}
  }
  function fillForm(row){
    const r=row||{area:val('estudo-area')||'biblia',slug:'',titulo:'',categoria:'',referencias:'',resumo:'',questao:'',corpo:'',fontes:'',publicado:false};
    for(const [id,key] of [['estudo-slug','slug'],['estudo-titulo','titulo'],['estudo-categoria','categoria'],['estudo-referencias','referencias'],['estudo-resumo','resumo'],['estudo-questao','questao'],['estudo-corpo','corpo'],['estudo-fontes','fontes']])if($(id))$(id).value=r[key]||'';
    if($('estudo-area'))$('estudo-area').value=r.area||'biblia';
    if($('estudo-publicado'))$('estudo-publicado').checked=!!r.publicado;
  }
  function fillAdminSelect(){
    const select=$('estudo-lista');if(!select)return;
    select.replaceChildren();const empty=E('option','Selecione um roteiro ou crie novo');empty.value='';select.append(empty);
    const a=val('estudo-area');
    const selectedMap=new Map(catalog(a).map(x=>[x.slug,x]));
    for(const item of editableItems.filter(x=>x.area===a))selectedMap.set(item.slug,item);
    for(const item of [...selectedMap.values()].sort((x,y)=>x.titulo.localeCompare(y.titulo,'pt-BR'))){const opt=E('option',`${item.titulo}${item.publicado?' · publicado':' · rascunho'}`);opt.value=item.slug;select.append(opt);}
  }
  function selectedRow(){
    const slug=val('estudo-lista');const a=val('estudo-area');
    return editableItems.find(x=>x.slug===slug && x.area===a) || catalog(a).find(x=>x.slug===slug);
  }
  async function refreshAdmin(nextCtx){
    if(nextCtx)ctx=nextCtx;
    if(!(isReviewer()||canEditStudies()) || !ctx?.db?.())return;
    if(isReviewer())await refreshReviews();
    if(!canEditStudies()){
      if($('admin-estudo-form'))$('admin-estudo-form').hidden=true;
      if($('estudo-registros'))$('estudo-registros').hidden=true;
      return;
    }
    if(!$('estudo-lista'))return;
    try {
      const {data,error}=await ctx.db().from('site_estudos').select('*').order('titulo');
      if(error)throw error;
      editableItems=data||[];
      fillAdminSelect();
      const host=$('estudo-registros');if(host){host.replaceChildren();for(const row of editableItems){const div=E('article',undefined,'moderation-item');div.append(E('h3',row.titulo),E('small',`${row.area==='biblia'?'Estudo bíblico':'História da fé'} • ${row.publicado?'Publicado':'Rascunho'}`));host.append(div);}}
    }catch(e){setStatus('Não foi possível buscar estudos. Verifique a migração SQL V6 e a autenticação. '+e.message,true);}
  }
  function initializeAdmin(){
    if(!$('admin-estudo-form'))return;
    $('estudo-area').addEventListener('change',()=>{fillAdminSelect();fillForm(null);setStatus('');});
    $('estudo-lista').addEventListener('change',()=>{const row=selectedRow();if(row)fillForm(row);else fillForm(null);setStatus('');});
    $('estudo-novo').addEventListener('click',()=>{fillForm(null);$('estudo-lista').value='';$('estudo-slug').focus();setStatus('Novo roteiro. Comece pelo identificador e título.');});
    $('admin-estudo-form').addEventListener('submit',async ev=>{
      ev.preventDefault();
      if(!canEditStudies() || !ctx?.db?.())return setStatus('Acesso autorizado somente a editores de estudos.',true);
      const record={slug:val('estudo-slug').toLowerCase(),area:val('estudo-area'),titulo:val('estudo-titulo'),categoria:val('estudo-categoria'),referencias:val('estudo-referencias'),resumo:val('estudo-resumo'),questao:val('estudo-questao'),corpo:val('estudo-corpo'),fontes:val('estudo-fontes'),publicado:!!$('estudo-publicado').checked};
      if(!/^[a-z0-9-]{2,100}$/.test(record.slug))return setStatus('Identificador inválido. Utilize letras minúsculas, números e hífen.',true);
      if(record.publicado && !record.corpo.trim())return setStatus('Para publicar, escreva o estudo completo e revise seu conteúdo.',true);
      if(sourceLinks(record.fontes).length !== record.fontes.split(/[\r\n]+/).filter(x=>x.trim()).length)return setStatus('As fontes devem conter somente um endereço HTTPS por linha.',true);
      try{
        // 'upsert' precisa de privilégios de INSERT e UPDATE: RLS do banco define quem pode executar.
        const {error}=await ctx.db().from('site_estudos').upsert(record,{onConflict:'slug'});
        if(error)throw error;
        setStatus(record.publicado?'Estudo revisado e publicado.':'Rascunho salvo. O estudo completo não está público.');
        await refreshAdmin();await refreshPage();
      }catch(e){setStatus('Erro ao salvar: '+e.message,true);}
    });
  }

  const validName=()=>window.IGREJA_MEMBROS?.displayName?.(ctx?.user?.())||'';
  function onAuthChange(){
    const teacher=$('study-teacher-panel');if(teacher){teacher.hidden=!isTeacher();if(isTeacher()&&location.hash==='#study-teacher-panel')window.requestAnimationFrame(()=>teacher.scrollIntoView({block:'start'}));}
    const adminEditor=$('admin-estudo-form');if(adminEditor)adminEditor.hidden=!canEditStudies();
    const adminRecords=$('estudo-registros');if(adminRecords)adminRecords.hidden=!canEditStudies();
    if(isTeacher())void refreshMyStudies();
    if(isReviewer())void refreshReviews();
  }
  async function refreshMyStudies(){
    const host=$('study-my-submissions');if(!host||!ctx?.db?.()||!ctx?.user?.())return;
    const {data,error}=await ctx.db().from('site_estudo_envios')
      .select('titulo,status,criado_em,parecer').eq('user_id',ctx.user().id).order('criado_em',{ascending:false}).limit(50);
    host.replaceChildren();
    if(error){host.append(E('p','Não foi possível carregar seus envios.','muted'));return;}
    if(!data?.length){host.append(E('p','Você ainda não enviou nenhum estudo.','muted'));return;}
    for(const row of data){
      const card=E('article',undefined,'moderation-item');
      card.append(E('h4',row.titulo),E('p','Situação: '+({pendente:'Aguardando revisão',aprovado:'Publicado',rejeitado:'Não aprovado'}[row.status]||row.status),'muted'));
      if(row.parecer)card.append(E('p','Comentário do revisor: '+row.parecer));
      host.append(card);
    }
  }
  function studyInput(field,label,value,large=false){
    const wrap=E('label',undefined,'');
    wrap.append(document.createTextNode(label));
    const el=E(large?'textarea':'input');el.value=value||'';el.dataset.studyField=field;
    if(large)el.rows=field==='corpo'?10:3;else el.type='text';
    wrap.append(el);return wrap;
  }
  async function refreshReviews(){
    const host=$('study-review-list');if(!host||!ctx?.db?.()||!isReviewer())return;
    const status=$('study-review-status');if(status)status.textContent='Carregando estudos para análise...';
    const {data,error}=await ctx.db().from('site_estudo_envios')
     .select('id,autor_nome,titulo,categoria,referencias,resumo,corpo,fontes,criado_em,status')
     .eq('status','pendente').order('criado_em',{ascending:true}).limit(100);
    host.replaceChildren();
    if(error){if(status)status.textContent='Falha ao consultar: '+error.message;return;}
    if(status)status.textContent=data.length+' estudo(s) aguardando análise.';
    if(!data.length){host.append(E('p','Nenhum estudo aguardando revisão.','muted'));return;}
    for(const row of data){
      const card=E('article',undefined,'moderation-item');
      card.append(E('h3',row.titulo));
      card.append(E('p','Enviado por '+(row.autor_nome||'Membro da igreja')+' • '+new Date(row.criado_em).toLocaleDateString('pt-BR'),'muted'));
      const form=E('form',undefined,'admin-form-grid');
      for(const [field,label,large] of [
        ['titulo','Título',false],['categoria','Categoria',false],['referencias','Passagens bíblicas',true],
        ['resumo','Resumo',true],['corpo','Estudo completo (pode revisar e editar)',true],
        ['fontes','Fontes e referências (um URL HTTPS por linha)',true]
      ]){const labelNode=studyInput(field,label,row[field],large);if(large)labelNode.classList.add('form-span');form.append(labelNode);}
      const parecer=studyInput('parecer','Comentário para o autor (opcional)','',true);parecer.classList.add('form-span');form.append(parecer);
      const buttons=E('div',undefined,'admin-actions form-span');
      for(const [decision,label,css] of [['aprovado','Aprovar e publicar','btn btn-primary'],['rejeitado','Não aprovar','btn btn-outline']]){
        const button=E('button',label,css);button.type='button';
        button.addEventListener('click',async()=>{
          if(!isReviewer())return;
          const get=k=>String(form.querySelector('[data-study-field="'+k+'"]')?.value||'').trim();
          const args={p_envio_id:row.id,p_decisao:decision,
            p_titulo:get('titulo'),p_categoria:get('categoria'),p_referencias:get('referencias'),
            p_resumo:get('resumo'),p_corpo:get('corpo'),p_fontes:get('fontes'),p_parecer:get('parecer')};
          if(!window.confirm((decision==='aprovado'?'Publicar':'Não aprovar')+' o estudo de '+(row.autor_nome||'este autor')+'?'))return;
          const all=[...buttons.querySelectorAll('button')];all.forEach(b=>b.disabled=true);
          const {data:ok,error:err}=await ctx.db().rpc('revisar_estudo_enviado',args);
          if(err||ok!==true){if(status)status.textContent='Não foi possível concluir: '+(err?.message||'resposta inválida');all.forEach(b=>b.disabled=false);return;}
          if(status)status.textContent=decision==='aprovado'?'Estudo revisado e publicado com o nome do autor.':'Estudo não aprovado; o autor poderá ver o parecer.';
          await refreshReviews();
        });
        buttons.append(button);
      }
      form.append(buttons);card.append(form);host.append(card);
    }
  }
  function initTeacher(){
    const form=$('study-teacher-form');if(!form)return;
    form.addEventListener('submit',async event=>{
      event.preventDefault();const status=$('study-teacher-status');
      if(!ctx?.db?.()||!ctx?.user?.()||!isTeacher()){status.textContent='Somente professores autorizados podem enviar estudos.';return;}
      if(!validName()){status.textContent='Complete seu nome e sobrenome em Minha conta antes de enviar.';return;}
      const valId=id=>String($(id)?.value||'').trim();
      const record={
        user_id:ctx.user().id,titulo:valId('study-send-title'),categoria:valId('study-send-category'),
        referencias:valId('study-send-references'),resumo:valId('study-send-summary'),
        corpo:valId('study-send-body'),fontes:valId('study-send-sources'),status:'pendente'
      };
      if(record.titulo.length<2||record.resumo.length<5||record.corpo.length<20){status.textContent='Preencha título, resumo e estudo completo.';return;}
      if(sourceLinks(record.fontes).length!==record.fontes.split(/[\r\n]+/).filter(x=>x.trim()).length){status.textContent='Utilize somente links HTTPS, um por linha.';return;}
      status.textContent='Enviando para análise...';
      const submit=form.querySelector('button[type=submit]');submit.disabled=true;
      try{
        const {error}=await ctx.db().from('site_estudo_envios').insert(record);
        if(error)throw error;
        status.textContent='Estudo enviado! Aguarde a análise da equipe pastoral antes da publicação.';
        form.reset();await refreshMyStudies();
      }catch(e){status.textContent='Falha ao enviar: '+e.message;}
      finally{submit.disabled=false;}
    });
  }

  async function init(context){
    ctx=context;
    const page=document.body.dataset.page||'';
    if(page.startsWith('studies-'))area=page.substring(8);
    if(area==='biblia'||area==='historia'){
      $('library-search')?.addEventListener('input',render);
      $('library-close')?.addEventListener('click',closeDetail);
      await refreshPage();
    }
    initializeAdmin();
    initTeacher();
    $('study-review-refresh')?.addEventListener('click',refreshReviews);
    onAuthChange();
    if($('admin-estudo-form') && isReviewer())await refreshAdmin();
  }
  return {init,refreshAdmin,onAuthChange,refreshReviews};
})();