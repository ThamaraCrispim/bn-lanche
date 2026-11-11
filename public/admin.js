const $=id=>document.getElementById(id);
const req=async(path,method="GET",data)=>{
  let res;
  try{
    res=await fetch(path,{method,credentials:"same-origin",headers:data?{"Content-Type":"application/json"}:{},body:data?JSON.stringify(data):undefined,cache:"no-store"});
  }catch{throw Error("Sem conexão com o servidor. Confira sua internet.");}
  let result={};
  try{result=await res.json();}catch{}
  if(!res.ok)throw Error(result.error||"Não foi possível completar a operação.");
  return result;
};
const money=c=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let tick=null,loading=false;
function alertUser(message){$("admin-alert").textContent=message;$("admin-alert").hidden=!message;}
function setAuth(isOn){$("admin-login").hidden=isOn;$("admin-dashboard").hidden=!isOn;if(!isOn&&tick){clearInterval(tick);tick=null;}}
function orderCard(o){
  const lines=(o.items||[]).map(i=>'<div class="admin-line"><b>'+escape(i.quantity)+'× '+escape(i.name)+'</b><small>'+escape((i.extras||[]).map(e=>e.name).join(" • "))+'</small>'+(i.note?'<em>⚠ '+escape(i.note)+'</em>':"")+'</div>').join("");
  const states={novo:"Novo",aceito:"Aceito",pronto:"Pronto"};
  let actions=o.status==="novo"?'<button data-action="aceitar" data-id="'+o.number+'">✓ Aceitar pedido</button>':o.status==="aceito"?'<button data-action="pronto" data-id="'+o.number+'">✓ Marcar pronto</button>':'';
  if(["aceito","pronto"].includes(o.status)&&!o.paid)actions+='<button class="green" data-action="pagar" data-id="'+o.number+'">✓ Confirmar pagamento</button>';
  if(o.status==="pronto"&&o.paid)actions+='<button class="green" data-action="retirar" data-id="'+o.number+'">✓ Confirmar retirada</button>';
  return '<article class="admin-order '+(o.status==="novo"?"is-new":o.status==="pronto"?"is-ready":"")+'"><div class="admin-order-top"><div><strong>#'+escape(o.number)+'</strong><small>'+new Date(o.createdAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+'</small></div><span class="admin-badge '+escape(o.status)+'">'+(states[o.status]||escape(o.status))+'</span></div><div class="admin-customer">'+escape(o.name)+' • Retirada</div><div class="admin-lines">'+lines+'</div><div class="admin-payment"><div>'+money(o.totalCents)+'<small>'+escape(o.paymentMethod||"")+'</small></div><div>'+(o.paid?"✓ Pago":"Pagamento pendente")+'</div></div><div class="admin-actions">'+actions+'</div></article>';
}
async function refresh(){
  if(loading)return;loading=true;
  try{
    const result=await req("/api/admin/orders?status=abertos");
    const orders=result.orders||[];
    $("count-new").textContent=orders.filter(o=>o.status==="novo").length;
    $("count-accepted").textContent=orders.filter(o=>o.status==="aceito").length;
    $("count-ready").textContent=orders.filter(o=>o.status==="pronto").length;
    $("admin-orders").innerHTML=orders.map(orderCard).join("");
    $("admin-empty").hidden=orders.length>0;
    alertUser("");
  }catch(e){alertUser(e.message);if(/administrador|login/i.test(e.message)){setAuth(false);}}
  finally{loading=false;}
}
async function start(){
  try{
    const config=await req("/api/config");
    if(!config.adminEnabled){alertUser("O login do BN ainda não foi configurado na Cloudflare. Esta área ficará bloqueada até ativarmos a segurança.");setAuth(false);return;}
    const session=await req("/api/admin/session");
    setAuth(!!session.authenticated);
    if(session.authenticated){await refresh();tick=setInterval(()=>{if(!document.hidden)refresh();},15000);}
  }catch(e){alertUser(e.message);setAuth(false);}
}
$("admin-login").addEventListener("submit",async evt=>{
  evt.preventDefault();
  const button=$("login-submit");button.disabled=true;alertUser("");
  try{
    await req("/api/admin/login","POST",{username:$("username").value.trim(),password:$("password").value});
    $("password").value="";setAuth(true);await refresh();if(!tick)tick=setInterval(()=>{if(!document.hidden)refresh();},15000);
  }catch(e){alertUser(e.message);}
  finally{button.disabled=false;}
});
$("admin-orders").addEventListener("click",async evt=>{
  const b=evt.target.closest("button[data-action]");if(!b)return;
  const action=b.dataset.action,id=Number(b.dataset.id);
  if(!Number.isSafeInteger(id))return;
  const labels={aceitar:"Aceitar pedido",pronto:"Marcar pedido como pronto",pagar:"Confirmar que o pagamento foi realmente recebido",retirar:"Confirmar retirada"};
  if(!confirm((labels[action]||"Confirmar operação")+" — pedido #"+id+"?"))return;
  b.disabled=true;
  try{await req("/api/admin/orders/"+id,"PATCH",{action});await refresh();}
  catch(e){alertUser(e.message);b.disabled=false;}
});
$("refresh-orders").addEventListener("click",refresh);
$("logout").addEventListener("click",async()=>{try{await req("/api/admin/logout","POST",{});}catch{}setAuth(false);alertUser("");});
start();