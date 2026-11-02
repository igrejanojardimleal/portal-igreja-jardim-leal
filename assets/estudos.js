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
  const sourceLinks = text => String(text||'').split(/[\r\n]+/).map(s=>s.trim()).filter(s=>/^https:\/\/[^\s<>"']{4,500}$/.test(s)).slice(0,8);
  const catalog = a => [...(starter[a]||[])].map(x=>({...x, publicado:false}));
  const setStatus=(message,error=false)=>{const node=$('estudo-status');if(node){node.textContent=message;node.classList.toggle('error',error);}};
  const val=id=>String($(id)?.value||'').trim();

  async function fetchArea(a){
    const base = catalog(a), db = ctx?.db?.();
    if (!db) return base;
    try {
      const {data,error}=await db.from('site_estudos').select('slug,area,titulo,categoria,resumo,questao,referencias,corpo,fontes,publicado').eq('area',a).eq('publicado',true).order('titulo');
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
    $('library-dialog-category').textContent=item.categoria;
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
    const items=publicItems.filter(x=>(filter==='Todos'||x.categoria===filter)&&norm([x.titulo,x.categoria,x.resumo,x.questao,x.referencias].join(' ')).includes(q));
    $('library-count').textContent=items.length===1?'1 assunto encontrado':`${items.length} assuntos encontrados`;
    if(!items.length){grid.append(E('p','Nenhum resultado. Experimente outra palavra ou categoria.','empty-state'));return;}
    for(const item of items){
      const card=E('article',undefined,'library-card');
      card.append(E('span',item.publicado?'Estudo completo':'Roteiro para estudo','library-kind'));
      card.append(E('h3',item.titulo),E('p',item.resumo));
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
    if(!$('estudo-lista') || !isAdmin() || !ctx?.db?.())return;
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
      if(!isAdmin() || !ctx?.db?.())return setStatus('Acesso somente para administradores autenticados.',true);
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
    if($('admin-estudo-form') && isAdmin())await refreshAdmin();
  }
  return {init,refreshAdmin};
})();