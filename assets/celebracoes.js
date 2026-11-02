/* IGJAL v7 — aniversários e marcos ministeriais, visíveis sem login após consentimento. */
window.IGREJA_CELEBRACOES = (()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  let api=null;
  const kinds={aniversario:'Aniversário',batismo:'Aniversário de batismo',diaconato:'Chamado ao diaconato',pastorado:'Chamado ao pastorado',casamento:'Casamento',ministerio:'Data ministerial'};
  const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
  const canEdit=()=>Boolean(api?.isEventsAdmin?.()&&api?.db?.());
  const status=(text,bad=false)=>{if($('celebration-status')){$('celebration-status').textContent=text;$('celebration-status').classList.toggle('error',bad)}};
  const dateName=month=>new Intl.DateTimeFormat('pt-BR',{month:'long'}).format(new Date(2024,month-1,1));
  async function load(){const db=api?.db?.();if(!db)return [];
    const {data,error}=await db.from('site_celebracoes').select('id,nome,tipo,dia,mes,ano_referencia,publicado,criado_em').order('dia');
    if(error){console.warn('Datas especiais ainda não configuradas:',error.message);return [];}return data||[];
  }
  function renderPublic(rows){const month=new Date().getMonth()+1;const entries=rows.filter(r=>r.publicado&&r.mes===month).sort((a,b)=>a.dia-b.dia);
    for(const id of ['celebracoes-mes','home-celebrations']){const host=$(id);if(!host)continue;host.replaceChildren();
      if(!entries.length){host.append(create('p','empty-state','Nenhuma comemoração publicada neste mês.'));continue;}
      for(const r of entries){const card=create('article','celebration-card');const date=create('strong','celebration-date',String(r.dia).padStart(2,'0'));const copy=create('div','celebration-copy');copy.append(create('b','',r.nome),create('span','',kinds[r.tipo]||'Data especial'));
        if(r.ano_referencia&&r.tipo!=='aniversario'){const elapsed=new Date().getFullYear()-r.ano_referencia;if(elapsed>0)copy.append(create('small','',elapsed===1?'1 ano de caminhada':`${elapsed} anos de caminhada`));}
        card.append(date,copy);host.append(card);}
    }
  }
  async function refresh(){const rows=await load();renderPublic(rows);renderAdmin(rows);}
  function renderAdmin(rows){const host=$('celebration-list');if(!host)return;host.replaceChildren();if(!canEdit()){host.append(create('p','muted','Para cadastrar, entre com uma conta autorizada para eventos.'));return;}
    if(!rows.length){host.append(create('p','muted','Nenhuma data cadastrada.'));return;}
    rows.forEach(r=>{const card=create('article','moderation-item');card.append(create('h3','',r.nome),create('p','',`${kinds[r.tipo]||r.tipo} • ${r.dia} de ${dateName(r.mes)} • ${r.publicado?'Publicado':'Não publicado'}`));
      const button=create('button','btn btn-outline','Excluir registro');button.type='button';button.addEventListener('click',async()=>{if(!confirm(`Remover a comemoração de ${r.nome}?`))return;const {error}=await api.db().from('site_celebracoes').delete().eq('id',r.id);if(error){status('Não foi possível excluir: '+error.message,true);return;}await refresh();});card.append(button);host.append(card);});
  }
  function validDay(day,month){return Number.isInteger(day)&&Number.isInteger(month)&&month>=1&&month<=12&&day>=1&&day<=new Date(2024,month,0).getDate();}
  function initForm(){$('celebration-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!canEdit())return status('Entre com uma conta de eventos autorizada.',true);if(!$('celebration-consent').checked)return status('Confirme a autorização de publicação.',true);
    const nome=$('celebration-name').value.trim(),tipo=$('celebration-kind').value, dia=Number($('celebration-day').value),mes=Number($('celebration-month').value),yr=$('celebration-year').value;
    if(nome.length<2||nome.length>100||!validDay(dia,mes))return status('Confira nome, dia e mês.',true);
    if(tipo==='aniversario'&&yr)return status('Para aniversário de nascimento, não informe o ano.',true);
    const ano_referencia=yr?Number(yr):null;if(ano_referencia!==null&&(!Number.isInteger(ano_referencia)||ano_referencia<1900||ano_referencia>new Date().getFullYear()))return status('Ano de referência inválido.',true);
    const {error}=await api.db().from('site_celebracoes').insert({nome,tipo,dia,mes,ano_referencia,publicado:$('celebration-published').checked,consentimento_confirmado:true});
    if(error)return status('Falha ao salvar: '+error.message,true);$('celebration-form').reset();status('Comemoração salva com sucesso.');await refresh();
  });}
  async function init(ctx){api=ctx;initForm();await refresh();}
  return {init,onAuthChange:refresh,refresh};
})();