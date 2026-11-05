/* IGJAL · Página Minha Conta. Os pontos e selos são sempre consultados no servidor. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const nf=n=>Math.max(0,Number(n)||0).toLocaleString('pt-BR');
  const text=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
  const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
  const LEVELS=[
    {level:1,name:'Semente',symbol:'🌱',min:0,max:24,desc:'Todo começo tem seu valor. Seu primeiro passo é conhecer e participar da comunidade.'},
    {level:2,name:'Participante',symbol:'🌿',min:25,max:74,desc:'Você começou a explorar o hinário, as mensagens e os recursos da igreja.'},
    {level:3,name:'Colaborador',symbol:'🤝',min:75,max:174,desc:'Sua presença e contribuições começam a construir algo útil para os irmãos.'},
    {level:4,name:'Cooperador',symbol:'📖',min:175,max:349,desc:'Uma caminhada de participação constante, com colaboração e aprendizado.'},
    {level:5,name:'Contribuidor',symbol:'✨',min:350,max:1499,desc:'Você já reuniu muitas contribuições importantes para a plataforma.'},
    {level:6,name:'Contribuidor Experiente',symbol:'🏅',min:1500,max:10000,desc:'Um histórico de participação acumulada e ajuda à comunidade.'},
    {level:7,name:'Legado de Contribuição',symbol:'💎',min:10001,max:null,desc:'Uma longa trajetória de colaboração registrada na plataforma. É reconhecimento digital, não posição espiritual.'}
  ];
  const BADGES=[
    {id:'cadastro',emoji:'👤',name:'Conta cadastrada',desc:'Seu primeiro selo por fazer parte da comunidade.',how:'Crie uma conta no portal.'},
    {id:'verificado',emoji:'✔️',name:'Membro verificado',desc:'A liderança confirmou manualmente este cadastro.',how:'Aguardar a verificação da liderança da igreja.'},
    {id:'colaborou_cifra',emoji:'🎼',name:'Colaborou com cifra',desc:'Uma cifra enviada foi aprovada pela equipe.',how:'Falta 1 cifra enviada e aprovada pela equipe da igreja.'},
    {id:'colaborou_hino',emoji:'🎵',name:'Colaborou com letra/hino',desc:'Contribuição ao hinário reconhecida pela administração.',how:'Falta ter uma colaboração com letra ou hino reconhecida pela administração.'},
    {id:'colaborou_estudo',emoji:'📖',name:'Colaborou com estudo',desc:'Um estudo bíblico enviado foi aprovado.',how:'Falta 1 estudo bíblico enviado e aprovado pela liderança.'},
    {id:'membro_ativo',emoji:'🌿',name:'Membro ativo',desc:'Pelo menos 30 pontos conquistados nos últimos 30 dias.',how:'Conquiste 30 pontos dentro dos últimos 30 dias.'}
  ];
  const REWARDS=[
    ['👤','Criar cadastro',10,'Uma vez, ao criar a conta.'],
    ['🪪','Completar nome e sobrenome',5,'Uma vez, com os dados completos.'],
    ['♡','Curtir mensagem do mural',1,'Uma vez por mensagem; até 10 curtidas pontuadas por dia.'],
    ['▶','Abrir vídeo pelo portal',1,'Até 3 vídeos diferentes por dia. Abrir o vídeo não comprova que foi assistido inteiro.'],
    ['📄','Baixar hino ou cifra',1,'Uma vez por hino a cada dia; até 5 hinos diferentes por dia.'],
    ['💌','Compartilhar a Caixinha de Promessas',1,'Uma vez por período de promessa; até 2 por dia.'],
    ['💬','Comentário aprovado no hino',5,'Pontua após aprovação. Limite de 10 comentários por dia, somando hinos e Mural.'],
    ['🤍','Mensagem aprovada no Mural',10,'Pontua após aprovação. Limite de 10 comentários por dia, somando hinos e Mural.'],
    ['🎼','Cifra aprovada',30,'Depois de conferida e aprovada pela equipe.'],
    ['📖','Estudo bíblico aprovado',60,'Depois de conferido e aprovado pela liderança.'],
    ['🎵','Hino registrado e aprovado',30,'Depois de registrado e reconhecido pela liderança; um crédito por hino.']
  ];
  let db=null,user=null,progress=null;
  let rankingLoadedAt=0,rankingLoading=false;

  function nameParts(u){
    const meta=u?.user_metadata||{};
    const fullname=clean(meta.full_name);
    const parts=fullname.split(' ');
    return {
      first:clean(meta.first_name)||parts[0]||'',
      last:clean(meta.last_name)||(parts.length>1?parts.slice(1).join(' '):'')
    };
  }
  function normalizePhone(value){
    const digits=String(value||'').replace(/\D/g,'');
    const number=digits.startsWith('55')&&[12,13].includes(digits.length)?digits.slice(2):digits;
    return /^[1-9]{2}[2-9]\d{7,8}$/.test(number)?'+55'+number:'';
  }
  function displayPhone(raw){
    const phone=normalizePhone(raw);if(!phone)return '';
    const number=phone.slice(3);
    return '('+number.slice(0,2)+') '+(number.length===11?number.slice(2,7)+'-'+number.slice(7):number.slice(2,6)+'-'+number.slice(6));
  }
  function setStatus(id,message,error=false){
    const el=$(id);if(!el)return;
    el.textContent=message||'';
    el.classList.toggle('error',error);
  }
  function bar(id,fill,percent){
    const wrapper=$(id),child=$(fill);
    if(!wrapper||!child)return;
    const p=Math.max(0,Math.min(100,Number(percent)||0));
    child.style.width=p+'%';
    wrapper.setAttribute('aria-valuenow',String(Math.round(p)));
  }

  function renderRankingList(listId,results,me){
    const list=$(listId);if(!list)return;
    list.replaceChildren();
    const top5=Array.isArray(results)?results.slice(0,5):[];
    if(!top5.length){
      const empty=document.createElement('li');
      empty.className='ranking-placeholder';
      empty.textContent='Ainda não há pontos registrados neste período.';
      list.append(empty);
    }
    const renderItem=(entry,pessoal=false)=>{
      const row=document.createElement('li');
      row.className='ranking-item'+(entry.eu?' is-me':'')+(pessoal?' ranking-my-position':'');
      const pos=document.createElement('span');
      pos.className='ranking-place';
      pos.textContent=String(Number(entry.posicao)||'—');
      pos.setAttribute('aria-label',String(entry.posicao||'')+'ª posição');
      const name=document.createElement('span');
      name.className='ranking-person';
      name.textContent=String(entry.nome||'Membro').slice(0,40);
      if(entry.eu){
        const you=document.createElement('small');
        you.className='ranking-me-mark';
        you.textContent='Você';
        name.append(you);
      }
      const score=document.createElement('span');
      score.className='ranking-score';
      score.textContent=nf(entry.pontos)+' ';
      const unit=document.createElement('small');unit.textContent='pts';
      score.append(unit);
      row.append(pos,name,score);
      list.append(row);
    };
    top5.forEach(entry=>renderItem(entry));
    const meuLugar=Number(me?.posicao);
    if(Number.isInteger(meuLugar)&&meuLugar>5 && !top5.some(entry=>entry.eu===true)){
      const divider=document.createElement('li');
      divider.className='ranking-self-separator';
      divider.textContent='Sua posição';
      list.append(divider);
      renderItem(me,true);
    }
  }
  async function refreshRanking(force=false){
    if(!db||!user||rankingLoading)return;
    if(!force && rankingLoadedAt && Date.now()-rankingLoadedAt<60000)return;
    rankingLoading=true;
    const button=$('ranking-refresh');
    if(button)button.disabled=true;
    text('ranking-status','Consultando os pontos da comunidade...');
    try{
      const {data,error}=await db.rpc('igjal_top5_comunidade');
      if(error)throw error;
      if(!data||typeof data!=='object')throw new Error('Resultado indisponível');
      renderRankingList('ranking-week',data.semana,data.eu_semana);
      renderRankingList('ranking-month',data.mes,data.eu_mes);
      renderRankingList('ranking-all',data.geral,data.eu_geral);
      rankingLoadedAt=Date.now();
      text('ranking-status','Classificações atualizadas com pontos registrados no portal.');
    }catch(error){
      text('ranking-status','Não foi possível carregar o Top 5 agora. Tente atualizar novamente.');
      console.warn('[IGJAL] Top 5 temporariamente indisponível:',error.message);
    }finally{
      rankingLoading=false;
      if(button)button.disabled=false;
    }
  }
  function setTab(name,changeHash=true){
    const selected=['progresso','niveis','ranking','configuracoes'].includes(name)?name:'progresso';
    document.querySelectorAll('[data-account-tab]').forEach(btn=>{
      const chosen=btn.dataset.accountTab===selected;
      btn.setAttribute('aria-selected',String(chosen));
      btn.tabIndex=chosen?0:-1;
    });
    document.querySelectorAll('[data-account-panel]').forEach(panel=>{
      panel.hidden=panel.dataset.accountPanel!==selected;
    });
    if(changeHash){
      const hash='#'+selected;
      if(location.hash!==hash)history.replaceState(null,'',hash);
    }
    if(selected==='ranking'&&user)void refreshRanking();
  }
  function renderLevels(total,current){
    const target=$('all-levels');target.replaceChildren();
    LEVELS.forEach(lvl=>{
      const item=document.createElement('details');
      item.className='level-item'+(lvl.level===current?' current':lvl.level<current?' earned':'');
      item.open=lvl.level===current;
      const summary=document.createElement('summary');
      const symbol=document.createElement('span');
      symbol.className='level-icon';symbol.textContent=lvl.symbol;
      const info=document.createElement('span');info.className='level-summary';
      const name=document.createElement('strong');name.textContent='Nível '+lvl.level+' — '+lvl.name;
      const required=document.createElement('small');
      required.textContent=lvl.max===null?nf(lvl.min)+' pontos ou mais':nf(lvl.min)+' a '+nf(lvl.max)+' pontos';
      const state=document.createElement('span');
      state.className='label-state'+(total<lvl.min?' locked':'');
      state.textContent=lvl.level===current?'◆ Seu nível atual':total>=lvl.min?'✓ Conquistado':'Faltam '+nf(lvl.min-total)+' pontos';
      info.append(name,required,state);
      summary.append(symbol,info);
      const detail=document.createElement('p');detail.className='level-details';detail.textContent=lvl.desc;
      item.append(summary,detail);target.append(item);
    });
  }
  function renderBadges(data,recent){
    const all=$('all-badges'),earned=$('earned-badges');
    all.replaceChildren();earned.replaceChildren();
    for(const badge of BADGES){
      const won=badge.id==='cadastro'||data[badge.id]===true;
      if(won){
        const chip=document.createElement('span');
        chip.className='badge-pill';
        chip.title=badge.desc;
        const ico=document.createElement('span');ico.className='icon';ico.textContent=badge.emoji;
        chip.append(ico,document.createTextNode(badge.name));
        earned.append(chip);
      }
      const card=document.createElement('article');
      card.className='badge-tile'+(won?' unlocked':'');
      const emoji=document.createElement('div');emoji.className='badge-emoji';emoji.textContent=badge.emoji;
      const copy=document.createElement('div');
      const title=document.createElement('strong');title.textContent=badge.name;
      const description=document.createElement('p');description.textContent=won?badge.desc:badge.how;
      const status=document.createElement('small');status.className='badge-status';
      if(won)status.textContent='✓ Conquistado';
      else if(badge.id==='membro_ativo')status.textContent='Faltam '+nf(Math.max(0,30-recent))+' pontos nos últimos 30 dias';
      else if(badge.id==='verificado')status.textContent='Aguardando a liderança';
      else status.textContent='Ainda não conquistado';
      copy.append(title,description,status);card.append(emoji,copy);all.append(card);
    }
  }
  function renderRewards(){
    const target=$('how-to-points');target.replaceChildren();
    for(const [emoji,title,points,description] of REWARDS){
      const row=document.createElement('div');row.className='point-row';
      const ico=document.createElement('div');ico.className='point-icon';ico.textContent=emoji;
      const info=document.createElement('div');
      const strong=document.createElement('strong');strong.textContent=title;
      const small=document.createElement('small');small.textContent=description;
      info.append(strong,small);
      const value=document.createElement('span');value.className='point-value';value.textContent='+'+points+' pt'+(points===1?'':'s');
      row.append(ico,info,value);target.append(row);
    }
  }
  function renderProgress(data){
    progress=data;
    const total=Math.max(0,Number(data.total)||0);
    const recent=Math.max(0,Number(data.ultimos30)||0);
    const current=Math.min(7,Math.max(1,Number(data.nivel)||1));
    const currentLevel=LEVELS[current-1];
    const next=LEVELS[current];
    const ceiling=next?.min??null;
    const spent=Math.max(0,total-currentLevel.min);
    const required=ceiling===null?0:ceiling-currentLevel.min;
    const percent=ceiling===null?100:Math.min(100,spent/required*100);
    text('account-level-name','Nível '+current+' — '+currentLevel.name);
    text('account-level-icon',currentLevel.symbol);
    text('account-total-points',nf(total)+' pontos acumulados');
    text('account-xp-current',ceiling===null?'Nível máximo':nf(spent)+' / '+nf(required)+' XP no nível');
    text('account-xp-to-next',ceiling===null?'Legado conquistado':'Faltam '+nf(Math.max(0,ceiling-total))+' pontos');
    bar('account-xp-progress','account-xp-fill',percent);
    text('stat-total',nf(total));
    text('stat-next',next?'Nível '+next.level:'Nível máximo');
    text('stat-30',nf(recent));
    bar('active-progress','active-fill',Math.min(100,recent/30*100));
    $('active-progress').setAttribute('aria-valuenow',String(Math.min(30,recent)));
    text('active-remaining',recent>=30?'✓ Selo Membro ativo conquistado. Ele acompanha os pontos dos últimos 30 dias.':'Faltam '+nf(30-recent)+' pontos nos últimos 30 dias');
    text('active-description',recent>=30?'Você conquistou o selo de participação recente.':'Ganhe 30 pontos nos últimos 30 dias para conquistar o selo Membro ativo.');
    renderLevels(total,current);
    renderBadges(data,recent);
  }
  function fillSettings(u){
    const parts=nameParts(u);
    text('account-first-name',parts.first||'membro');
    $('profile-first').value=parts.first;
    $('profile-last').value=parts.last;
    $('profile-email').value=u.email||'';
    $('profile-phone').value=displayPhone(u.user_metadata?.telefone_contato);
  }
  async function saveProfile(event){
    event.preventDefault();
    if(!db||!user)return;
    const first=clean($('profile-first').value),last=clean($('profile-last').value);
    const full=clean(first+' '+last);
    const provided=clean($('profile-phone').value);
    const phone=provided?normalizePhone(provided):'';
    if(!first||!last||full.length>60){setStatus('profile-status','Informe nome e sobrenome válidos, com até 60 caracteres no total.',true);return;}
    if(provided&&!phone){setStatus('profile-status','Informe um telefone válido com DDD ou deixe o campo vazio.',true);return;}
    const submit=event.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
    setStatus('profile-status','Salvando...');
    try{
      const {data,error}=await db.auth.updateUser({data:{first_name:first,last_name:last,full_name:full,telefone_contato:phone}});
      if(error)throw error;
      if(data?.user)user=data.user;
      fillSettings(user);
      setStatus('profile-status','✓ Seus dados foram atualizados.');
    }catch(err){setStatus('profile-status','Não foi possível salvar: '+err.message,true);}
    finally{submit.disabled=false;}
  }
  async function savePassword(event){
    event.preventDefault();
    if(!db||!user)return;
    const newPassword=$('new-password').value;
    if(newPassword.length<8){setStatus('password-status','A senha precisa ter pelo menos 8 caracteres.',true);return;}
    if(newPassword!==$('confirm-password').value){setStatus('password-status','As senhas precisam ser iguais.',true);return;}
    const btn=event.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;
    setStatus('password-status','Atualizando senha...');
    try{
      const {error}=await db.auth.updateUser({password:newPassword});
      if(error)throw error;
      $('new-password').value='';$('confirm-password').value='';
      setStatus('password-status','✓ Senha atualizada.');
    }catch(err){setStatus('password-status','Não foi possível alterar a senha: '+err.message,true);}
    finally{btn.disabled=false;}
  }
  async function maybeEnableAdmin(){
    const link=$('account-admin-link'),topLink=$('account-admin-top-link');
    if((!link&&!topLink)||!db||!user)return;
    // A mesma matriz de permissões do portal: administrador geral ou responsável por alguma área.
    const roles=[
      db.rpc('is_site_admin'),db.rpc('igjal_pode_verificar'),
      db.rpc('can_manage_events'),db.rpc('can_moderate_mural'),
      db.rpc('can_review_studies'),
      ...['cifras','hinos','midias','kits','live','identidade','editor_estudos','comentarios_hinos']
        .map(p_area=>db.rpc('can_manage_area',{p_area}))
    ];
    try{
      const responses=await Promise.all(roles);
      const autorizado=responses.some(result=>!result.error&&result.data===true);
      if(user){if(link)link.hidden=!autorizado;if(topLink)topLink.hidden=!autorizado;}
    }catch(error){
      if(link)link.hidden=true;
      if(topLink)topLink.hidden=true;
      console.warn('[IGJAL] Não foi possível conferir o acesso ao painel:',error.message);
    }
  }
  async function initialize(){
    renderRewards();
    document.querySelectorAll('[data-account-tab]').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.accountTab)));
    $('view-achievements').addEventListener('click',()=>{setTab('niveis');document.querySelector('.account-tabs')?.scrollIntoView({behavior:'smooth',block:'start'});});
    $('ranking-refresh')?.addEventListener('click',()=>void refreshRanking(true));
    $('account-profile-form').addEventListener('submit',saveProfile);
    $('account-password-form').addEventListener('submit',savePassword);
    window.addEventListener('hashchange',()=>setTab(location.hash.slice(1),false));
    $('account-signout').addEventListener('click',async()=>{
      const button=$('account-signout');button.disabled=true;
      try{const {error}=await db.auth.signOut();if(error)throw error;location.href='index.html';}
      catch(err){button.disabled=false;window.alert('Não foi possível sair: '+err.message);}
    });
    const cfg=window.IGREJA_CONFIG?.supabase;
    if(!cfg?.url||!cfg?.anonKey||!window.supabase?.createClient){
      text('account-loading','O serviço de contas está indisponível. Atualize a página ou volte ao portal.');
      return;
    }
    db=window.supabase.createClient(cfg.url,cfg.anonKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    try{
      const {data,error}=await db.auth.getUser();
      if(error||!data?.user){
        $('account-loading').hidden=true;
        $('account-login-needed').hidden=false;
        return;
      }
      user=data.user;
      fillSettings(user);
      // Acesso a dados, senha e área administrativa não depende da disponibilidade do placar.
      $('account-main').hidden=false;
      $('account-signout').hidden=false;
      $('account-loading').hidden=true;
      setTab(location.hash.slice(1),false);
      void maybeEnableAdmin();
      try{
        const {data:stats,error:progressError}=await db.rpc('igjal_meu_progresso');
        if(progressError)throw progressError;
        if(!stats||typeof stats!=='object')throw new Error('Resposta de progresso indisponível');
        renderProgress(stats);
      }catch(progressError){
        console.warn('[IGJAL] Pontuação indisponível:',progressError.message);
        text('account-level-name','Progresso temporariamente indisponível');
        text('account-total-points','Seus dados e configurações continuam acessíveis.');
        text('account-xp-current','—');
        text('account-xp-to-next','');
        ['stat-total','stat-next','stat-30','active-remaining'].forEach(id=>text(id,'—'));
        text('active-description','Não foi possível consultar os pontos agora. Tente atualizar a página.');
        const levels=$('all-levels');
        if(levels)levels.textContent='Níveis indisponíveis no momento; suas contribuições continuam registradas.';
      }
      db.auth.onAuthStateChange(event=>{
        if(event==='SIGNED_OUT'){
          $('account-main').hidden=true;
          $('account-login-needed').hidden=false;
          $('account-signout').hidden=true;
        }
      });
    }catch(err){
      text('account-loading','Não foi possível carregar sua conta. Atualize a página para tentar novamente.');
      console.warn('[IGJAL] Falha na página Minha Conta:',err.message);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void initialize(),{once:true});
  else void initialize();
})();