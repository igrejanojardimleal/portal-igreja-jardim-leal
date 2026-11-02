/* IGJAL: destaca somente lives comprovadamente ativas. */
(()=>{
"use strict";
const host=document.getElementById("live-spotlight");
if(!host)return;
const good=id=>/^[a-zA-Z0-9_-]{11}$/.test(String(id||""));
function add(p,tag,cls,label){const el=document.createElement(tag);if(cls)el.className=cls;if(label)el.textContent=label;p.appendChild(el);return el;}
function display(data){
 const age=Date.now()-Date.parse(data?.checked_at||"");
 const current=data?.live;
 if(!Number.isFinite(age)||age< -300000||age>50*60000||!current||!good(current.id)){
  host.hidden=true;host.replaceChildren();return;
 }
 const id=String(current.id), title=String(current.title||"Culto ao vivo da igreja").slice(0,180);
 host.replaceChildren();
 const box=add(host,"section","igjal-live-card");
 const info=add(box,"div","igjal-live-info");
 add(info,"span","igjal-live-badge","● TRANSMISSÃO AO VIVO");
 add(info,"h2","igjal-live-title",title);
 add(info,"p","igjal-live-description","A igreja está transmitindo agora! Assista aqui ou acompanhe pelo canal oficial.");
 const link=add(info,"a","btn btn-primary igjal-live-link","Assistir no YouTube ↗");
 link.href="https://www.youtube.com/watch?v="+id;link.target="_blank";link.rel="noopener noreferrer";
 const frameHost=add(box,"div","igjal-live-player");
 const thumb=add(frameHost,"img");thumb.alt="Capa da transmissão ao vivo";thumb.src="https://i.ytimg.com/vi/"+id+"/hqdefault.jpg";thumb.loading="lazy";
 const button=add(frameHost,"button","igjal-live-play","▶ Assistir aqui");
 button.type="button";
 button.addEventListener("click",()=>{
  const iframe=document.createElement("iframe");
  iframe.src="https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1&rel=0";
  iframe.title="Ao vivo: "+title;
  iframe.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen=true;
  iframe.referrerPolicy="strict-origin-when-cross-origin";
  frameHost.replaceChildren(iframe);
 },{once:true});
 host.hidden=false;
}
async function check(){
 try{
  const response=await fetch("assets/live.json?v="+Math.floor(Date.now()/60000),{cache:"no-store"});
  if(!response.ok)throw Error("Status não disponível");
  display(await response.json());
 }catch(e){host.hidden=true;host.replaceChildren();}
}
check();
document.addEventListener("visibilitychange",()=>{if(!document.hidden)check();});
setInterval(()=>{if(!document.hidden)check();},3*60000);
})();