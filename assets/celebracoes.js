/* IGJAL — Calendário de aniversários e batismos com gestão restrita ao administrador. */
window.IGREJA_CELEBRACOES = (() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let ctx=null,rows=[],editingId=null,initialized=false;
  const kinds={
    aniversario:'Aniversário de nascimento',
    batismo:'Aniversário de batismo',
    diaconato:'Chamado ao diaconato',
    pastorado:'Chamado ao pastorado',
    casamento:'Aniversário de casamento',
    ministerio:'Data ministerial'
  };
  const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const el=(tag,cls,value)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(value!==undefined)node.textContent=String(value);
    return node;
  };
  const isAdmin=()=>ctx?.isAdmin?.()===true && Boolean(ctx?.db?.());
  const clean=s=>String(s??'').trim().replace(/\s+/g,' ');
  const normalize=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const nameOfMonth=m=>months[Number(m)-1]||'Mês';
  const numDay=d=>String(d).padStart(2,'0');
  const validDay=(d,m)=>Number.isInteger(d)&&Number.isInteger(m)&&m>=1&&m<=12&&d>=1&&d<=new Date(2024,m,0).getDate();
  const validPhoto=s=>!s||(/^https:\/\/[^\s]+$/.test(s)&&s.length<=700)||(/^assets\/fotos\/[A-Za-z0-9/_-]+\.(?:png|jpg|jpeg|webp)$/i.test(s)&&s.length<=700);
  const sortDates=(a,b)=>Number(a.mes)-Number(b.mes)||Number(a.dia)-Number(b.dia)||a.nome.localeCompare(b.nome,'pt-BR');
  const status=(msg,bad=false)=>{
    const target=$('celebration-status');if(!target)return;
    target.textContent=msg;
    target.classList.toggle('error',bad);
  };
  const monthSelected=()=>{
    const m=Number($('celebracoes-filtro-mes')?.value);
    return m>=1&&m<=12?m:new Date().getMonth()+1;
  };
  function personCard(item,compact=false){
    const card=el('article','celebration-person'+(compact?' celebration-person-compact':''));
    if(validPhoto(item.foto_url)&&item.foto_url){
      const photo=el('img','celebration-avatar');
      photo.alt='Fotografia de '+item.nome;
      photo.src=item.foto_url;
      photo.loading='lazy';
      photo.decoding='async';
      card.append(photo);
    }else{
      const avatar=el('span','celebration-avatar celebration-avatar-placeholder',item.tipo==='batismo'?'✳':'♫');
      avatar.setAttribute('aria-hidden','true');
      card.append(avatar);
    }
    const copy=el('div','celebration-person-details');
    copy.append(el('strong','',item.nome));
    if(item.tipo==='batismo' && item.ano_referencia)
      copy.append(el('small','', 'Batismo em '+item.ano_referencia));
    else if(item.tipo!=='aniversario' && item.tipo!=='batismo')
      copy.append(el('small','',kinds[item.tipo]||'Data especial'));
    card.append(copy);
    return card;
  }
  function groupByDay(items,host,emptyMessage){
    if(!host)return;
    host.replaceChildren();
    if(!items.length){host.append(el('p','empty-state',emptyMessage));return;}
    let currentDay=null,people=null;
    for(const item of [...items].sort(sortDates)){
      if(item.dia!==currentDay){
        currentDay=item.dia;
        const group=el('div','celebration-day-group');
        const date=el('div','celebration-day-badge');
        date.append(el('strong','',numDay(item.dia)),el('span','',nameOfMonth(item.mes).slice(0,3).toUpperCase()));
        people=el('div','celebration-day-people');
        group.append(date,people);host.append(group);
      }
      people.append(personCard(item));
    }
  }
  function renderAgenda(){
    const selected=monthSelected();
    const label=$('celebracoes-mes-nome');
    if(label)label.textContent=nameOfMonth(selected);
    const published=rows.filter(item=>item.publicado===true&&Number(item.mes)===selected);
    const born=published.filter(item=>item.tipo==='aniversario');
    const ministry=published.filter(item=>item.tipo!=='aniversario');
    groupByDay(born,$('celebracoes-nascimento'),'Nenhum aniversário de nascimento cadastrado neste mês.');
    groupByDay(ministry,$('celebracoes-batismo'),'Nenhum aniversário de batismo ou data ministerial cadastrado neste mês.');
    const total=$('celebracoes-resumo');
    if(total)total.textContent=born.length+' aniversariante(s) • '+ministry.length+
      ' data(s) de batismo e ministério em '+nameOfMonth(selected)+'.';
  }
  function renderHome(){
    const host=$('home-celebrations');
    if(!host)return;
    const month=new Date().getMonth()+1;
    const selectedName=$('home-celebrations-month');
    if(selectedName)selectedName.textContent=nameOfMonth(month).toLowerCase();
    const published=rows.filter(item=>item.publicado===true && Number(item.mes)===month);
    const birthdays=published.filter(item=>item.tipo==='aniversario').sort(sortDates);
    const ministry=published.filter(item=>item.tipo!=='aniversario').sort(sortDates);
    function renderMiniList(items,targetId,emptyText){
      const target=$(targetId);
      if(!target)return;
      target.replaceChildren();
      if(!items.length){
        target.append(el('p','home-celebration-empty',emptyText));
        return;
      }
      for(const item of items){
        const row=el('div','home-celebration-line');
        const date=el('span','home-celebration-mini-date',numDay(item.dia));
        const copy=el('span','home-celebration-mini-info');
        copy.append(el('strong','',item.nome));
        if(item.tipo!=='aniversario'){
          let detail=kinds[item.tipo]||'Data ministerial';
          if(item.tipo==='batismo'&&item.ano_referencia)detail+=' • '+item.ano_referencia;
          copy.append(el('small','',detail));
        }
        row.append(date,copy);
        target.append(row);
      }
    }
    renderMiniList(birthdays,'home-celebrations-birthdays','Nenhum aniversariante neste mês.');
    renderMiniList(ministry,'home-celebrations-ministry','Nenhum batismo ou chamado neste mês.');
    const count=$('home-celebrations-count');
    if(count)count.textContent=birthdays.length+' aniversário(s) pessoais • '+ministry.length+' data(s) de batismo ou ministério.';
  }
  async function load(){
    const db=ctx?.db?.();if(!db)return null;
    const {data,error}=await db.from('site_celebracoes')
      .select('id,nome,tipo,dia,mes,ano_referencia,foto_url,publicado,consentimento_confirmado,criado_em,origem_lista')
      .order('mes',{ascending:true}).order('dia',{ascending:true}).order('nome',{ascending:true});
    if(error){console.warn('Erro ao consultar aniversariantes:',error.message);return null;}
    return data||[];
  }
  function renderAdmin(){
    const section=$('celebration-admin-section');
    if(section)section.hidden=!isAdmin();
    const host=$('celebration-list');
    if(!host||!isAdmin())return;
    host.replaceChildren();
    const month=$('celebration-admin-month')?.value||'all';
    const kind=$('celebration-admin-type')?.value||'all';
    const term=normalize($('celebration-admin-search')?.value||'');
    const visible=rows.filter(item=>
      (month==='all'||Number(month)===Number(item.mes))&&
      (kind==='all'||item.tipo===kind)&&
      (!term||normalize(item.nome).includes(term))
    ).sort(sortDates);
    const counter=$('celebration-admin-count');
    if(counter)counter.textContent=visible.length+' registro(s) nesta seleção • '+rows.length+' no total.';
    if(!visible.length){host.append(el('p','muted','Nenhuma data corresponde aos filtros.'));return;}
    for(const item of visible){
      const card=el('article','celebration-admin-card');
      const body=el('div','celebration-admin-info');
      body.append(el('strong','',item.nome));
      const note=numDay(item.dia)+' de '+nameOfMonth(item.mes)+
        (item.ano_referencia?' de '+item.ano_referencia:'')+
        ' • '+(kinds[item.tipo]||item.tipo)+
        ' • '+(item.publicado?'Publicado':'Oculto');
      body.append(el('small','',note));
      const actions=el('div','celebration-admin-actions');
      const edit=el('button','btn btn-outline btn-sm','Editar');
      edit.type='button';
      edit.addEventListener('click',()=>editItem(item));
      const remove=el('button','btn btn-outline btn-sm','Excluir');
      remove.type='button';
      remove.addEventListener('click',()=>deleteItem(item));
      actions.append(edit,remove);card.append(body,actions);host.append(card);
    }
  }
  function resetForm(){
    const form=$('celebration-form');
    form?.reset();
    editingId=null;
    if($('celebration-submit'))$('celebration-submit').textContent='Adicionar aniversariante';
    if($('celebration-cancel-edit'))$('celebration-cancel-edit').hidden=true;
    if($('celebration-form-mode'))$('celebration-form-mode').textContent='Novo registro';
  }
  function editItem(item){
    if(!isAdmin())return;
    editingId=item.id;
    $('celebration-name').value=item.nome;
    $('celebration-kind').value=item.tipo;
    $('celebration-day').value=item.dia;
    $('celebration-month').value=item.mes;
    $('celebration-year').value=item.ano_referencia??'';
    $('celebration-photo').value=item.foto_url||'';
    $('celebration-consent').checked=Boolean(item.consentimento_confirmado);
    $('celebration-published').checked=Boolean(item.publicado);
    $('celebration-submit').textContent='Salvar alterações';
    $('celebration-cancel-edit').hidden=false;
    $('celebration-form-mode').textContent='Editando: '+item.nome;
    status('Você está editando o registro de '+item.nome+'.');
    $('celebration-form')?.scrollIntoView({behavior:'smooth',block:'start'});
    $('celebration-name')?.focus({preventScroll:true});
  }
  async function deleteItem(item){
    if(!isAdmin())return;
    if(!window.confirm('Excluir definitivamente '+item.nome+' ('+numDay(item.dia)+'/'+numDay(item.mes)+')?'))return;
    status('Excluindo registro...');
    const {data,error}=await ctx.db().from('site_celebracoes')
      .delete().eq('id',item.id).select('id').maybeSingle();
    if(error||!data){status('Não foi possível excluir: '+(error?.message||'acesso negado'),true);return;}
    if(editingId===item.id)resetForm();
    await refresh();
    status('Registro de '+item.nome+' excluído.');
  }
  async function saveItem(event){
    event.preventDefault();
    if(!isAdmin()){status('Somente o administrador geral pode alterar aniversariantes.',true);return;}
    const nome=clean($('celebration-name').value),tipo=$('celebration-kind').value,
      dia=Number($('celebration-day').value),mes=Number($('celebration-month').value),
      yearText=$('celebration-year').value,
      ano_referencia=yearText?Number(yearText):null,
      foto_url=clean($('celebration-photo').value)||null,
      publicado=$('celebration-published').checked,
      consent=$('celebration-consent').checked;
    if(!consent){status('Confirme a autorização de divulgação antes de salvar.',true);return;}
    if(nome.length<2||nome.length>100||!validDay(dia,mes)){status('Confira nome, dia e mês.',true);return;}
    if(!Object.hasOwn(kinds,tipo)){status('Tipo de comemoração inválido.',true);return;}
    if(tipo==='aniversario'&&ano_referencia!==null){status('Para aniversário de nascimento, não informe o ano.',true);return;}
    if(ano_referencia!==null&&(!Number.isInteger(ano_referencia)||ano_referencia<1900||ano_referencia>new Date().getFullYear())){status('Confira o ano do batismo ou marco ministerial.',true);return;}
    if(!validPhoto(foto_url)){status('Use apenas URL HTTPS ou caminho assets/fotos/ da fotografia autorizada.',true);return;}
    const record={nome,tipo,dia,mes,ano_referencia,foto_url,publicado,consentimento_confirmado:true};
    const submit=$('celebration-submit');submit.disabled=true;
    status(editingId?'Salvando alterações...':'Adicionando aniversariante...');
    let query;
    if(editingId)query=ctx.db().from('site_celebracoes').update(record).eq('id',editingId);
    else query=ctx.db().from('site_celebracoes').insert(record);
    const {data,error}=await query.select('id').maybeSingle();
    submit.disabled=false;
    if(error||!data){status('Não foi possível salvar: '+(error?.message||'acesso negado'),true);return;}
    const updated=Boolean(editingId);
    resetForm();
    await refresh();
    status(updated?'Alterações salvas com sucesso.':'Aniversariante cadastrado com sucesso.');
  }
  async function refresh(){
    const list=await load();
    if(list===null){
      const agenda=$('celebracoes-resumo');
      if(agenda)agenda.textContent='Não foi possível carregar as datas. Atualize esta página.';
      return;
    }
    rows=list;
    renderAgenda();
    renderHome();
    renderAdmin();
  }
  function initControls(){
    if(initialized)return;
    initialized=true;
    const month=$('celebracoes-filtro-mes');
    if(month){
      month.value=String(new Date().getMonth()+1);
      month.addEventListener('change',renderAgenda);
    }
    $('celebracoes-mes-atual')?.addEventListener('click',()=>{
      if(month)month.value=String(new Date().getMonth()+1);
      renderAgenda();
    });
    const filterMonth=$('celebration-admin-month');
    if(filterMonth)filterMonth.value=String(new Date().getMonth()+1);
    for(const key of ['celebration-admin-month','celebration-admin-type','celebration-admin-search']){
      const input=$(key);
      input?.addEventListener(input?.tagName==='INPUT'?'input':'change',renderAdmin);
    }
    $('celebration-form')?.addEventListener('submit',saveItem);
    $('celebration-cancel-edit')?.addEventListener('click',()=>{
      resetForm();status('Edição cancelada.');
    });
    $('celebration-kind')?.addEventListener('change',()=>{
      if($('celebration-kind').value==='aniversario')$('celebration-year').value='';
    });
  }
  async function init(context){
    ctx=context;
    initControls();
    await refresh();
  }
  return {init,onAuthChange:refresh,refresh};
})();