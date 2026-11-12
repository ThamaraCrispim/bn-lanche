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
    const filter=$("orders-filter").value;
    const result=await req("/api/admin/orders?status="+encodeURIComponent(filter));
    const orders=result.orders||[];
    const open=filter==="abertos"?orders:(await req("/api/admin/orders?status=abertos")).orders||[];
    $("count-new").textContent=open.filter(o=>o.status==="novo").length;
    $("count-accepted").textContent=open.filter(o=>o.status==="aceito").length;
    $("count-ready").textContent=open.filter(o=>o.status==="pronto").length;
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
$("refresh-orders").addEventListener("click",()=>{
  const active=document.querySelector(".admin-tabs button.active")?.dataset.tab||"orders";
  if(active==="orders")refresh();
  if(active==="customers")loadCustomers();
  if(active==="finance")loadFinance();
  if(active==="site"){loadSite();loadProducts();}
});
$("orders-filter").addEventListener("change",refresh);
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
  return '<article class="admin-product" data-id="'+escape(p.id)+'"><div class="admin-product-image">'+image+'</div><div class="admin-product-body"><b>'+escape(p.name)+'</b><small>'+escape(p.category)+' • '+money(p.cents)+(p.available?'':' • Indisponível')+'</small><div class="admin-photo-actions"><button type="button" class="outline" data-edit-product="'+escape(p.id)+'">Editar produto</button><label class="admin-photo-file">Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file="'+escape(p.id)+'" aria-label="Foto de '+escape(p.name)+'"></label><button type="button" data-upload="'+escape(p.id)+'">Enviar foto</button>'+(p.photoUrl?'<button type="button" class="outline" data-delete-photo="'+escape(p.id)+'">Remover foto</button>':"")+'</div><small class="admin-file-label" data-file-label="'+escape(p.id)+'"></small></div></article>';
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
const paneKeys=["orders","customers","finance","site"];
let customersLoaded=false,customers=[],financeLoaded=false,siteLoaded=false,siteData=null;
function setTab(tab){
  for(const name of paneKeys){
    const selected=tab===name;
    $(name+"-pane").hidden=!selected;
    $("tab-"+name).classList.toggle("active",selected);
    $("tab-"+name).setAttribute("aria-pressed",String(selected));
  }
  if(tab==="site"&&!productsLoaded)loadProducts();
  if(tab==="customers"&&!customersLoaded)loadCustomers();
  if(tab==="finance"&&!financeLoaded)loadFinance();
  if(tab==="site"&&!siteLoaded)loadSite();
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
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


function openProductEditor(p=null){
  $("product-dialog-title").textContent=p?"Editar produto":"Adicionar produto";
  $("edit-product-id").value=p?.id||"";
  $("edit-product-name").value=p?.name||"";
  $("edit-product-price").value=p?(p.cents/100).toFixed(2):"";
  $("edit-product-category").value=p?.category||"Hambúrgueres";
  $("edit-product-description").value=p?.desc||"";
  $("edit-product-available").checked=p?.available!==false;
  $("product-editor").showModal();
}
$("new-product").addEventListener("click",()=>openProductEditor());
$("product-dialog-close").addEventListener("click",()=>$("product-editor").close());
$("admin-products").addEventListener("click",event=>{
  const edit=event.target.closest("button[data-edit-product]");
  if(!edit)return;
  const p=products.find(p=>p.id===edit.dataset.editProduct);
  if(p)openProductEditor(p);
});
$("product-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const id=$("edit-product-id").value;
  const payload={name:$("edit-product-name").value.trim(),
    category:$("edit-product-category").value,
    cents:Math.round(Number($("edit-product-price").value)*100),
    desc:$("edit-product-description").value.trim(),
    available:$("edit-product-available").checked};
  const button=$("save-product");button.disabled=true;alertUser("");
  try{
    const result=await req(id?"/api/admin/products/"+encodeURIComponent(id):"/api/admin/products",
      id?"PATCH":"POST",payload);
    productsLoaded=false;
    $("product-editor").close();await loadProducts();
    alertUser("Produto "+result.product.name+" salvo! O cardápio será atualizado.");
    $("admin-alert").classList.add("ok");
  }catch(e){alertUser(e.message);}
  finally{button.disabled=false;}
});
function renderCustomers(){
  const q=$("customers-search").value.trim().toLocaleLowerCase("pt-BR");
  const visible=customers.filter(c=>(String(c.name||"")+" "+String(c.phone||"")).toLocaleLowerCase("pt-BR").includes(q));
  $("customers-overview").innerHTML=
    '<div><span>Clientes identificados</span><strong>'+customers.length+'</strong></div>'+
    '<div><span>Pedidos</span><strong>'+customers.reduce((s,c)=>s+(Number(c.orders_count)||0),0)+'</strong></div>'+
    '<div><span>Clientes com pagamento</span><strong>'+customers.filter(c=>Number(c.paid_orders)>0).length+'</strong></div>';
  $("admin-customers").innerHTML=visible.map(c=>
    '<article class="customer-entry"><span class="customer-initial">'+escape((c.name||"C")[0].toUpperCase())+
    '</span><div class="customer-info"><strong>'+escape(c.name||"Cliente")+'</strong>'+
    '<span>WhatsApp: '+escape(c.phone||"—")+'</span>'+
    '<small>Último pedido: '+new Date(Number(c.last_order_at)).toLocaleString("pt-BR")+'</small></div>'+
    '<div class="customer-stats"><b>'+escape(c.orders_count)+' pedidos</b>'+
    '<span>'+money(Number(c.paid_cents)||0)+' recebidos</span></div></article>'
  ).join("");
  $("customers-empty").hidden=visible.length>0;
}
async function loadCustomers(){
  try{
    const data=await req("/api/admin/customers");
    customers=Array.isArray(data.customers)?data.customers:[];
    customersLoaded=true;renderCustomers();alertUser("");
  }catch(e){alertUser("Clientes: "+e.message);}
}
$("customers-search").addEventListener("input",renderCustomers);
const paymentNames={pix:"Pix",cartao:"Cartão",dinheiro:"Dinheiro"};
async function loadFinance(){
  try{
    const data=await req("/api/admin/finance?period="+encodeURIComponent($("finance-period").value));
    const x=data.report;
    if(!x||typeof x!=="object")throw Error("Relatório indisponível.");
    $("finance-received").textContent=money(Number(x.receivedCents)||0);
    $("finance-count").textContent=String(x.paidOrders||0);
    $("finance-average").textContent=money(Number(x.ticketAverageCents)||0);
    $("finance-unpaid").textContent=String(x.unpaidOrders||0);
    $("finance-methods").innerHTML=(x.byMethod||[]).length?x.byMethod.map(v=>
      '<div class="method-item"><span>'+escape(paymentNames[v.method]||v.method)+
      '<small>'+escape(v.count)+' pagamentos</small></span><strong>'+money(Number(v.cents)||0)+'</strong></div>'
    ).join(""):'<p class="admin-empty">Sem pagamentos neste período.</p>';
    $("finance-payments").innerHTML=(x.recentPayments||[]).length?x.recentPayments.map(v=>
      '<div class="method-item"><span><b>#'+escape(v.number)+'</b> '+escape(v.name)+
      '<small>'+new Date(Number(v.paidAt)).toLocaleString("pt-BR")+'</small></span><strong>'+
      money(Number(v.cents)||0)+'</strong></div>'
    ).join(""):'<p class="admin-empty">Nenhum recebimento neste período.</p>';
    financeLoaded=true;alertUser("");
  }catch(e){alertUser("Financeiro: "+e.message);}
}
$("finance-period").addEventListener("change",loadFinance);


function safeSiteImage(url){
  if(url==="/icons/bn-original.svg")return true;
  return typeof url==="string"&&validProductPhoto(url);
}
function fillSite(site){
  $("site-name").value=site.storeName||"BN Lanches";
  $("site-tagline").value=site.tagline||"";
  $("site-title").value=site.heroTitle||"";
  $("site-emphasis").value=site.heroEmphasis||"";
  $("site-description").value=site.heroDescription||"";
  renderSiteImages(site);
}
function renderSiteImages(site){
  $("site-logo-thumb").innerHTML='<img alt="Logomarca atual" src="'+escape(safeSiteImage(site.logoUrl)?site.logoUrl:"/icons/bn-original.svg")+'">';
  $("site-cover-thumb").innerHTML=safeSiteImage(site.coverUrl)?
    '<img alt="Capa atual" src="'+escape(site.coverUrl)+'">':'<span>Sem capa personalizada</span>';
}
function refreshSitePreview(){
  $("site-preview").src="/?preview=1&updated="+Date.now();
}
async function loadSite(){
  try{
    const data=await req("/api/admin/site");
    siteData=data.site;siteLoaded=true;fillSite(siteData);alertUser("");
  }catch(e){alertUser("Personalização: "+e.message);}
}
$("site-settings-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=$("save-site-text");button.disabled=true;alertUser("");
  try{
    const data=await req("/api/admin/site","PATCH",{
      storeName:$("site-name").value,
      tagline:$("site-tagline").value,
      heroTitle:$("site-title").value,
      heroEmphasis:$("site-emphasis").value,
      heroDescription:$("site-description").value
    });
    siteData=data.site;fillSite(siteData);refreshSitePreview();
    alertUser("Textos salvos. Veja a página atualizada na prévia.");
    $("admin-alert").classList.add("ok");
  }catch(e){alertUser(e.message);}
  finally{button.disabled=false;}
});
async function sendSiteImage(kind){
  const input=$(kind==="logo"?"site-logo-file":"site-cover-file");
  const file=input.files?.[0];
  if(!file)return alertUser("Escolha uma imagem antes de salvar.");
  const limit=kind==="logo"?2*1024*1024:5*1024*1024;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>limit)
    return alertUser("Envie JPG, PNG ou WebP dentro do tamanho permitido.");
  const button=$("save-site-"+kind);button.disabled=true;alertUser("");
  try{
    const resp=await fetch("/api/admin/site/"+kind,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":file.type},body:file
    });
    const result=await resp.json().catch(()=>({}));
    if(!resp.ok)throw Error(result.error||"Não foi possível enviar a imagem.");
    siteData=result.site;renderSiteImages(siteData);
    input.value="";refreshSitePreview();
    alertUser(kind==="logo"?"Logomarca salva!":"Capa salva!");
    $("admin-alert").classList.add("ok");
  }catch(e){alertUser(e.message);}
  finally{button.disabled=false;}
}
async function resetSiteImage(kind){
  if(!confirm(kind==="logo"?"Restaurar a logomarca original?":"Remover a foto de capa?"))return;
  try{
    const resp=await fetch("/api/admin/site/"+kind,{method:"DELETE",credentials:"same-origin",cache:"no-store"});
    const result=await resp.json().catch(()=>({}));
    if(!resp.ok)throw Error(result.error||"Não foi possível restaurar.");
    siteData=result.site;renderSiteImages(siteData);refreshSitePreview();
    alertUser("Imagem atualizada.");$("admin-alert").classList.add("ok");
  }catch(e){alertUser(e.message);}
}
for(const kind of ["logo","cover"]){
  $("save-site-"+kind).addEventListener("click",()=>sendSiteImage(kind));
  $("reset-site-"+kind).addEventListener("click",()=>resetSiteImage(kind));
}
$("preview-mobile").addEventListener("click",()=>{
  $("site-preview-frame").classList.add("is-mobile");
  $("preview-mobile").classList.add("active");$("preview-desktop").classList.remove("active");
});
$("preview-desktop").addEventListener("click",()=>{
  $("site-preview-frame").classList.remove("is-mobile");
  $("preview-desktop").classList.add("active");$("preview-mobile").classList.remove("active");
});

start();
