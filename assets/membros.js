/* Login e cadastro da comunidade: e-mail + senha, sem credenciais no repositório. */
window.IGREJA_MEMBROS = (() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let context;
  const redirect=()=>location.origin+location.pathname;
  const status=(message,error=false)=>{
    const el=$('member-auth-status');
    if(el){el.textContent=message;el.style.color=error?'#a42626':'';}
  };
  function switchMode(mode){
    document.querySelectorAll('[data-member-form]').forEach(form=>{form.hidden=form.dataset.memberForm!==mode;});
    document.querySelectorAll('[data-member-mode]').forEach(button=>{
      const active=button.dataset.memberMode===mode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }
  async function submit(fn,start,success){
    const db=context?.db?.();
    if(!db){status('O serviço de contas não carregou. Atualize a página e tente novamente.',true);return;}
    status(start);
    try{
      const {error,data}=await fn(db);
      if(error)throw error;
      status(typeof success==='function'?success(data):success);
    }catch(error){status('Não foi possível concluir: '+error.message,true);}
  }
  function refresh(){
    const user=context?.user?.();
    const link=$('member-admin-link');
    if(link)link.hidden=!user||!(context?.isAdmin?.()||context?.isEventManager?.()||context?.isMuralModerator?.());
    const form=$('member-password-change');
    if(form)form.hidden=!user;
    const expl=$('member-account-description');
    if(expl)expl.textContent=user?'Conta conectada. Você pode definir uma senha para os próximos acessos.':'Cadastre-se com seu e-mail e uma senha. Após confirmar o e-mail, você poderá participar do mural e dos hinos.';
  }
  function init(ctx){
    context=ctx;
    const box=$('logged-out-panel');
    if(!box)return;
    const oldForm=$('email-login-form');
    const loginModes=document.createElement('div');
    loginModes.className='member-account';
    loginModes.innerHTML=`
      <p id="member-account-description">Entre com senha ou cadastre-se para participar.</p>
      <div class="member-account-tabs" role="group" aria-label="Acesso da comunidade">
        <button class="btn btn-outline btn-sm active" type="button" data-member-mode="entrar" aria-pressed="true">Entrar com senha</button>
        <button class="btn btn-outline btn-sm" type="button" data-member-mode="cadastro" aria-pressed="false">Criar cadastro</button>
        <button class="btn btn-outline btn-sm" type="button" data-member-mode="recuperar" aria-pressed="false">Esqueci a senha</button>
      </div>
      <form id="member-password-login" data-member-form="entrar">
        <label for="member-login-email">E-mail</label><input id="member-login-email" type="email" autocomplete="email" required placeholder="seuemail@exemplo.com">
        <label for="member-login-password">Senha</label><input id="member-login-password" type="password" autocomplete="current-password" required minlength="8">
        <button class="btn btn-primary full-width" type="submit">Entrar na minha conta</button>
      </form>
      <form id="member-signup" data-member-form="cadastro" hidden>
        <label for="member-signup-email">E-mail</label><input id="member-signup-email" type="email" autocomplete="email" required>
        <label for="member-signup-password">Crie uma senha (mínimo 8 caracteres)</label>
        <input id="member-signup-password" type="password" autocomplete="new-password" required minlength="8">
        <label for="member-signup-password-confirm">Repita a senha</label>
        <input id="member-signup-password-confirm" type="password" autocomplete="new-password" required minlength="8">
        <button class="btn btn-primary full-width" type="submit">Cadastrar e confirmar e-mail</button>
        <small>A confirmação será enviada para seu e-mail. Apenas contas confirmadas poderão participar.</small>
      </form>
      <form id="member-recovery" data-member-form="recuperar" hidden>
        <label for="member-recovery-email">E-mail cadastrado</label><input id="member-recovery-email" type="email" autocomplete="email" required>
        <button class="btn btn-primary full-width" type="submit">Enviar recuperação de senha</button>
      </form>
      <p role="status" class="form-status" id="member-auth-status" aria-live="polite"></p>`;
    box.insertBefore(loginModes,oldForm);
    const details=document.createElement('details');
    details.className='member-magic-link';
    const summary=document.createElement('summary');
    summary.textContent='Prefiro receber um link por e-mail, sem senha';
    details.append(summary,oldForm);
    box.append(details);
    document.querySelectorAll('[data-member-mode]').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.memberMode)));
    $('member-password-login').addEventListener('submit',async event=>{
      event.preventDefault();
      const email=$('member-login-email').value.trim();
      const password=$('member-login-password').value;
      await submit(db=>db.auth.signInWithPassword({email,password}), 'Verificando seu acesso...',
        'Entrada confirmada. Bem-vindo(a)!');
      $('member-login-password').value='';
    });
    $('member-signup').addEventListener('submit',async event=>{
      event.preventDefault();
      const email=$('member-signup-email').value.trim();
      const password=$('member-signup-password').value;
      if(password!==$('member-signup-password-confirm').value){status('As senhas precisam ser iguais.',true);return;}
      await submit(db=>db.auth.signUp({email,password,options:{emailRedirectTo:redirect()}}),
        'Preparando seu cadastro...',
        'Confira seu e-mail e confirme o cadastro antes de entrar. Se a conta já existir, use Recuperar senha.');
      $('member-signup-password').value='';
      $('member-signup-password-confirm').value='';
    });
    $('member-recovery').addEventListener('submit',async event=>{
      event.preventDefault();
      const email=$('member-recovery-email').value.trim();
      await submit(db=>db.auth.resetPasswordForEmail(email,{redirectTo:redirect()}),
        'Enviando instruções...', 'Se houver uma conta para esse endereço, enviaremos as instruções de recuperação.');
    });
    const loggedIn=$('logged-in-panel');
    if(loggedIn){
      loggedIn.insertAdjacentHTML('beforeend',`
        <a class="btn btn-primary" href="administracao.html" id="member-admin-link" hidden>🛡️ Abrir painel administrativo</a>
        <form id="member-password-change" class="member-change-password">
          <label for="member-new-password">Definir ou alterar minha senha</label>
          <input type="password" id="member-new-password" autocomplete="new-password" minlength="8" required placeholder="Nova senha (mínimo 8 caracteres)">
          <button class="btn btn-outline" type="submit">Salvar minha senha</button>
          <p class="form-status" id="member-password-status" role="status"></p>
        </form>`);
      $('member-password-change').addEventListener('submit',async event=>{
        event.preventDefault();
        const password=$('member-new-password').value;
        const info=$('member-password-status');info.textContent='Atualizando senha...';
        const db=context.db();
        if(!db){info.textContent='Serviço indisponível.';return;}
        const {error}=await db.auth.updateUser({password});
        info.textContent=error?'Não foi possível definir a senha: '+error.message:'Senha salva. Da próxima vez, use “Entrar com senha”.';
        if(!error)$('member-new-password').value='';
      });
    }
    refresh();
  }
  return {init,refresh};
})();