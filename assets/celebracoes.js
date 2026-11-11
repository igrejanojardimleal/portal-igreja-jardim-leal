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
  const canManage=()=>Boolean(ctx?.db?.()) && (ctx?.isAdmin?.()===true || ctx?.isEventsAdmin?.()===true);
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

  // Balões comemorativos: efeito visual acionado pelo visitante, nunca automático.
  // Mantém a navegação e as informações acessíveis mesmo sem animações.
  let celebrationFX=null, lastFX=0;
  function fxLayer(){
    if(celebrationFX?.isConnected)return celebrationFX;
    celebrationFX=document.getElementById('igjal-celebration-fx');
    if(!celebrationFX){
      celebrationFX=el('div','igjal-celebration-fx');
      celebrationFX.id='igjal-celebration-fx';
      celebrationFX.setAttribute('aria-hidden','true');
      document.body.append(celebrationFX);
    }
    return celebrationFX;
  }
  function celebrateName(button,kind){
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
    if(document.visibilityState==='hidden')return;
    const now=Date.now();
    if(now-lastFX<700)return; // evita rajadas acidentais
    lastFX=now;
    const layer=fxLayer();
    const rect=button.getBoundingClientRect();
    const cx=rect.left+rect.width/2;
    const cy=rect.top+rect.height/2;
    const shades=kind==='aniversario'
      ? ['#ff6c9d','#f4b544','#ff8c71','#b487df','#70bfce','#f47ebc']
      : ['#89bde3','#9e9adc','#81bd9b','#f6c9a5','#d2a2d2','#74c5ca'];
    const width=window.innerWidth, height=window.innerHeight;
    const quantity=window.matchMedia?.('(max-width: 650px)')?.matches?7:12;
    for(let i=0;i<quantity;i++){
      const balloon=el('span','igjal-party-balloon');
      const x=Math.max(24,Math.min(width-24,cx+(Math.random()-.5)*Math.min(width*.75,440)));
      const y=Math.min(height-24,Math.max(45,cy+Math.random()*90));
      balloon.style.left=x+'px';
      balloon.style.top=y+'px';
      balloon.style.setProperty('--balloon-color',shades[i%shades.length]);
      balloon.style.setProperty('--party-drift',((Math.random()-.5)*240)+'px');
      balloon.style.setProperty('--party-rise',(-height-y-70)+'px');
      balloon.style.setProperty('--party-spin',((Math.random()-.5)*48)+'deg');
      balloon.style.setProperty('--party-delay',Math.round(Math.random()*360)+'ms');
      balloon.style.setProperty('--party-duration',(3.5+Math.random()*1.7).toFixed(2)+'s');
      balloon.addEventListener('animationend',()=>balloon.remove(),{once:true});
      layer.append(balloon);
    }
    for(let i=0;i<10;i++){
      const sparkle=el('span','igjal-party-sparkle',i%3===0?'✿':i%3===1?'✦':'•');
      sparkle.style.left=Math.max(12,Math.min(width-12,cx+(Math.random()-.5)*190))+'px';
      sparkle.style.top=Math.max(20,Math.min(height-20,cy+(Math.random()-.5)*50))+'px';
      sparkle.style.color=shades[(i+2)%shades.length];
      sparkle.style.setProperty('--spark-x',((Math.random()-.5)*320)+'px');
      sparkle.style.setProperty('--spark-y',(-70-Math.random()*260)+'px');
      sparkle.style.setProperty('--spark-duration',(1.15+Math.random()*.9).toFixed(2)+'s');
      sparkle.addEventListener('animationend',()=>sparkle.remove(),{once:true});
      layer.append(sparkle);
    }
    // Limpeza extra se o navegador interromper a animação.
    window.setTimeout(()=>{layer.querySelectorAll('.igjal-party-balloon,.igjal-party-sparkle').forEach(node=>{
      if(!node.getAnimations().length)node.remove();
    });},6500);
  }
  function celebratoryName(item,small=false){
    const genderClass=item.genero_exibicao==='masculino'?' igjal-name-masculino':item.genero_exibicao==='feminino'?' igjal-name-feminino':' igjal-name-neutro';
    const b=el('button',(small?'igjal-name-celebrate home-celebrate-name':'igjal-name-celebrate')+genderClass,item.nome);
    b.type='button';
    b.title='Soltar balões para '+item.nome;
    b.setAttribute('aria-label','Celebrar '+item.nome+' com balões');
    b.addEventListener('click',()=>celebrateName(b,item.tipo));
    b.addEventListener('pointerenter',ev=>{
      if(ev.pointerType!=='mouse')return;
      const now=Date.now();
      if(now-Number(b.dataset.lastHover||0)<3500)return;
      b.dataset.lastHover=String(now);
      celebrateName(b,item.tipo);
    });
    return b;
  }
  function personCard(item,compact=false){
    const card=el('article','celebration-person'+(item.tipo==='aniversario'?' celebration-person-birthday':' celebration-person-ministry')+(compact?' celebration-person-compact':''));
    if(validPhoto(item.foto_url)&&item.foto_url){
      const photo=el('img','celebration-avatar');
      photo.alt='Fotografia de '+item.nome;
      photo.src=item.foto_url;
      photo.loading='lazy';
      photo.decoding='async';
      card.append(photo);
    }else{
      const avatar=el('span','celebration-avatar celebration-avatar-placeholder',item.tipo==='aniversario'?'🎂':item.tipo==='batismo'?'🕊️':'🌷');
      avatar.setAttribute('aria-hidden','true');
      card.append(avatar);
    }
    const copy=el('div','celebration-person-details');
    copy.append(celebratoryName(item));
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
  // Cartaz mensal PNG: usa apenas registros publicados com consentimento.
  const publishedForPoster=month=>rows.filter(item=>
    item.publicado===true &&
    item.consentimento_confirmado===true &&
    Number(item.mes)===Number(month) &&
    Object.hasOwn(kinds,item.tipo)
  ).sort(sortDates);
  const posterGroups=month=>{
    const approved=publishedForPoster(month);
    return [
      {title:'ANIVERSÁRIOS DE NASCIMENTO',subtitle:'Celebramos o dom da vida',accent:'#ad627d',tint:'#fff0f4',items:approved.filter(x=>x.tipo==='aniversario')},
      {title:'ANIVERSÁRIOS DE BATISMO',subtitle:'Uma caminhada de fé',accent:'#397b93',tint:'#eaf6fa',items:approved.filter(x=>x.tipo==='batismo')},
      {title:'DATAS MINISTERIAIS',subtitle:'Servindo com amor e propósito',accent:'#3e7867',tint:'#edf7ee',items:approved.filter(x=>x.tipo!=='aniversario'&&x.tipo!=='batismo')}
    ];
  };
  function posterRoundRect(g,x,y,w,h,r,fill){
    const rad=Math.min(r,w/2,h/2);
    g.beginPath();
    g.moveTo(x+rad,y);g.lineTo(x+w-rad,y);
    g.quadraticCurveTo(x+w,y,x+w,y+rad);
    g.lineTo(x+w,y+h-rad);g.quadraticCurveTo(x+w,y+h,x+w-rad,y+h);
    g.lineTo(x+rad,y+h);g.quadraticCurveTo(x,y+h,x,y+h-rad);
    g.lineTo(x,y+rad);g.quadraticCurveTo(x,y,x+rad,y);
    g.closePath();g.fillStyle=fill;g.fill();
  }
  function posterTextLines(g,text,maxWidth,maxLines=3){
    const words=clean(text).split(' ').filter(Boolean),lines=[];
    let line='';
    for(const word of words){
      const attempt=line?line+' '+word:word;
      if(!line||g.measureText(attempt).width<=maxWidth){line=attempt;continue;}
      lines.push(line);line=word;
      if(lines.length===maxLines-1)break;
    }
    // Preserve every part of the name: the last line may be compressed by fillText.
    const consumed=lines.join(' ').split(' ').filter(Boolean).length;
    if(lines.length===maxLines-1){
      lines.push(words.slice(consumed).join(' '));
    }else if(line)lines.push(line);
    return lines;
  }
  function posterGenderColors(person){
    const gender=normalize(person.genero_exibicao);
    if(gender==='masculino')return {ink:'#2269b9',background:'#eaf3ff',date:'#d6e8ff'};
    if(gender==='feminino')return {ink:'#ca4786',background:'#fff0f6',date:'#ffe0ed'};
    return {ink:'#244558',background:'#f0f4f6',date:'#e5eff2'};
  }
  function drawPosterName(g,name,x,y,maxWidth,maxHeight,maxFont=28){
    const text=clean(name);
    let font=maxFont,lines=[];
    for(;font>=16;font--){
      g.font='700 '+font+'px Manrope, Arial, sans-serif';
      lines=posterTextLines(g,text,maxWidth,2);
      if(lines.length*(font+3)<=maxHeight &&
         lines.every(line=>g.measureText(line).width<=maxWidth*1.25))break;
    }
    font=Math.max(16,font);
    g.font='700 '+font+'px Manrope, Arial, sans-serif';
    for(let n=0;n<Math.min(lines.length,2);n++){
      g.fillText(lines[n],x,y+n*(font+3),maxWidth);
    }
  }
  async function posterLogo(){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src=new URL('assets/fotos/logo-igreja-oficial.png',location.href).href;
    });
  }
  async function createMonthlyPoster(month){
    // Stories, Status e TikTok usam imagem vertical 9:16, sem seções vazias.
    const groups=posterGroups(month).filter(group=>group.items.length>0);
    if(!groups.length)throw new Error('Não há datas públicas com autorização neste mês.');
    try{await document.fonts?.ready;}catch(_){/* fontes disponíveis serão usadas */}
    const width=1080,height=1920;
    const top=420,bottom=1735,sectionGap=24;
    const headerRoom=groups.length*129+(groups.length-1)*sectionGap;
    const rowsFor=cols=>groups.reduce((sum,group)=>sum+Math.ceil(group.items.length/cols),0);
    // Com muitos registros, três colunas mantêm todas as datas dentro do Story.
    let columns=2;
    let rowH=Math.min(164,Math.floor((bottom-top-headerRoom)/Math.max(1,rowsFor(columns))));
    if(rowH<126){
      columns=3;
      rowH=Math.min(151,Math.floor((bottom-top-headerRoom)/Math.max(1,rowsFor(columns))));
    }
    if(rowH<93)throw new Error('Muitas datas para uma única imagem legível de 9:16. É necessário criar mais de um cartaz para o mês.');
    const colGap=14,cardW=Math.floor((924-colGap*(columns-1))/columns),cardH=rowH-10;
    const heightFor=group=>129+Math.ceil(group.items.length/columns)*rowH;
    const totalHeight=groups.reduce((sum,group)=>sum+heightFor(group),0)+sectionGap*(groups.length-1);
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const g=canvas.getContext('2d');
    if(!g)throw new Error('Este navegador não permite criar imagens.');
    g.fillStyle='#f4f9f7';g.fillRect(0,0,width,height);
    // Cabeçalho com identidade IGJAL, produzido diretamente em alta resolução.
    const grad=g.createLinearGradient(0,0,width,415);
    grad.addColorStop(0,'#103c4d');grad.addColorStop(.64,'#1c6070');grad.addColorStop(1,'#347d77');
    g.fillStyle=grad;g.fillRect(0,0,width,390);
    g.globalAlpha=.10;g.fillStyle='#d7fff0';
    g.beginPath();g.arc(1030,-55,290,0,2*Math.PI);g.fill();
    g.beginPath();g.arc(860,380,190,0,2*Math.PI);g.fill();
    g.globalAlpha=.11;g.strokeStyle='#ffffff';g.lineWidth=2;
    for(let i=0;i<5;i++){g.beginPath();g.arc(925,83,130+i*26,.5,4.2);g.stroke();}
    g.globalAlpha=1;
    g.fillStyle='#bce5d8';g.font='700 23px Manrope, Arial, sans-serif';
    g.fillText('IGJAL  /  OBRA DA RESTAURAÇÃO',65,75);
    g.fillStyle='#ffffff';g.font='800 78px Manrope, Arial, sans-serif';
    g.fillText('CELEBRAÇÕES',65,181);
    g.fillStyle='#e9f5f2';g.font='600 56px Manrope, Arial, sans-serif';
    g.fillText(nameOfMonth(month),67,266);
    g.fillStyle='#cbebe5';g.font='500 25px Manrope, Arial, sans-serif';
    g.fillText('Cada vida e cada jornada são especiais.',68,329);
    try{
      const logo=await posterLogo();
      if(logo){
        g.save();g.beginPath();g.arc(942,191,76,0,2*Math.PI);g.clip();
        g.fillStyle='#fff';g.fillRect(866,115,152,152);
        const scale=Math.min(130/logo.width,130/logo.height);
        const w=logo.width*scale,h=logo.height*scale;
        g.drawImage(logo,942-w/2,191-h/2,w,h);g.restore();
        g.strokeStyle='#aedfd7';g.lineWidth=5;
        g.beginPath();g.arc(942,191,77,0,2*Math.PI);g.stroke();
      }
    }catch(_){/* título mantém a identidade sem imagem */}
    let y=top+Math.max(0,Math.floor((bottom-top-totalHeight)*.18));
    for(const group of groups){
      const sectionH=heightFor(group);
      g.shadowColor='rgba(23,65,77,.08)';g.shadowBlur=22;g.shadowOffsetY=6;
      posterRoundRect(g,54,y,972,sectionH,30,'#ffffff');
      g.shadowBlur=0;g.shadowOffsetY=0;
      posterRoundRect(g,74,y+22,12,48,6,group.accent);
      g.fillStyle='#17374a';g.font='800 30px Manrope, Arial, sans-serif';
      g.fillText(group.title,105,y+52,735);
      g.fillStyle='#6a7b83';g.font='500 19px Manrope, Arial, sans-serif';
      g.fillText(group.subtitle,106,y+82);
      posterRoundRect(g,930,y+27,69,47,17,group.tint);
      g.fillStyle=group.accent;g.font='800 27px Manrope, Arial, sans-serif';
      g.textAlign='center';g.fillText(String(group.items.length),965,y+59);g.textAlign='left';
      group.items.forEach((item,i)=>{
        const col=i%columns,row=Math.floor(i/columns);
        const px=79+col*(cardW+colGap),py=y+101+row*rowH;
        const compact=columns===3||rowH<118;
        const nameOffset=compact?75:99;
        const nameWidth=cardW-nameOffset-13;
        const pal=posterGenderColors(item);
        posterRoundRect(g,px,py,cardW,cardH,19,pal.background);
        const dateW=compact?48:67,dateH=compact?53:65;
        posterRoundRect(g,px+15,py+15,dateW,dateH,15,'#ffffff');
        g.fillStyle=pal.ink;g.font='800 '+(compact?26:34)+'px Manrope, Arial, sans-serif';
        g.textAlign='center';g.fillText(numDay(item.dia),px+15+dateW/2,py+(compact?49:60));g.textAlign='left';
        g.fillStyle=pal.ink;
        drawPosterName(g,item.nome,px+nameOffset,py+(compact?35:44),nameWidth,compact?51:64,compact?23:28);
        if(item.tipo!=='aniversario'){
          g.fillStyle='#667e8a';g.font='600 '+(compact?15:18)+'px Manrope, Arial, sans-serif';
          const detail=item.tipo==='batismo'
            ?(item.ano_referencia?'Batismo em '+item.ano_referencia:'Batismo')
            :(kinds[item.tipo]||'Data ministerial');
          g.fillText(detail,px+nameOffset,py+cardH-15,nameWidth);
        }
      });
      y+=sectionH+sectionGap;
    }
    const foot=height-118;
    g.fillStyle='#dbe9e4';g.fillRect(65,foot-45,950,2);
    g.fillStyle='#2a5560';g.font='800 25px Manrope, Arial, sans-serif';
    g.fillText('IGREJA NO JARDIM LEAL',65,foot);
    g.fillStyle='#738c90';g.font='500 19px Manrope, Arial, sans-serif';
    g.fillText('Participe, celebre e compartilhe o amor de Deus.',65,foot+38);
    g.textAlign='right';g.fillText('igrejanojardimleal.github.io',1015,foot+40);g.textAlign='left';
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível salvar a imagem.')),'image/png'));
    return blob;
  }
  const posterFilename=month=>'IGJAL-celebracoes-'+nameOfMonth(month).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()+'.png';
  function savePoster(blob,month){
    const address=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=address;a.download=posterFilename(month);
    document.body.append(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(address),30000);
  }
  async function posterAction(mode,month,button){
    if(button?.disabled)return;
    const original=button?.textContent;
    if(button){button.disabled=true;button.textContent='Preparando imagem...';}
    const message=$('celebracoes-poster-status');
    if(message)message.textContent='';
    try{
      const blob=await createMonthlyPoster(month);
      if(mode==='share'&&typeof navigator.share==='function'){
        const file=new File([blob],posterFilename(month),{type:'image/png'});
        if(typeof navigator.canShare!=='function'||navigator.canShare({files:[file]})){
          try{
            await navigator.share({files:[file],title:'Celebrações de '+nameOfMonth(month)+' — IGJAL',text:'Datas especiais da nossa igreja'});
            if(message)message.textContent='Imagem compartilhada.';
            return;
          }catch(error){
            if(error.name==='AbortError')return;
            // Em navegadores sem envio de arquivos, entrega o PNG para anexar no WhatsApp.
          }
        }
      }
      savePoster(blob,month);
      if(message)message.textContent='Cartaz PNG salvo. No WhatsApp, envie como foto pela galeria ou pelos arquivos.';
    }catch(err){
      if(message)message.textContent='Não foi possível gerar o cartaz: '+(err.message||'tente novamente.');
      console.warn('[IGJAL] Não foi possível gerar cartaz de celebrações:',err);
    }finally{
      if(button){button.disabled=false;button.textContent=original;}
    }
  }
  function updatePosterButtons(){
    const month=monthSelected();
    const available=posterGroups(month).some(group=>group.items.length);
    for(const id of ['celebracoes-compartilhar-cartaz','celebracoes-baixar-cartaz']){
      const button=$(id);
      if(button)button.disabled=!available;
    }
    const home=$('home-celebracoes-baixar-cartaz');
    if(home)home.disabled=!posterGroups(new Date().getMonth()+1).some(group=>group.items.length);
    const message=$('celebracoes-poster-status');
    if(message)message.textContent=available?'':'Sem datas publicadas e autorizadas neste mês para gerar o cartaz.';
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
    updatePosterButtons();
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
        copy.append(celebratoryName(item,true));
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
    updatePosterButtons();
  }
  async function load(){
    const db=ctx?.db?.();if(!db)return null;
    const {data,error}=await db.from('site_celebracoes')
      .select('id,nome,tipo,dia,mes,ano_referencia,genero_exibicao,foto_url,publicado,consentimento_confirmado,criado_em,origem_lista')
      .order('mes',{ascending:true}).order('dia',{ascending:true}).order('nome',{ascending:true});
    if(error){console.warn('Erro ao consultar aniversariantes:',error.message);return null;}
    return data||[];
  }
  function renderAdmin(){
    const section=$('celebration-admin-section');
    if(section)section.hidden=!canManage();
    const host=$('celebration-list');
    if(!host||!canManage())return;
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
        ' • '+(item.genero_exibicao==='masculino'?'Azul':item.genero_exibicao==='feminino'?'Rosa':'Sem cor definida')+
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
    if($('celebration-gender'))$('celebration-gender').value='nao_informado';
    editingId=null;
    if($('celebration-submit'))$('celebration-submit').textContent='Adicionar aniversariante';
    if($('celebration-cancel-edit'))$('celebration-cancel-edit').hidden=true;
    if($('celebration-form-mode'))$('celebration-form-mode').textContent='Novo registro';
  }
  function editItem(item){
    if(!canManage())return;
    editingId=item.id;
    $('celebration-name').value=item.nome;
    $('celebration-kind').value=item.tipo;
    $('celebration-day').value=item.dia;
    $('celebration-month').value=item.mes;
    $('celebration-year').value=item.ano_referencia??'';
    $('celebration-photo').value=item.foto_url||'';
    $('celebration-gender').value=item.genero_exibicao||'nao_informado';
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
    if(!canManage())return;
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
    if(!canManage()){status('Apenas o administrador geral ou o responsável pela Agenda e Avisos pode alterar aniversariantes.',true);return;}
    const nome=clean($('celebration-name').value),tipo=$('celebration-kind').value,
      dia=Number($('celebration-day').value),mes=Number($('celebration-month').value),
      yearText=$('celebration-year').value,
      ano_referencia=yearText?Number(yearText):null,
      genero_exibicao=$('celebration-gender').value,
      foto_url=clean($('celebration-photo').value)||null,
      publicado=$('celebration-published').checked,
      consent=$('celebration-consent').checked;
    if(!consent){status('Confirme a autorização de divulgação antes de salvar.',true);return;}
    if(nome.length<2||nome.length>100||!validDay(dia,mes)){status('Confira nome, dia e mês.',true);return;}
    if(!Object.hasOwn(kinds,tipo)){status('Tipo de comemoração inválido.',true);return;}
    if(!['masculino','feminino','nao_informado'].includes(genero_exibicao)){status('Selecione a identificação do cadastro.',true);return;}
    if(tipo==='aniversario'&&ano_referencia!==null){status('Para aniversário de nascimento, não informe o ano.',true);return;}
    if(ano_referencia!==null&&(!Number.isInteger(ano_referencia)||ano_referencia<1900||ano_referencia>new Date().getFullYear())){status('Confira o ano do batismo ou marco ministerial.',true);return;}
    if(!validPhoto(foto_url)){status('Use apenas URL HTTPS ou caminho assets/fotos/ da fotografia autorizada.',true);return;}
    const record={nome,tipo,dia,mes,ano_referencia,genero_exibicao,foto_url,publicado,consentimento_confirmado:true};
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
    $('celebracoes-compartilhar-cartaz')?.addEventListener('click',ev=>void posterAction('share',monthSelected(),ev.currentTarget));
    $('celebracoes-baixar-cartaz')?.addEventListener('click',ev=>void posterAction('download',monthSelected(),ev.currentTarget));
    $('home-celebracoes-baixar-cartaz')?.addEventListener('click',ev=>void posterAction('download',new Date().getMonth()+1,ev.currentTarget));
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