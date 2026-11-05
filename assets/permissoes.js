/* Delegação de responsabilidades na igreja.
 * Somente o administrador geral concede ou revoga. As regras são validadas no Supabase.
 * Histórico e Usuários e Acessos nunca são delegáveis. */
window.IGREJA_ACESSOS = (()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const ROLES=[
  {title:'Agenda e comunidade',items:[
   ['agenda','Agenda e Avisos / aniversariantes','pode_agenda'],
   ['mural','Moderação do Mural','pode_mural'],
   ['comentarios_hinos','Comentários dos Hinos','pode_comentarios_hinos']
  ]},
  {title:'Louvores e transmissão',items:[
   ['cifras','Conferir e publicar cifras em PDF','pode_cifras'],
   ['hinos','Editor do Hinário (letras e cifras)','pode_hinos'],
   ['midias','Mídias dos Hinos','pode_midias'],
   ['kits','Kits de Ensaios','pode_kits'],
   ['live','Transmissões ao Vivo','pode_live']
  ]},
  {title:'Ensino e conteúdo',items:[
   ['estudos','Professor — enviar estudos para revisão','pode_estudos'],
   ['revisor_estudos','Revisor Pastoral — aprovar estudos enviados','pode_revisar_estudos'],
   ['editor_estudos','Editor de Estudos — cadastrar/publicar estudos','pode_editor_estudos'],
   ['identidade','História e imagens institucionais (sem logo/contato)','pode_identidade']
  ]}
 ];
 const allRoles=ROLES.flatMap(g=>g.items);
 let ctx=null,rows=[],opened=new Set(),hinoUsers=new Set();
 const make=(tag,value,cls)=>{
   const el=document.createElement(tag);
   if(value!==undefined)el.textContent=String(value);
   if(cls)el.className=cls;
   return el;
 };
 const status=(s,error=false)=>{
   const p=$('admin-users-status');
   if(p){p.textContent=s;p.style.color=error?'#a63232':'';}
 };
 function show(){
   const tab=$('admin-tab-usuarios');
   if(tab)tab.hidden=!(ctx?.isAdmin?.()===true);
 }
 function render(){
  const list=$('admin-users-list');
  if(!list)return;
  list.replaceChildren();
  const filter=($('admin-users-search')?.value||'').toLowerCase().trim();
  const filtered=rows.filter(u=>[u.email,u.nome_completo].some(v=>String(v||'').toLowerCase().includes(filter)));
  if(!filtered.length){list.append(make('p','Nenhuma conta encontrada.','muted'));return;}
  for(const user of filtered){
   const card=make('article',undefined,'access-user access-user-v16');
   const heading=make('div',undefined,'access-user-heading');
   heading.append(make('strong',user.nome_completo||user.email,'access-email'));
   if(user.nome_completo)heading.append(make('p',user.email,'muted'));
   const registered=user.cadastrado_em?new Date(user.cadastrado_em).toLocaleDateString('pt-BR'):'—';
   heading.append(make('small','Cadastro: '+registered+' · '+(user.email_confirmado?'Conta habilitada':'Aguardando ativação'),'muted'));
   card.append(heading);
   const hinoReconhecido=hinoUsers.has(user.user_id);
   const botaoHino=make('button',(hinoReconhecido?'✓ Retirar selo: ':'+ Conceder selo: ')+'Colaborou com hino',
     hinoReconhecido?'btn btn-outline btn-sm access-role-button is-granted':'btn btn-outline btn-sm access-role-button');
   botaoHino.type='button';botaoHino.disabled=!user.email_confirmado;
   botaoHino.title=user.email_confirmado?'Reconhecimento pela colaboração com o hinário, sem conceder acesso de edição.':'A conta precisa estar ativada para receber o selo.';
   botaoHino.addEventListener('click',async()=>{
     if(ctx?.isAdmin?.()!==true||!ctx?.db?.())return;
     if(!window.confirm((hinoReconhecido?'Retirar':'Conceder')+' selo Colaborou com hino para '+(user.nome_completo||user.email)+'?'))return;
     botaoHino.disabled=true;
     const {error}=await ctx.db().rpc('igjal_admin_definir_hino',{p_usuario:user.user_id,p_conceder:!hinoReconhecido,p_observacao:'Contribuição no hinário reconhecida pela liderança'});
     if(error){status('Falha ao atualizar selo: '+error.message,true);botaoHino.disabled=false;return;}
     await refresh();status('Selo de colaboração com hino atualizado.');
   });
   card.append(botaoHino);
   if(user.administrador_geral){
    card.append(make('p','🛡️ Administrador Geral — todas as áreas autorizadas, conta protegida','access-role'));
   }else{
    const active=allRoles.filter(([, ,key])=>Boolean(user[key]));
    const details=make('details',undefined,'access-permissions-details');
    details.open=opened.has(user.user_id);
    const summary=make('summary',undefined,'access-permissions-summary');
    summary.append(make('span','Gerenciar permissões de '+(user.nome_completo||user.email)));
    summary.append(make('span',active.length+' de '+allRoles.length+' atribuídas','access-permissions-counter'));
    details.append(summary);
    details.addEventListener('toggle',()=>{
      if(details.open)opened.add(user.user_id);
      else opened.delete(user.user_id);
    });
    if(active.length){
      const label=make('p','Funções atuais: '+active.map(([area,label])=>label).join(' · '),'access-current-roles');
      card.append(label);
    }else card.append(make('p','Nenhuma permissão administrativa atribuída.','muted'));
    if(!user.email_confirmado)details.append(make('p','Esta conta precisa ser ativada antes de receber permissões.','muted'));
    for(const group of ROLES){
      const section=make('section',undefined,'access-role-section');
      section.append(make('h4',group.title));
      const actions=make('div',undefined,'access-role-grid');
      for(const [area,label,key] of group.items){
        const enabled=Boolean(user[key]);
        const button=make('button',(enabled?'✓ Retirar: ':'+ Conceder: ')+label,
          enabled?'btn btn-outline btn-sm access-role-button is-granted':'btn btn-outline btn-sm access-role-button');
        button.type='button';
        button.disabled=!user.email_confirmado;
        button.setAttribute('aria-pressed',String(enabled));
        if(!user.email_confirmado)button.title='A conta precisa estar ativada antes de receber acesso.';
        button.addEventListener('click',async()=>{
          if(ctx?.isAdmin?.()!==true||!ctx?.db?.())return;
          const verb=enabled?'Retirar':'Conceder';
          if(!window.confirm(verb+' acesso de '+user.email+' à função "'+label+'"?'))return;
          button.disabled=true;opened.add(user.user_id);
          const {data,error}=await ctx.db().rpc('admin_definir_permissao',{
            p_usuario:user.user_id,p_area:area,p_conceder:!enabled
          });
          if(error||data!==true){
            status('Não foi possível alterar: '+(error?.message||'resposta inválida'),true);
            button.disabled=false;return;
          }
          await refresh();
          status(verb==='Conceder'?'Permissão concedida para '+user.email+'.':'Permissão retirada de '+user.email+'.');
        });
        actions.append(button);
      }
      section.append(actions);details.append(section);
    }
    card.append(details);
   }
   list.append(card);
  }
 }
 async function refresh(){
  show();
  if(ctx?.isAdmin?.()!==true||!ctx?.db?.())return;
  status('Consultando usuários e suas permissões...');
  const [{data,error},{data:selos,error:erroSelos}]=await Promise.all([ctx.db().rpc('admin_listar_usuarios_v4'),ctx.db().rpc('igjal_admin_listar_hinos')]);
  if(error){status('Falha ao carregar permissões: '+error.message,true);return;}
  if(erroSelos){status('Falha ao carregar selos do hinário: '+erroSelos.message,true);return;}
  rows=data||[];hinoUsers=new Set(selos||[]);
  render();
  status(rows.length+' usuário(s) encontrados. Cada função dá acesso somente à área correspondente. Histórico e Usuários e Acessos são exclusivos do administrador geral.');
 }
 function init(context){
  ctx=context;show();
  $('admin-users-refresh')?.addEventListener('click',refresh);
  $('admin-users-search')?.addEventListener('input',render);
 }
 return {init,show,refresh};
})();