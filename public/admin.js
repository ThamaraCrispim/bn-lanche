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
function alertUser(message){$("admin-alert").textContent=message;$("admin-alert").hidden=!message;$("admin-alert").classList.remove("ok");}
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

let productsLoaded=false;
let products=[];
function validProductPhoto(url){
  try {
    const u=new URL(url);
    return u.protocol==="https:"&&u.hostname==="wmtgqompgrthddznazdz.supabase.co"&&u.pathname.startsWith("/storage/v1/object/public/bn-menu/");
  }catch{return false;}
}
function productCard(p){
  const image=p.photoUrl&&validProductPhoto(p.photoUrl)
    ?'<img src="'+escape(p.photoUrl)+'" loading="lazy" alt="Foto de '+escape(p.name)+'">'
    :'<span aria-hidden="true">📷</span>';
  return '<article class="admin-product" data-id="'+escape(p.id)+'"><div class="admin-product-image">'+image+'</div><div class="admin-product-body"><b>'+escape(p.name)+'</b><small>'+escape(p.category)+' • '+money(p.cents)+'</small><div class="admin-photo-actions"><label class="admin-photo-file">Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file="'+escape(p.id)+'" aria-label="Foto de '+escape(p.name)+'"></label><button type="button" data-upload="'+escape(p.id)+'">Enviar foto</button>'+(p.photoUrl?'<button type="button" class="outline" data-delete-photo="'+escape(p.id)+'">Remover foto</button>':"")+'</div><small class="admin-file-label" data-file-label="'+escape(p.id)+'"></small></div></article>';
}
function renderProducts(){
  const q=$("product-search").value.toLocaleLowerCase("pt-BR").trim();
  const view=products.filter(p=>(p.name+" "+p.category).toLocaleLowerCase("pt-BR").includes(q));
  $("admin-products").innerHTML=view.map(productCard).join("");
  $("products-empty").hidden=view.length>0;
}
async function loadProducts(){
  try{
    const data=await req("/api/admin/products");
    products=(data.products||[]).filter(p=>p&&p.id);
    productsLoaded=true;
    renderProducts();
    alertUser("");
  }catch(e){alertUser("Não foi possível carregar o cardápio: "+e.message);}
}
function setTab(tab){
  const showProducts=tab==="products";
  $("orders-pane").hidden=showProducts;
  $("products-pane").hidden=!showProducts;
  $("tab-orders").classList.toggle("active",!showProducts);
  $("tab-products").classList.toggle("active",showProducts);
  $("tab-orders").setAttribute("aria-pressed",String(!showProducts));
  $("tab-products").setAttribute("aria-pressed",String(showProducts));
  if(showProducts&&!productsLoaded)loadProducts();
}
$("tab-orders").addEventListener("click",()=>setTab("orders"));
$("tab-products").addEventListener("click",()=>setTab("products"));
$("product-search").addEventListener("input",renderProducts);
$("admin-products").addEventListener("change",e=>{
  const input=e.target.closest("input[data-photo-file]");
  if(!input)return;
  const label=document.querySelector('[data-file-label="'+input.dataset.photoFile+'"]');
  if(label)label.textContent=input.files?.[0]?.name||"";
});
$("admin-products").addEventListener("click",async e=>{
  const upload=e.target.closest("button[data-upload]");
  const remove=e.target.closest("button[data-delete-photo]");
  const button=upload||remove;
  if(!button)return;
  const id=upload?.dataset.upload||remove?.dataset.deletePhoto;
  const product=products.find(p=>p.id===id);
  if(!product)return;
  const card=button.closest(".admin-product");
  const file=card?.querySelector("input[data-photo-file]")?.files?.[0];
  if(upload){
    if(!file)return alertUser("Escolha uma foto para "+product.name+".");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))return alertUser("Escolha uma imagem JPG, PNG ou WebP.");
    if(file.size>2*1024*1024)return alertUser("A imagem deve ter até 2 MB.");
  } else {
    if(!confirm("Remover a foto de "+product.name+" do cardápio?"))return;
  }
  button.disabled=true;alertUser("");
  try{
    const res=await fetch("/api/admin/products/"+encodeURIComponent(id)+"/photo",{
      method:upload?"POST":"DELETE",
      credentials:"same-origin",cache:"no-store",
      headers:upload?{"Content-Type":file.type}:{},
      body:upload?file:undefined
    });
    const result=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(result.error||"Falha ao salvar foto.");
    products=products.map(p=>p.id===id?result.product:p);
    renderProducts();
    alertUser(upload?"Foto de "+product.name+" salva! Ela já está associada ao cardápio.":"Foto removida do cardápio.");
    $("admin-alert").classList.add("ok");
  }catch(err){alertUser(err.message);$("admin-alert").classList.remove("ok");button.disabled=false;}
});

start();