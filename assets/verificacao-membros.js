/* Verificação manual de membros da IGJAL. O servidor valida todas as permissões. */
window.IGREJA_VERIFICACOES=(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  let ctx=null,rows=[];
  function make(tag,text,className){
    const e=document.createElement(tag);
    if(text!==undefined&&text!==null)e.textContent=String(text);
    if(className)e.className=className;
    return e;
  }
  function status(message,error=false){
    const n=$('igjal-verificacoes-status');
    if(n){n.textContent=message;n.style.color=error?'#a63232':'';}
  }
  function render(){
    const target=$('igjal-verificacoes-list');
    if(!target)return;
    target.replaceChildren();
    const q=($('igjal-verificacoes-search')?.value||'').trim().toLowerCase();
    const matches=rows.filter(r=>[r.nome,r.email].some(s=>String(s||'').toLowerCase().includes(q)));
    if(!matches.length){target.append(make('p','Nenhum cadastro encontrado.','muted'));return;}
    for(const member of matches){
      const panel=make('article',null,'access-user access-user-v16');
      const info=make('div',null,'access-user-heading');
      info.append(make('strong',member.nome||'Sem nome','access-email'));
      info.append(make('p',member.email||'Sem e-mail','muted'));
      if(member.telefone)info.append(make('small','Telefone privado: '+member.telefone,'muted'));
      const verified=make('p',member.verificado?'✓ Identidade verificada pela igreja':'Ainda sem selo de verificação','access-current-roles');
      panel.append(info,verified);
      const controls=make('div',null,'access-role-grid');
      const btn=make('button',member.verificado?'Retirar selo azul':'✓ Verificar membro',
        member.verificado?'btn btn-outline btn-sm access-role-button is-granted':'btn btn-outline btn-sm access-role-button');
      btn.type='button';
      btn.disabled=member.user_id===ctx?.user?.()?.id && !ctx?.isAdmin?.();
      btn.addEventListener('click',async()=>{
        if(!ctx?.canVerify?.()||!ctx?.db?.())return;
        const msg=member.verificado
          ? 'Retirar o selo verificado de '+(member.nome||member.email)+'?'
          : 'Você identificou este membro pessoalmente ou confirmou o contato por um meio confiável? Conceder o selo azul para '+(member.nome||member.email)+'?';
        if(!window.confirm(msg))return;
        btn.disabled=true;
        try{
          const {data,error}=await ctx.db().rpc('igjal_definir_verificacao',{
            p_usuario:member.user_id,p_conceder:!member.verificado
          });
          if(error||data!==true)throw error||new Error('Resposta inválida');
          await refresh();
          status('Verificação atualizada para '+(member.nome||member.email)+'.');
        }catch(e){status('Não foi possível alterar a verificação: '+e.message,true);btn.disabled=false;}
      });
      controls.append(btn);
      if(ctx?.isAdmin?.()===true && !member.administrador){
        const role=make('button',member.verificador?'Revogar permissão de verificação':'Delegar verificação',
          member.verificador?'btn btn-outline btn-sm access-role-button is-granted':'btn btn-outline btn-sm access-role-button');
        role.type='button';
        role.addEventListener('click',async()=>{
          if(!window.confirm((member.verificador?'Revogar':'Delegar')+' a função de verificar membros para '+(member.nome||member.email)+'? A função não concede administração geral.'))return;
          role.disabled=true;
          try{
            const {data,error}=await ctx.db().rpc('igjal_definir_verificador',{
              p_usuario:member.user_id,p_conceder:!member.verificador
            });
            if(error||data!==true)throw error||new Error('Resposta inválida');
            await refresh();
            status('Permissão de verificação atualizada.');
          }catch(e){status('Não foi possível alterar a delegação: '+e.message,true);role.disabled=false;}
        });
        controls.append(role);
      }
      panel.append(controls);target.append(panel);
    }
  }
  async function refresh(){
    if(!ctx?.canVerify?.()||!ctx?.db?.())return;
    status('Consultando cadastros...');
    const {data,error}=await ctx.db().rpc('igjal_listar_membros_verificacao');
    if(error){status('Não foi possível consultar a lista: '+error.message,true);return;}
    rows=data||[];
    render();
    status(rows.length+' cadastro(s). Os dados de contato são privados e exclusivos desta área autorizada.');
  }
  function init(context){
    ctx=context;
    $('igjal-verificacoes-search')?.addEventListener('input',render);
    $('igjal-verificacoes-refresh')?.addEventListener('click',()=>void refresh());
  }
  return {init,refresh};
})();