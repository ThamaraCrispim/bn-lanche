import { menu, extras } from "./catalog.mjs";
const categories = ["Todos", "Hambúrgueres", "Hot-dogs", "Frango", "Porções", "Bebidas", "Sobremesas"];
const centsMoney = cents => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents / 100);
const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const byId = id => document.getElementById(id);
const clientStorageKey = "bn-lanches:lembrar-cliente:v1";
const CART_KEY="bn-lanches:carrinho:v1";
const CLIENT_DRAFT="bn-lanches:cliente-em-andamento:v1";
const LAST_TRACKING_KEY="bn-lanches:ultimo-pedido:v1";
function storageRead(storage,key) {try{return JSON.parse(storage.getItem(key)||"null");}catch{return null;}}
function savedCart(){
  const data=storageRead(localStorage,CART_KEY);
  if(!Array.isArray(data))return [];
  return data.slice(0,30).flatMap(row=>{
    if(!row||typeof row.id!=="string")return [];
    const p=menu.find(x=>x.id===row.id);
    const qty=Number(row.quantity);
    if(!p||!Number.isInteger(qty)||qty<1||qty>30)return [];
    const extraIndices=Array.isArray(row.extraIds)?row.extraIds:[];
    const available=["Hambúrgueres","Hot-dogs","Frango"].includes(p.category);
    const selected=available?[...new Set(extraIndices)].filter(n=>Number.isInteger(n)&&n>=0&&n<extras.length).map(n=>extras[n]):[];
    const note=typeof row.note==="string"?row.note.slice(0,180):"";
    return [{id:p.id,name:p.name,quantity:qty,unitPrice:p.cents,additions:selected,note,lineTotal:(p.cents+selected.reduce((s,e)=>s+e.cents,0))*qty}];
  });
}
const cart=savedCart();
function saveCart(){
  try{localStorage.setItem(CART_KEY,JSON.stringify(cart.map(row=>({
    id:row.id,quantity:row.quantity,note:row.note,
    extraIds:row.additions.map(e=>extras.findIndex(x=>x.name===e.name)).filter(i=>i>=0)
  }))));}catch{message("Não foi possível salvar o carrinho neste navegador.");}
}
let activeCategory = "Todos", selectedProduct = null, quantity = 1, noticeTimer;
const emoji = p => p.category === "Hot-dogs" ? "🌭" : p.category === "Bebidas" ? "🥤" : p.category === "Porções" ? "🍟" : p.category === "Sobremesas" ? "🥟" : "🍔";
function message(txt){const el=byId("notice");el.textContent=txt;el.classList.add("show");clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function dialog(id){const x=byId(id);if(!x.open)x.showModal();}
function close(id){const x=byId(id);if(x.open)x.close();}
function categoriesHtml(){byId("categories").innerHTML=categories.map(c=>'<button type="button" class="category '+(activeCategory===c?"active":"")+'" data-category="'+escapeHtml(c)+'" aria-pressed="'+(activeCategory===c)+'">'+escapeHtml(c)+'</button>').join("");}
function renderMenu(){
 const q=byId("search").value.trim().toLocaleLowerCase("pt-BR");
 const found=menu.filter(p=>(activeCategory==="Todos"||p.category===activeCategory) && (!q||(p.name+" "+p.desc).toLocaleLowerCase("pt-BR").includes(q)));
 byId("empty").hidden=found.length>0;
 byId("products").innerHTML=found.map(p=>'<article class="product"><div class="product-photo">'+(p.photoUrl?'<img loading="lazy" src="'+escapeHtml(p.photoUrl)+'" alt="Foto de '+escapeHtml(p.name)+'">':'<span aria-hidden="true">'+emoji(p)+'</span>')+'</div><div class="product-content"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.desc||p.category)+'</p><div class="product-bottom"><strong class="price">'+escapeHtml(centsMoney(p.cents))+'</strong><button type="button" data-product="'+escapeHtml(p.id)+'">Adicionar +</button></div></div></article>').join("");
}
function extrasSelected(){
 return [...byId("extras").querySelectorAll("input[data-extra]:checked")].map(el=>extras[Number(el.dataset.extra)]).filter(Boolean);
}
function selectedPrice(){
 const x=extrasSelected().reduce((s,e)=>s+e.cents,0);
 return ((selectedProduct?.cents||0)+x)*quantity;
}
function updateQty(){byId("qty").textContent=String(quantity);byId("qty-minus").disabled=quantity===1;byId("item-total").textContent=centsMoney(selectedPrice());}
function startProduct(id){
 const p=menu.find(x=>x.id===id); if(!p)return;
 selectedProduct=p;quantity=1;
 byId("item-name").textContent=p.name;
 byId("item-description").textContent=p.desc||"";
 byId("notes").value="";
 const available=["Hambúrgueres","Hot-dogs","Frango"].includes(p.category);
 byId("extras-wrap").hidden=!available;
 byId("extras").innerHTML=available?extras.map((x,i)=>'<label class="extra"><input type="checkbox" data-extra="'+i+'"><span>'+escapeHtml(x.name)+'</span><b>+ '+escapeHtml(centsMoney(x.cents))+'</b></label>').join(""):"";
 updateQty();dialog("item-dialog");
}
function cartTotal(){return cart.reduce((sum,row)=>sum+row.lineTotal,0);}
function updateCartButton(){
 byId("cart-badge").textContent=cart.reduce((n,row)=>n+row.quantity,0);
 byId("cart-button-price").textContent=centsMoney(cartTotal());
}
function renderCart(){
 byId("cart-items").innerHTML=cart.length?cart.map((row,i)=>'<div class="cart-line"><div><strong>'+escapeHtml(row.quantity)+'× '+escapeHtml(row.name)+'</strong><small>'+escapeHtml(row.additions.map(x=>x.name).join(" • "))+'</small>'+ (row.note?'<small>Observação: '+escapeHtml(row.note)+'</small>':"")+'<button class="remove" type="button" data-remove="'+i+'">Remover</button></div><div class="cart-line-right">'+escapeHtml(centsMoney(row.lineTotal))+'</div></div>').join(""):'<p class="empty">Seu carrinho está vazio.</p>';
 byId("cart-total").textContent=centsMoney(cartTotal());
 byId("checkout-open").disabled=cart.length===0;
 updateCartButton();
}
function addProduct(){
 if(!selectedProduct)return;
 const additions=extrasSelected();
 const note=byId("notes").value.trim();
 const lineTotal=selectedPrice();
 cart.push({id:selectedProduct.id,name:selectedProduct.name,quantity,unitPrice:selectedProduct.cents,additions,note,lineTotal});
 saveCart();
 close("item-dialog");renderCart();message("Produto adicionado ao carrinho!");
}
function readRemembered(){
  const saved=storageRead(localStorage,clientStorageKey);
  const draft=storageRead(sessionStorage,CLIENT_DRAFT);
  const data=saved&&typeof saved.name==="string"&&typeof saved.phone==="string"?saved:draft;
  if(data&&typeof data.name==="string"&&typeof data.phone==="string"){
    byId("client-name").value=data.name.slice(0,65);
    byId("client-phone").value=data.phone.slice(0,19);
  }
  byId("remember").checked=!!saved;
}
function saveClientDraft(){
  try{sessionStorage.setItem(CLIENT_DRAFT,JSON.stringify({
    name:byId("client-name").value.slice(0,65),
    phone:byId("client-phone").value.slice(0,19)
  }));}catch{}
}

function validBrazilPhone(phone){
 const digits=phone.replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"");
 return /^\d{10,11}$/.test(digits) && Number(digits.slice(0,2))>=11;
}
let currentTicketToken = "";
let latestReceiptOrder=null;
let latestRecoveryCode="";
const LAST_RECEIPT_KEY="bn-lanches:ultimo-comprovante:v1";
const paymentLabels={pix:"Pix na retirada",cartao:"Cartão na retirada",dinheiro:"Dinheiro na retirada"};
const statusLabels={novo:"Pedido recebido! Aguardando confirmação do BN.",aceito:"Pedido aceito! Vamos preparar seu lanche.",pronto:"Pedido pronto! Já pode retirar no balcão.",retirado:"Pedido retirado. Obrigado pela preferência!",cancelado:"Pedido cancelado. Entre em contato com o BN."};
async function jsonRequest(path,options){
  const response=await fetch(path,{cache:"no-store",...options});
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok)throw Error(data.error||"Não foi possível completar a operação.");
  return data;
}
function saveTicket(token){
  currentTicketToken=token;
  try{sessionStorage.setItem(LAST_TRACKING_KEY,token);}catch{}
  const url=new URL(location.href);
  url.searchParams.set("pedido",token);
  history.replaceState({}, "", url.pathname+url.search+url.hash);
}
function showTracking(order,code=""){
  const stored=storageRead(sessionStorage,LAST_RECEIPT_KEY);
  if(code){latestRecoveryCode=code;}
  else if(stored?.token && stored.token===currentTicketToken){latestRecoveryCode=stored.code||"";}
  else{latestRecoveryCode="";}
  latestReceiptOrder=order;
  byId("tracking-number-panel").hidden=!Number.isSafeInteger(Number(order.number));
  byId("tracking-number").textContent=order.number?"#"+order.number:"—";
  byId("tracking-copy").hidden=!order.number;
  byId("tracking-number-copy").hidden=!order.number;
  const status=order.status||"novo";
  byId("tracking-title").textContent="Pedido #"+(order.number||"—");
  byId("tracking-greeting").textContent=(order.name||"Cliente")+", "+(statusLabels[status]||"Acompanhe seu pedido.");
  byId("tracking-status").textContent=statusLabels[status]||"Acompanhe seu pedido.";
  byId("tracking-code").textContent=latestRecoveryCode?"Código de recuperação: "+latestRecoveryCode+" — guarde para consultar pelo WhatsApp.":"";
  const reached={novo:0,aceito:1,pronto:2,retirado:3,cancelado:0}[status]||0;
  const labels=["Pedido recebido","Pedido aceito","Pronto para retirada","Retirado"];
  byId("tracking-timeline").innerHTML=labels.map((x,i)=>'<li class="'+(i<=reached?"done":"")+'">'+escapeHtml(x)+'</li>').join("");
  if(status==="cancelado")byId("tracking-status").textContent="Pedido cancelado. Entre em contato com o BN Lanches.";
  byId("tracking-share").hidden=!currentTicketToken;
  dialog("tracking-dialog");
}
async function trackToken(token,showError=true){
  if(!/^[a-f0-9]{48}$/.test(token||""))return;
  try{
    const order=await jsonRequest("/api/track/"+token);
    currentTicketToken=token;
    showTracking(order);
  }catch(error){if(showError)message(error.message);}
}
function showDemoTracking(name){
  currentTicketToken="";
  latestReceiptOrder=null;latestRecoveryCode="";
  byId("tracking-number-panel").hidden=true;
  byId("tracking-copy").hidden=true;
  byId("tracking-number-copy").hidden=true;
  byId("tracking-title").textContent="Prévia de acompanhamento";
  byId("tracking-greeting").textContent=name+", este é um exemplo. Nenhum pedido foi enviado ao BN.";
  byId("tracking-status").textContent="Pedido demonstrativo — nenhuma encomenda registrada";
  byId("tracking-code").textContent="";
  byId("tracking-share").hidden=true;
  byId("tracking-timeline").innerHTML='<li class="done">Carrinho montado</li><li>Pedido recebido pelo BN</li><li>Pedido aceito</li><li>Pronto para retirada</li>';
  dialog("tracking-dialog");
}
async function submitCheckout(evt){
  evt.preventDefault();
  if(!cart.length)return message("Escolha pelo menos um produto.");
  const name=byId("client-name").value.trim(),phone=byId("client-phone").value.trim();
  if(name.length<2){byId("client-name").setCustomValidity("Informe seu nome.");byId("client-name").reportValidity();return;}
  if(!validBrazilPhone(phone)){byId("client-phone").setCustomValidity("Digite um WhatsApp com DDD.");byId("client-phone").reportValidity();return;}
  saveClientDraft();
  if(byId("remember").checked){
    try{localStorage.setItem(clientStorageKey,JSON.stringify({name,phone}));}catch{}
  }else{try{localStorage.removeItem(clientStorageKey);}catch{}}
  const submit=byId("checkout-submit");submit.disabled=true;
  try{
    const config=await jsonRequest("/api/config");
    if(!config.ordersEnabled){
      close("checkout-dialog");showDemoTracking(name);
      message("Versão de demonstração: nenhum pedido real foi enviado.");
      return;
    }
    const payload={
      name,phone,paymentMethod:byId("payment-method").value,
      requestId:crypto.randomUUID(),
      items:cart.map(row=>({
        id:row.id,quantity:row.quantity,note:row.note,
        extraIds:row.additions.map(e=>extras.findIndex(x=>x.name===e.name)).filter(n=>n>=0)
      }))
    };
    const order=await jsonRequest("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    saveTicket(order.token);
    try{sessionStorage.setItem(LAST_RECEIPT_KEY,JSON.stringify({token:order.token,code:order.code,number:order.number}));}catch{}
    cart.splice(0);saveCart();updateCartButton();
    close("checkout-dialog");showTracking(order,order.code);
    message("Pedido enviado! Guarde o código ou o link para acompanhar.");
  }catch(error){message(error.message||"Não foi possível enviar o pedido.");}
  finally{submit.disabled=false;}
}
async function recoverOrder(evt){
  evt.preventDefault();
  const phone=byId("lookup-phone").value.trim(),code=byId("lookup-code").value.trim().toUpperCase();
  if(!validBrazilPhone(phone)||code.length<8){message("Informe o WhatsApp com DDD e o código do pedido.");return;}
  const button=byId("lookup-submit");button.disabled=true;
  try{
    const order=await jsonRequest("/api/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,code})});
    saveTicket(order.token);
    close("lookup-dialog");showTracking(order);
  }catch(e){message(e.message);}finally{button.disabled=false;}
}
function openMyOrders(){
  const token=new URL(location.href).searchParams.get("pedido")||currentTicketToken||sessionStorage.getItem(LAST_TRACKING_KEY);
  if(token && /^[a-f0-9]{48}$/.test(token)){trackToken(token);return;}
  dialog("lookup-dialog");
}

byId("categories").addEventListener("click",evt=>{
 const b=evt.target.closest("button[data-category]");if(!b)return;
 activeCategory=b.dataset.category;categoriesHtml();renderMenu();
});
byId("search").addEventListener("input",renderMenu);
byId("products").addEventListener("click",evt=>{
 const b=evt.target.closest("button[data-product]");if(b)startProduct(b.dataset.product);
});
byId("extras").addEventListener("change",updateQty);
byId("qty-minus").addEventListener("click",()=>{quantity=Math.max(1,quantity-1);updateQty();});
byId("qty-plus").addEventListener("click",()=>{quantity=Math.min(30,quantity+1);updateQty();});
byId("add-item").addEventListener("click",addProduct);
byId("cart-open").addEventListener("click",()=>{renderCart();dialog("cart-dialog");});
byId("cart-items").addEventListener("click",evt=>{
 const b=evt.target.closest("button[data-remove]");if(!b)return;
 const i=Number(b.dataset.remove);if(Number.isInteger(i)&&i>=0&&i<cart.length){cart.splice(i,1);saveCart();renderCart();}
});
byId("checkout-open").addEventListener("click",()=>{
 if(!cart.length)return;
 byId("checkout-total").textContent=centsMoney(cartTotal());
 readRemembered();close("cart-dialog");dialog("checkout-dialog");
});
byId("checkout").addEventListener("submit",submitCheckout);
byId("client-name").addEventListener("input",()=>{byId("client-name").setCustomValidity("");saveClientDraft();});
byId("client-phone").addEventListener("input",()=>{byId("client-phone").setCustomValidity("");saveClientDraft();});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>close(b.dataset.close)));
byId("track-open").addEventListener("click",openMyOrders);
byId("lookup").addEventListener("submit",recoverOrder);
byId("tracking-share").addEventListener("click",async ()=>{
  const link=new URL(location.href);link.searchParams.set("pedido",currentTicketToken);
  try{await navigator.clipboard.writeText(link.href);message("Link de acompanhamento copiado!");}
  catch{message("Copie o link da barra de endereço do navegador.");}
});
const initialToken=new URL(location.href).searchParams.get("pedido");
if(initialToken && /^[a-f0-9]{48}$/.test(initialToken)){currentTicketToken=initialToken;trackToken(initialToken,false);}
window.setInterval(()=>{
  if(byId("tracking-dialog").open && currentTicketToken && !document.hidden)trackToken(currentTicketToken,false);
},15000);
categoriesHtml();renderMenu();updateCartButton();


async function loadMenuPhotos(){
  try {
    const response=await fetch("/api/menu",{cache:"no-store"});
    if(!response.ok)return;
    const data=await response.json();
    if(!Array.isArray(data.products) || data.products.length===0)return;
    const valid=data.products.filter(p=>p&&typeof p.id==="string"&&typeof p.name==="string"&&Number.isInteger(p.cents)&&p.cents>0);
    if(valid.length===0)return;
    const safe=valid.map(p=>({
      id:p.id,name:p.name,cents:p.cents,category:p.category,desc:p.desc||"",available:p.available,
      photoUrl:typeof p.photoUrl==="string" && p.photoUrl.startsWith("https://wmtgqompgrthddznazdz.supabase.co/storage/v1/object/public/bn-menu/")?p.photoUrl:null
    }));
    menu.splice(0,menu.length,...safe);
    for(let i=cart.length-1;i>=0;i--){
      const p=menu.find(x=>x.id===cart[i].id);
      if(!p){cart.splice(i,1);continue;}
      cart[i].name=p.name;
      cart[i].unitPrice=p.cents;
      cart[i].lineTotal=(p.cents+cart[i].additions.reduce((s,e)=>s+e.cents,0))*cart[i].quantity;
    }
    saveCart();
    renderMenu();updateCartButton();
  }catch{}
}
loadMenuPhotos();


function receiptText(order,code="",token=""){
  const number=Number(order?.number);
  if(!Number.isSafeInteger(number)||number<1)return "";
  const lines=[
    "BN LANCHES — COMPROVANTE",
    "Pedido #"+number,
    "Cliente: "+(order.name||"Cliente"),
    "Situação: "+(statusLabels[order.status]||"Aguardando atualização"),
    "",
    "ITENS"
  ];
  for(const item of (order.items||[])){
    lines.push(item.quantity+"× "+item.name+" — "+centsMoney(Number(item.lineCents)||0));
    for(const add of item.extras||[])lines.push("  + "+add.name);
    if(item.note)lines.push("  Obs.: "+item.note);
  }
  lines.push("", "Total: "+centsMoney(Number(order.totalCents)||0),
    "Pagamento: "+(paymentLabels[order.paymentMethod]||"Na retirada"));
  if(code)lines.push("Código para consultar: "+code);
  if(token&&/^[a-f0-9]{48}$/.test(token)){
    const url=new URL(location.href);
    url.searchParams.set("pedido",token);
    url.searchParams.delete("utm_source");
    lines.push("Acompanhe: "+url.href);
  }
  return lines.join("\n");
}
async function copyText(text,success){
  if(!text)return message("Comprovante indisponível.");
  try{
    await navigator.clipboard.writeText(text);
    message(success);
  }catch{message("Não foi possível copiar automaticamente neste navegador. Use o link de acompanhamento.");}
}
byId("tracking-copy").addEventListener("click",()=>{
  copyText(receiptText(latestReceiptOrder,latestRecoveryCode,currentTicketToken),"Comprovante com o número do pedido copiado!");
});
byId("tracking-number-copy").addEventListener("click",()=>{
  const id=latestReceiptOrder?.number;
  if(id)copyText("BN Lanches — Pedido #"+id,"Número do pedido copiado!");
});
async function loadSiteAppearance(){
  try{
    const response=await fetch("/api/site",{cache:"no-store"});
    if(!response.ok)return;
    const {site}=await response.json();
    if(!site||typeof site!=="object")return;
    byId("store-header-name").textContent=site.storeName||"BN Lanches";
    byId("store-footer-name").textContent=site.storeName||"BN Lanches";
    byId("store-tagline").textContent=site.tagline||"";
    byId("store-hero-title").textContent=site.heroTitle||"Seu lanche favorito,";
    byId("store-hero-emphasis").textContent=site.heroEmphasis||"do seu jeito.";
    byId("store-hero-description").textContent=site.heroDescription||"";
    const prefix="https://wmtgqompgrthddznazdz.supabase.co/storage/v1/object/public/bn-menu/";
    const safeImg=url=>{
      if(typeof url!=="string"||!url.startsWith(prefix))return false;
      try{
        const u=new URL(url);
        return u.hostname==="wmtgqompgrthddznazdz.supabase.co"&&u.protocol==="https:";
      }catch{return false;}
    };
    byId("store-logo").src=safeImg(site.logoUrl)?site.logoUrl:"/icons/bn-original.svg";
    const hero=document.querySelector(".hero");
    if(safeImg(site.coverUrl)){
      hero.classList.add("has-cover");
      hero.style.backgroundImage="linear-gradient(90deg,rgba(12,9,8,.84),rgba(12,9,8,.48)),url("+JSON.stringify(site.coverUrl)+")";
    } else {
      hero.classList.remove("has-cover");
      hero.style.removeProperty("background-image");
    }
  }catch{}
}
loadSiteAppearance();
