/* Permissões da igreja: consulta e alteração somente por administrador geral.
   O frontend não concede poderes: cada operação é autorizada e auditada no PostgreSQL. */
window.IGREJA_ACESSOS = (()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 let ctx,rows=[];
 const status=(s,error=false)=>{
   const p=$('admin-users-status');if(!p)return;
   p.textContent=s;p.style.color=error?'#a63232':'';
 };
 const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 function show(){
   const tab=$('admin-tab-usuarios');
   if(tab)tab.hidden=!(ctx?.isAdmin?.());
 }
 function render(){
  const list=$('admin-users-list');if(!list)return;
  list.replaceChildren();
  const filter=($('admin-users-search')?.value||'').toLowerCase().trim();
  const filtered=rows.filter(u=>[u.email,u.nome_completo].some(v=>String(v||'').toLowerCase().includes(filter)));
  if(!filtered.length){list.append(make('p','Nenhuma conta encontrada.','muted'));return;}
  for(const user of filtered){
   const card=make('article',undefined,'access-user');
   card.append(make('strong',user.nome_completo||user.email,'access-email'));
   if(user.nome_completo)card.append(make('p',user.email,'muted'));
   const details=make('p','Cadastro: '+new Date(user.cadastrado_em).toLocaleDateString('pt-BR')+
     ' · '+(user.email_confirmado?'E-mail confirmado':'Aguardando confirmação'),'muted');
   card.append(details);
   if(user.administrador_geral){
    card.append(make('p','🛡️ Administrador Geral — acesso integral e protegido','access-role'));
   }else{
    const actions=make('div',undefined,'access-actions');
    for(const [area,label,key] of [['agenda','Agenda e avisos','pode_agenda'],['mural','Moderador do mural','pode_mural'],['estudos','Professor: enviar estudos','pode_estudos'],['revisor_estudos','Revisor pastoral: editar e aprovar estudos','pode_revisar_estudos']]){
      const enabled=Boolean(user[key]);
      const button=make('button',(enabled?'✓ Retirar ':'+ Conceder ')+label,enabled?'btn btn-outline btn-sm':'btn btn-primary btn-sm');
      button.type='button';button.disabled=!user.email_confirmado;
      if(!user.email_confirmado)button.title='A pessoa precisa confirmar o e-mail antes de receber acesso.';
      button.addEventListener('click',async()=>{
        if(!ctx?.isAdmin?.())return;
        const verb=enabled?'Retirar':'Conceder';
        if(!window.confirm(verb+' acesso a '+label+' para '+user.email+'?'))return;
        button.disabled=true;
        const {data,error}=await ctx.db().rpc('admin_definir_permissao',{
          p_usuario:user.user_id,p_area:area,p_conceder:!enabled
        });
        if(error||data!==true){
          status('Não foi possível alterar permissão: '+(error?.message||'resposta inválida'),true);
          button.disabled=false;return;
        }
        status('Acesso atualizado para '+user.email+'.');
        await refresh();
      });
      actions.append(button);
    }
    card.append(actions);
   }
   list.append(card);
  }
 }
 async function refresh(){
  show();
  if(!ctx?.isAdmin?.()||!ctx?.db?.())return;
  status('Consultando contas cadastradas...');
  const {data,error}=await ctx.db().rpc('admin_listar_usuarios_v3');
  if(error){status('Não foi possível carregar as contas: '+error.message,true);return;}
  rows=data||[];
  render();
  status(rows.length+' usuário(s) encontrado(s). As contas precisam confirmar o e-mail antes de receber acesso.');
 }
 function init(context){
  ctx=context;show();
  $('admin-users-refresh')?.addEventListener('click',refresh);
  $('admin-users-search')?.addEventListener('input',render);
 }
 return {init,show,refresh};
})();