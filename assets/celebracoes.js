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
  // Mostra apenas dados autorizados, agrupando pessoas pelo dia.
  function posterGenderColors(person){
    const gender=normalize(person.genero_exibicao);
    if(gender==='masculino')return {ink:'#2464b1',mark:'#79ade3'};
    if(gender==='feminino')return {ink:'#c84981',mark:'#e7a0bf'};
    return {ink:'#294b5a',mark:'#9cb5be'};
  }
  function posterDays(items){
    const days=[];
    for(const item of [...items].sort(sortDates)){
      let last=days[days.length-1];
      if(!last||Number(last.dia)!==Number(item.dia)){
        last={dia:Number(item.dia),items:[]};
        days.push(last);
      }
      last.items.push(item);
    }
    // Se uma única data tiver muitas pessoas, repete o dia na imagem seguinte.
    return days.flatMap(day=>{
      const chunks=[];
      for(let offset=0;offset<day.items.length;offset+=12){
        chunks.push({dia:day.dia,items:day.items.slice(offset,offset+12),continued:offset>0});
      }
      return chunks;
    });
  }
  const POSTER_PAGE_HEIGHT=1236;
  const posterDayHeight=day=>46+Math.ceil(day.items.length/2)*92;
  const posterSectionHeight=days=>92+days.reduce((sum,d)=>sum+posterDayHeight(d)+13,0);
  function posterPages(month){
    const active=posterGroups(month).filter(group=>group.items.length>0);
    const pages=[];
    let current={sections:[],used:0};
    const flush=()=>{
      if(current.sections.length)pages.push(current);
      current={sections:[],used:0};
    };
    for(const group of active){
      const allDays=posterDays(group.items);
      let selected=[],part=0;
      const addSection=()=>{
        if(!selected.length)return;
        const required=posterSectionHeight(selected)+(current.sections.length?22:0);
        if(current.sections.length&&current.used+required>POSTER_PAGE_HEIGHT)flush();
        current.sections.push({group,days:selected,continued:part>0});
        current.used+=posterSectionHeight(selected)+(current.sections.length>1?22:0);
        part++;selected=[];
      };
      for(const day of allDays){
        const required=posterSectionHeight([...selected,day]);
        if(required>POSTER_PAGE_HEIGHT){
          if(selected.length){addSection();flush();}
          if(posterSectionHeight([day])>POSTER_PAGE_HEIGHT)throw new Error('Não foi possível distribuir os aniversários desta data.');
        }
        const sectionGap=current.sections.length?22:0;
        if(selected.length && current.used+sectionGap+required>POSTER_PAGE_HEIGHT){
          addSection();flush();
        }else if(!selected.length&&current.sections.length&&
          current.used+sectionGap+posterSectionHeight([day])>POSTER_PAGE_HEIGHT){
          flush();
        }
        selected.push(day);
      }
      addSection();
    }
    flush();
    return pages;
  }
  function posterName(g,person,x,y,maxWidth,withDetail){
    const color=posterGenderColors(person);
    g.fillStyle=color.mark;g.beginPath();g.arc(x-14,y-9,5,0,Math.PI*2);g.fill();
    let font=29;
    g.font='800 '+font+'px Manrope, Arial, sans-serif';
    const words=clean(person.nome).split(' ').filter(Boolean);
    const lines=[];let line='';
    for(const word of words){
      const trial=line?line+' '+word:word;
      if(line&&g.measureText(trial).width>maxWidth){
        lines.push(line);line=word;
      }else line=trial;
    }
    if(line)lines.push(line);
    g.fillStyle=color.ink;
    if(lines.length>2)font=25;
    g.font='800 '+font+'px Manrope, Arial, sans-serif';
    if(lines.length<=2){
      for(let i=0;i<lines.length;i++)g.fillText(lines[i],x,y+i*29,maxWidth);
    }else{
      // Não omite sobrenomes: reduz proporcionalmente, em até duas linhas.
      const halfway=Math.ceil(words.length/2);
      g.fillText(words.slice(0,halfway).join(' '),x,y,maxWidth);
      g.fillText(words.slice(halfway).join(' '),x,y+29,maxWidth);
    }
    if(withDetail){
      const note=person.tipo==='batismo'
        ?(person.ano_referencia?'Batismo em '+person.ano_referencia:'Batismo')
        :(kinds[person.tipo]||'Data ministerial');
      g.font='600 18px Manrope, Arial, sans-serif';g.fillStyle='#6c838b';
      g.fillText(note,x,y+55,maxWidth);
    }
  }
  function posterLogo(){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src=new URL('assets/fotos/logo-igreja-oficial.png',location.href).href;
    });
  }
  async function createMonthlyPosterPage(month,page,pageNumber,totalPages,logo){
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920; // 9:16, sem cortes em Stories e Status.
    const g=canvas.getContext('2d');
    if(!g)throw new Error('O navegador não permite gerar imagens.');
    g.fillStyle='#f4f8f6';g.fillRect(0,0,1080,1920);
    const bg=g.createLinearGradient(0,0,1080,450);
    bg.addColorStop(0,'#0c3947');bg.addColorStop(.65,'#236677');bg.addColorStop(1,'#438777');
    g.fillStyle=bg;g.fillRect(0,0,1080,390);
    g.globalAlpha=.11;g.strokeStyle='#d2fff4';g.lineWidth=2;
    for(let i=0;i<5;i++){g.beginPath();g.arc(960,70,150+i*30,0,2*Math.PI);g.stroke();}
    g.globalAlpha=1;
    g.fillStyle='#cdece7';g.font='700 23px Manrope, Arial, sans-serif';
    g.fillText('IGJAL  /  OBRA DA RESTAURAÇÃO',64,79);
    g.fillStyle='#ffffff';g.font='800 77px Manrope, Arial, sans-serif';
    g.fillText('CELEBRAÇÕES',64,172);
    g.fillStyle='#edf7f4';g.font='600 56px Manrope, Arial, sans-serif';
    g.fillText(nameOfMonth(month),66,256);
    g.fillStyle='#c5e3dd';g.font='500 23px Manrope, Arial, sans-serif';
    g.fillText('Cada vida e cada caminhada são especiais.',67,321);
    if(logo){
      const cx=944,cy=190,radius=75;
      g.save();g.beginPath();g.arc(cx,cy,radius,0,Math.PI*2);g.clip();
      g.fillStyle='#fff';g.fillRect(cx-radius,cy-radius,radius*2,radius*2);
      const scale=Math.min(132/logo.width,132/logo.height);
      const w=logo.width*scale,h=logo.height*scale;
      g.drawImage(logo,cx-w/2,cy-h/2,w,h);g.restore();
      g.beginPath();g.arc(cx,cy,radius+2,0,Math.PI*2);g.strokeStyle='#a8dad2';g.lineWidth=4;g.stroke();
    }
    if(totalPages>1){
      posterRoundRect(g,826,334,185,35,17,'rgba(255,255,255,.18)');
      g.font='700 18px Manrope, Arial, sans-serif';g.textAlign='center';
      g.fillStyle='#ffffff';g.fillText('PARTE '+pageNumber+' DE '+totalPages,919,357);
      g.textAlign='left';
    }
    // Não invade o topo/rodapé reservados pelas interfaces do WhatsApp.
    let y=449+Math.min(92,Math.floor((POSTER_PAGE_HEIGHT-page.used)*.13));
    for(const section of page.sections){
      const h=posterSectionHeight(section.days);
      g.shadowColor='rgba(24,76,82,.09)';g.shadowBlur=24;g.shadowOffsetY=8;
      posterRoundRect(g,50,y,980,h,27,'#ffffff');g.shadowBlur=0;g.shadowOffsetY=0;
      posterRoundRect(g,75,y+24,11,43,5,section.group.accent);
      g.fillStyle='#193c4c';g.font='800 29px Manrope, Arial, sans-serif';
      const label=section.group.title+(section.continued?' (CONTINUAÇÃO)':'');
      g.fillText(label,108,y+53,760);
      g.font='500 18px Manrope, Arial, sans-serif';g.fillStyle='#6f848a';
      g.fillText(section.group.subtitle,108,y+80,750);
      posterRoundRect(g,938,y+27,66,44,16,section.group.tint);
      g.font='800 25px Manrope, Arial, sans-serif';g.fillStyle=section.group.accent;
      g.textAlign='center';g.fillText(String(section.days.reduce((n,day)=>n+day.items.length,0)),971,y+57);
      g.textAlign='left';
      let cy=y+92;
      for(const day of section.days){
        const dayH=posterDayHeight(day);
        posterRoundRect(g,75,cy,930,dayH,19,'#f6f9f8');
        posterRoundRect(g,93,cy+18,91,92,18,'#e3eeee');
        g.fillStyle='#24586a';g.font='800 42px Manrope, Arial, sans-serif';
        g.textAlign='center';g.fillText(numDay(day.dia),138,cy+68);
        g.font='700 16px Manrope, Arial, sans-serif';
        g.fillText(nameOfMonth(month).slice(0,3).toUpperCase(),138,cy+93);
        g.textAlign='left';
        if(day.continued){
          g.font='700 15px Manrope, Arial, sans-serif';g.fillStyle='#778e95';
          g.fillText('CONT.',96,cy+127,85);
        }
        day.items.forEach((person,i)=>{
          const col=i%2,row=Math.floor(i/2);
          const tx=232+col*370,ty=cy+52+row*92;
          posterName(g,person,tx,ty,340,person.tipo!=='aniversario');
        });
        cy+=dayH+13;
      }
      y+=h+22;
    }
    const footer=1787;
    g.fillStyle='#d2e3df';g.fillRect(63,footer-54,955,2);
    g.fillStyle='#285761';g.font='800 25px Manrope, Arial, sans-serif';
    g.fillText('IGREJA NO JARDIM LEAL',65,footer);
    g.fillStyle='#6b888c';g.font='500 21px Manrope, Arial, sans-serif';
    g.fillText('Que Deus abençoe cada vida e cada família!',65,footer+43);
    g.textAlign='right';g.font='600 17px Manrope, Arial, sans-serif';
    g.fillText('igrejanojardimleal.github.io',1015,footer+43);g.textAlign='left';
    return await new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(new Error('Não foi possível salvar o cartaz.')),'image/png'
    ));
  }
  async function createMonthlyPosters(month){
    const pages=posterPages(month);
    if(!pages.length)throw new Error('Não há datas publicadas e autorizadas para este mês.');
    try{await document.fonts?.ready;}catch(_){/* preserva fonte alternativa */}
    const logo=await posterLogo();
    const blobs=[];
    for(let n=0;n<pages.length;n++){
      blobs.push(await createMonthlyPosterPage(month,pages[n],n+1,pages.length,logo));
    }
    return blobs;
  }
  function posterFilename(month,index,total){
    const slug=nameOfMonth(month).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return 'IGJAL-celebracoes-'+slug+(total>1?'-parte-'+index:'')+'.png';
  }
  function savePoster(blob,month,index,total){
    const address=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=address;anchor.download=posterFilename(month,index,total);
    document.body.append(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(address),30000);
  }
  async function posterAction(mode,month,button){
    if(button?.disabled)return;
    const original=button?.textContent;
    if(button){button.disabled=true;button.textContent='Preparando cartaz...';}
    const message=$('celebracoes-poster-status');
    if(message)message.textContent='';
    try{
      const blobs=await createMonthlyPosters(month);
      const files=blobs.map((blob,i)=>new File([blob],posterFilename(month,i+1,blobs.length),{type:'image/png'}));
      if(mode==='share'&&typeof navigator.share==='function'){
        if(typeof navigator.canShare!=='function'||navigator.canShare({files})){
          try{
            await navigator.share({
              files,
              title:'Celebrações de '+nameOfMonth(month)+' — IGJAL',
              text:'Datas especiais da nossa igreja'
            });
            if(message)message.textContent=blobs.length>1?'Cartazes compartilhados.':'Cartaz compartilhado.';
            return;
          }catch(err){
            if(err.name==='AbortError')return;
          }
        }
      }
      blobs.forEach((blob,i)=>savePoster(blob,month,i+1,blobs.length));
      const notice=blobs.length>1
        ?'Foram gerados '+blobs.length+' cartazes 9:16 numerados. Se o navegador pedir, permita vários downloads para receber todas as partes.'
        :'Cartaz PNG 9:16 salvo. Envie como foto no WhatsApp ou publique no Status.';
      if(message)message.textContent=notice;
    }catch(err){
      if(message)message.textContent='Não foi possível gerar a imagem: '+(err.message||'tente novamente.');
      console.warn('[IGJAL] Erro ao gerar celebrações:',err);
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