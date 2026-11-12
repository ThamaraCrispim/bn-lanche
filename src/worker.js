import { menu, extras } from "../public/catalog.mjs";

const MS_15MIN = 15 * 60 * 1000;
const ORDER_STATES = ["novo", "aceito", "pronto", "retirado", "cancelado"];
const encoder = new TextEncoder();

function reply(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}
function error(message, status=400){ return reply({error:message},status); }
function cleanPhone(value) {
  if(typeof value !== "string") return "";
  const digits=value.replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"");
  return /^\d{10,11}$/.test(digits) && Number(digits.slice(0,2))>=11 ? digits:"";
}
function safeName(value) {
  if(typeof value!=="string") return "";
  return value.trim().replace(/\s+/g," ").slice(0,65);
}
async function body(request) {
  if(Number(request.headers.get("content-length")||0)>20000) throw new Error("Pedido muito grande.");
  const text=await request.text();
  if(text.length>20000) throw new Error("Pedido muito grande.");
  try { return JSON.parse(text); } catch { throw new Error("Dados inválidos."); }
}
function safeEqual(a,b) {
  if(typeof a!=="string" || typeof b!=="string") return false;
  let mismatch=a.length ^ b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++) mismatch |= (a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return mismatch===0;
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function unbase64url(str) {
  const x=str.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(x+"=".repeat((4-x.length%4)%4)),c=>c.charCodeAt(0));
}
async function hmac(secret,data) {
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(data))));
}
function randomHex(size=24) {
  return Array.from(crypto.getRandomValues(new Uint8Array(size)),x=>x.toString(16).padStart(2,"0")).join("");
}
function randomCode() {
  const symbols="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)),v=>symbols[v%symbols.length]).join("");
}
async function parseCart(items,env) {
  if(!Array.isArray(items)||items.length<1||items.length>30) throw new Error("Escolha entre 1 e 30 itens.");
  const inventory=await dbRequest(env,"bn_products","GET","select=id,name,cents,category,available,archived_at&limit=1000");
  const indexed=new Map((inventory||[]).map(p=>[p.id,p]));
  const clean=[];
  let total=0;
  for(const item of items) {
    if(!item||typeof item.id!=="string") throw new Error("Produto inválido.");
    const p=indexed.get(item.id);
    const qty=Number(item.quantity);
    if(!p||!p.available||p.archived_at||!Number.isInteger(qty)||qty<1||qty>30) throw new Error("Produto indisponível ou quantidade inválida.");
    const eligible=["Hambúrgueres","Hot-dogs","Frango"].includes(p.category);
    const additions=[];
    const indices=item.extraIds??[];
    if(!Array.isArray(indices)||indices.length>extras.length||(!eligible && indices.length))throw new Error("Adicionais inválidos.");
    for(const i of indices) {
      if(!Number.isInteger(i)||i<0||i>=extras.length||additions.some(a=>a.id===i)) throw new Error("Adicional inválido.");
      additions.push({id:i,name:extras[i].name,cents:extras[i].cents});
    }
    const note=typeof item.note==="string" ? item.note.trim().slice(0,180):"";
    const lineCents=(p.cents+additions.reduce((s,e)=>s+e.cents,0))*qty;
    total+=lineCents;
    clean.push({id:p.id,name:p.name,quantity:qty,unitCents:p.cents,extras:additions,note,lineCents});
  }
  if(total<=0||total>2000000) throw new Error("Valor do pedido inválido.");
  return {clean,total};
}
function orderDto(row) {
  return {
    number:row.id,status:row.status,totalCents:row.total_cents,
    name:row.customer_name,items:typeof row.items_json==="string"?JSON.parse(row.items_json):row.items_json,
    paymentMethod:row.payment_method,paid:!!row.paid,
    createdAt:row.created_at,updatedAt:row.updated_at,
    acceptedAt:row.accepted_at,readyAt:row.ready_at,deliveredAt:row.delivered_at
  };
}
// Dados pessoais so devem ser retornados ao administrador autenticado.
function adminOrderDto(row){return {...orderDto(row),phone:row.phone};}
function hasDb(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);
}
function liveOrders(env) {
  return env.ORDERS_ENABLED==="true" && hasDb(env) && !!env.TRACKING_SECRET;
}
function adminReady(env) {
  return hasDb(env) && !!env.ADMIN_USERNAME && !!env.ADMIN_PASSWORD && !!env.SESSION_SECRET;
}
// A chave secreta do Supabase nunca é enviada ao navegador.
async function dbRequest(env,table,method="GET",filters="",payload,extraHeaders={}) {
  if (!hasDb(env)) throw new Error("Banco não configurado.");
  const base=new URL(env.SUPABASE_URL);
  if(base.protocol!=="https:" || !base.hostname.endsWith(".supabase.co")) throw new Error("URL de banco inválida.");
  const url=base.origin+"/rest/v1/"+table+(filters?("?"+filters):"");
  const headers={
    "apikey":env.SUPABASE_SECRET_KEY,
    "Accept":"application/json",
    "Content-Type":"application/json",
    "Cache-Control":"no-store",
    ...extraHeaders
  };
  // sb_secret_ não é JWT: nunca enviar como Authorization: Bearer.
  const response=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
  const raw=await response.text();
  let parsed=null;
  if(raw){try{parsed=JSON.parse(raw)}catch{}}
  if(!response.ok){
    if(response.status===409 || parsed?.code==="23505") throw new Error("Registro duplicado.");
    console.error("Erro do Supabase",response.status,parsed?.code||"");
    throw new Error("Falha no banco de dados.");
  }
  return parsed;
}
const filterEq=(field,value)=>field+"=eq."+encodeURIComponent(String(value));
const filterLt=(field,value)=>field+"=lt."+encodeURIComponent(String(value));
const filterGt=(field,value)=>field+"=gt."+encodeURIComponent(String(value));
async function firstRow(env,table,filters) {
  const result=await dbRequest(env,table,"GET","select=*&"+filters+"&limit=1");
  return Array.isArray(result)?(result[0]||null):null;
}
function cookie(request) {
  const match=(request.headers.get("Cookie")||"").match(/(?:^|;\s*)bn_session=([^;]+)/);
  return match?match[1]:"";
}
async function sessionUser(request,env) {
  const value=cookie(request);
  if(!adminReady(env)||!value) return null;
  const parts=value.split(".");
  if(parts.length!==2) return null;
  try {
    const expected=await hmac(env.SESSION_SECRET,parts[0]);
    if(!safeEqual(expected,parts[1])) return null;
    const data=JSON.parse(new TextDecoder().decode(unbase64url(parts[0])));
    if(data.u!==env.ADMIN_USERNAME || !Number.isFinite(data.exp) || data.exp<Date.now())return null;
    return data.u;
  }catch{return null;}
}
function sessionCookie(token) {
  return "bn_session="+token+"; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=28800";
}
async function createSession(username,env) {
  const payload=base64url(encoder.encode(JSON.stringify({u:username,exp:Date.now()+8*3600000})));
  return payload+"."+await hmac(env.SESSION_SECRET,payload);
}
async function login(request,env) {
  if(!adminReady(env))return error("Login ainda não configurado.",503);
  const input=await body(request);
  const user=typeof input?.username==="string"?input.username.trim():"";
  const pass=typeof input?.password==="string"?input.password:"";
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const rateKey=await hmac(env.SESSION_SECRET,ip+"|"+user);
  const now=Date.now();
  await dbRequest(env,"bn_login_attempts","DELETE",filterLt("created_at",now-MS_15MIN),undefined,{"Prefer":"return=minimal"});
  const past=await dbRequest(env,"bn_login_attempts","GET","select=key&"+filterEq("key",rateKey)+"&"+filterGt("created_at",now-MS_15MIN)+"&limit=6");
  if((past?.length||0)>=5)return error("Muitas tentativas. Aguarde 15 minutos.",429);
  if(!safeEqual(user,env.ADMIN_USERNAME)||!safeEqual(pass,env.ADMIN_PASSWORD)){
    await dbRequest(env,"bn_login_attempts","POST","",{key:rateKey,created_at:now},{"Prefer":"return=minimal"});
    return error("Usuário ou senha inválidos.",401);
  }
  await dbRequest(env,"bn_login_attempts","DELETE",filterEq("key",rateKey),undefined,{"Prefer":"return=minimal"});
  const token=await createSession(user,env);
  return reply({ok:true},200,{"Set-Cookie":sessionCookie(token)});
}
async function submitOrder(request,env) {
  if(!liveOrders(env))return error("Pedidos reais ainda não estão habilitados.",503);
  const input=await body(request);
  const customerName=safeName(input?.name), phone=cleanPhone(input?.phone);
  if(customerName.length<2||!phone) return error("Informe nome e WhatsApp com DDD.");
  if(!["pix","cartao","dinheiro"].includes(input.paymentMethod))return error("Escolha a forma de pagamento na retirada.");
  const key=input?.requestId;
  if(typeof key!=="string"|| !/^[a-f0-9-]{36}$/i.test(key))return error("Identificação da tentativa inválida.");
  const {clean,total}=await parseCart(input.items,env);
  const old=await firstRow(env,"bn_orders",filterEq("request_key",key));
  if(old)return error("Este pedido já foi registrado. Consulte seu comprovante anterior.",409);
  const recent=await dbRequest(env,"bn_orders","GET","select=id&"+filterEq("phone",phone)+"&"+filterGt("created_at",Date.now()-10*60000)+"&limit=4");
  if((recent?.length||0)>=4)return error("Muitos pedidos recentes. Entre em contato com a lanchonete.",429);
  const token=randomHex(24), code=randomCode();
  const digest=await hmac(env.TRACKING_SECRET,phone+"|"+code);
  const now=Date.now();
  const result=await dbRequest(env,"bn_orders","POST","",{
    request_key:key,tracking_token:token,recovery_hash:digest,
    customer_name:customerName,phone,items_json:clean,total_cents:total,
    payment_method:input.paymentMethod,status:"novo",paid:false,
    created_at:now,updated_at:now
  },{"Prefer":"return=representation"});
  if(!Array.isArray(result)||!result[0]?.id)throw new Error("Pedido não confirmado pelo servidor.");
  return reply({number:result[0].id,token,code,status:"novo",name:customerName,totalCents:total,items:clean,paymentMethod:input.paymentMethod},201);
}
async function track(token,env) {
  if(!hasDb(env))return error("Acompanhamento ainda não disponível.",503);
  if(!/^[a-f0-9]{48}$/.test(token))return error("Código de acompanhamento inválido.",404);
  const row=await firstRow(env,"bn_orders",filterEq("tracking_token",token));
  if(!row)return error("Pedido não encontrado.",404);
  return reply(orderDto(row));
}
async function recover(request,env) {
  if(!liveOrders(env))return error("Consulta ainda não disponível.",503);
  const input=await body(request);
  const phone=cleanPhone(input?.phone);
  const code=typeof input?.code==="string"?input.code.toUpperCase().replace(/[^A-Z0-9]/g,""):"";
  if(!phone||!/^[A-Z2-9]{10}$/.test(code))return error("Informe WhatsApp e código de recuperação.");
  const hash=await hmac(env.TRACKING_SECRET,phone+"|"+code);
  const row=await firstRow(env,"bn_orders",filterEq("phone",phone)+"&"+filterEq("recovery_hash",hash));
  if(!row)return error("Nenhum pedido encontrado com esses dados.",404);
  return reply({...orderDto(row),token:row.tracking_token});
}
async function listOrders(env,url) {
  const filter=url.searchParams.get("status")||"abertos";
  const valid=ORDER_STATES.includes(filter)||filter==="abertos"||filter==="todos";
  if(!valid)return error("Filtro inválido.");
  let options="select=*";
  if(filter==="abertos")options+="&status=in.(novo,aceito,pronto)";
  else if(filter!=="todos")options+="&"+filterEq("status",filter);
  options+="&order=created_at.desc&limit=100";
  const result=await dbRequest(env,"bn_orders","GET",options);
  const weight={novo:0,aceito:1,pronto:2,retirado:3,cancelado:4};
  return reply({orders:(result||[]).map(adminOrderDto).sort((a,b)=>(weight[a.status]??5)-(weight[b.status]??5)||b.createdAt-a.createdAt)});
}
async function updateOrder(request,env,id) {
  const input=await body(request);
  const action=input?.action;
  const transitions={
    aceitar:{from:"novo",to:"aceito",col:"accepted_at"},
    pronto:{from:"aceito",to:"pronto",col:"ready_at"},
    retirar:{from:"pronto",to:"retirado",col:"delivered_at"},
    cancelar:{from:"novo",to:"cancelado",col:"updated_at"}
  };
  const now=Date.now();
  if(!Number.isSafeInteger(id)||id<1)return error("Pedido inválido.");
  if(action==="pagar"){
    const filters=filterEq("id",id)+"&status=in.(aceito,pronto)&paid=eq.false";
    const rows=await dbRequest(env,"bn_orders","PATCH",filters,{paid:true,paid_at:now,updated_at:now},{"Prefer":"return=representation"});
    return rows?.[0]?reply({order:adminOrderDto(rows[0])}):error("Pagamento já registrado ou pedido fora da etapa correta.",409);
  }
  const x=transitions[action];
  if(!x)return error("Ação inválida.");
  const filters=filterEq("id",id)+"&"+filterEq("status",x.from)+(action==="retirar"?"&paid=eq.true":"");
  const patch={status:x.to,[x.col]:now,updated_at:now};
  const rows=await dbRequest(env,"bn_orders","PATCH",filters,patch,{"Prefer":"return=representation"});
  return rows?.[0]?reply({order:adminOrderDto(rows[0])}):error("Não foi possível atualizar. Confirme a etapa e o pagamento.",409);
}

const IMAGE_BUCKET="bn-menu";
const IMAGE_MAX_BYTES=2*1024*1024;
function imageType(bytes) {
  if(bytes.length>=3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff)return {mime:"image/jpeg",ext:"jpg"};
  if(bytes.length>=8 && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71 && bytes[4]===13 && bytes[5]===10 && bytes[6]===26 && bytes[7]===10)return {mime:"image/png",ext:"png"};
  if(bytes.length>=12 && String.fromCharCode(...bytes.subarray(0,4))==="RIFF" && String.fromCharCode(...bytes.subarray(8,12))==="WEBP")return {mime:"image/webp",ext:"webp"};
  return null;
}
const productView=row=>({
  id:row.id,name:row.name,cents:row.cents,category:row.category,desc:row.description||"",
  photoUrl:row.photo_url||null,available:!!row.available,archivedAt:row.archived_at||null,sortOrder:row.sort_order
});
async function menuList(env,onlyAvailable=false) {
  if(!hasDb(env))return reply({products:menu.map((p,i)=>({...p,photoUrl:null,available:true,sortOrder:i}))});
  const filters="select=id,name,cents,category,description,photo_url,available,archived_at,sort_order"+
    (onlyAvailable?"&available=eq.true&archived_at=is.null":"")+"&order=sort_order.asc";
  const products=await dbRequest(env,"bn_products","GET",filters);
  return reply({products:products.map(productView)});
}
async function saveProductPhoto(request,env,productId) {
  if(!hasDb(env))return error("Banco de dados não configurado.",503);
  if(!/^[a-z0-9-]{2,70}$/.test(productId))return error("Produto inválido.");
  const old=await firstRow(env,"bn_products",filterEq("id",productId));
  if(!old)return error("Produto não encontrado.",404);
  const headerLength=Number(request.headers.get("content-length")||0);
  if(headerLength>IMAGE_MAX_BYTES)return error("A imagem deve ter até 2 MB.",413);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(!bytes.byteLength || bytes.byteLength>IMAGE_MAX_BYTES)return error("A imagem deve ter até 2 MB.",413);
  const kind=imageType(bytes);
  if(!kind)return error("Envie uma imagem JPG, PNG ou WebP válida.",415);
  const root=new URL(env.SUPABASE_URL);
  if(root.protocol!=="https:"||!root.hostname.endsWith(".supabase.co"))return error("Configuração do banco inválida.",503);
  const objectName=productId+"-"+randomHex(12)+"."+kind.ext;
  const endpoint=root.origin+"/storage/v1/object/"+IMAGE_BUCKET+"/"+objectName;
  const response=await fetch(endpoint,{method:"POST",headers:{
    "apikey":env.SUPABASE_SECRET_KEY,"Content-Type":kind.mime,
    "cache-control":"3600","x-upsert":"false"
  },body:bytes});
  if(!response.ok){console.error("Falha ao enviar foto:",response.status);return error("Falha ao salvar foto no Supabase. Tente novamente.",503);}
  const imageUrl=root.origin+"/storage/v1/object/public/"+IMAGE_BUCKET+"/"+objectName;
  const updated=await dbRequest(env,"bn_products","PATCH",filterEq("id",productId),
    {photo_url:imageUrl,updated_at:new Date().toISOString()},{"Prefer":"return=representation"});
  if(!updated?.[0])return error("Não foi possível associar a foto ao produto.",503);
  return reply({product:productView(updated[0]),photoUrl:imageUrl});
}
async function deleteProductPhoto(env,productId) {
  if(!/^[a-z0-9-]{2,70}$/.test(productId))return error("Produto inválido.");
  const updated=await dbRequest(env,"bn_products","PATCH",filterEq("id",productId),
    {photo_url:null,updated_at:new Date().toISOString()},{"Prefer":"return=representation"});
  if(!updated?.[0])return error("Produto não encontrado.",404);
  return reply({product:productView(updated[0])});
}


const DEFAULT_SITE={
  id:1,storeName:"BN Lanches",tagline:"O melhor lanche da cidade!",
  heroTitle:"Seu lanche favorito,",heroEmphasis:"do seu jeito.",
  heroDescription:"Escolha os lanches e personalize sem criar conta.",
  coverUrl:null,logoUrl:"/icons/bn-original.svg"
};
function imageUrlIsSafe(value,env){
  if(typeof value!=="string")return false;
  try{
    const origin=new URL(env.SUPABASE_URL).origin;
    const target=new URL(value);
    return target.origin===origin && target.pathname.startsWith("/storage/v1/object/public/bn-menu/");
  }catch{return false;}
}
function siteDto(row,env){
  return {
    id:1,storeName:row.store_name,tagline:row.tagline,
    heroTitle:row.hero_title,heroEmphasis:row.hero_emphasis,
    heroDescription:row.hero_description,
    coverUrl:imageUrlIsSafe(row.cover_url,env)?row.cover_url:null,
    logoUrl:imageUrlIsSafe(row.logo_url,env)?row.logo_url:"/icons/bn-original.svg"
  };
}
async function siteInfo(env){
  if(!hasDb(env))return reply({site:DEFAULT_SITE});
  const row=await firstRow(env,"bn_site_settings","id=eq.1");
  return reply({site:row?siteDto(row,env):DEFAULT_SITE});
}
async function updateSiteText(request,env){
  const input=await body(request);
  if(!input||typeof input!=="object"||Array.isArray(input))return error("Dados inválidos.");
  const fields={storeName:["store_name",2,70],tagline:["tagline",0,110],
    heroTitle:["hero_title",2,90],heroEmphasis:["hero_emphasis",2,70],
    heroDescription:["hero_description",0,240]};
  const payload={};
  for(const [key,value] of Object.entries(input)){
    if(!(key in fields)||typeof value!=="string")return error("Campo de personalização inválido.");
    const [column,min,max]=fields[key];
    const cleaned=value.trim().replace(/\s+/g," ");
    if(cleaned.length<min||cleaned.length>max)return error("Texto fora do tamanho permitido.");
    payload[column]=cleaned;
  }
  if(!Object.keys(payload).length)return error("Nenhuma alteração recebida.");
  payload.updated_at=new Date().toISOString();
  const updated=await dbRequest(env,"bn_site_settings","PATCH","id=eq.1",payload,{"Prefer":"return=representation"});
  if(!updated?.[0])return error("Não foi possível salvar a personalização.",503);
  return reply({site:siteDto(updated[0],env)});
}
async function saveSiteAsset(request,env,kind){
  if(!["logo","cover"].includes(kind))return error("Imagem inválida.",400);
  const maxBytes=kind==="logo"?2*1024*1024:5*1024*1024;
  if(Number(request.headers.get("content-length")||0)>maxBytes)return error("Imagem acima do limite de tamanho.",413);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(!bytes.length||bytes.byteLength>maxBytes)return error("Imagem acima do limite de tamanho.",413);
  const kindOfImage=imageType(bytes);
  if(!kindOfImage)return error("Imagem inválida. Use JPG, PNG ou WebP.",415);
  const origin=new URL(env.SUPABASE_URL).origin;
  const filename="site/"+kind+"-"+randomHex(12)+"."+kindOfImage.ext;
  const response=await fetch(origin+"/storage/v1/object/bn-menu/"+filename,{
    method:"POST",headers:{
      "apikey":env.SUPABASE_SECRET_KEY,"Content-Type":kindOfImage.mime,
      "cache-control":"3600","x-upsert":"false"
    },body:bytes
  });
  if(!response.ok){console.error("Storage error",response.status);return error("Não foi possível salvar a imagem no Supabase.",503);}
  const publicUrl=origin+"/storage/v1/object/public/bn-menu/"+filename;
  const column=kind==="logo"?"logo_url":"cover_url";
  const changed=await dbRequest(env,"bn_site_settings","PATCH","id=eq.1",
    {[column]:publicUrl,updated_at:new Date().toISOString()},{"Prefer":"return=representation"});
  if(!changed?.[0])return error("Não foi possível aplicar a imagem.",503);
  return reply({site:siteDto(changed[0],env)});
}
async function removeSiteAsset(env,kind){
  if(!["logo","cover"].includes(kind))return error("Imagem inválida.");
  const column=kind==="logo"?"logo_url":"cover_url";
  const changed=await dbRequest(env,"bn_site_settings","PATCH","id=eq.1",
    {[column]:null,updated_at:new Date().toISOString()},{"Prefer":"return=representation"});
  if(!changed?.[0])return error("Não foi possível remover a imagem.",503);
  return reply({site:siteDto(changed[0],env)});
}
const ALLOWED_CATEGORIES=["Hambúrgueres","Hot-dogs","Frango","Porções","Bebidas","Sobremesas"];
function productFields(input,creating=false){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Dados inválidos.");
  const fields={name:"name",cents:"cents",category:"category",desc:"description",available:"available"};
  const payload={};
  for(const [key,value] of Object.entries(input)){
    if(!(key in fields))throw Error("Campo de produto inválido.");
    if(key==="name"){
      if(typeof value!=="string"||value.trim().length<2||value.trim().length>100)throw Error("Nome do produto inválido.");
      payload.name=value.trim();
    }else if(key==="cents"){
      if(!Number.isSafeInteger(value)||value<1||value>200000)throw Error("Preço do produto inválido.");
      payload.cents=value;
    }else if(key==="category"){
      if(!ALLOWED_CATEGORIES.includes(value))throw Error("Categoria inválida.");
      payload.category=value;
    }else if(key==="desc"){
      if(typeof value!=="string"||value.length>800)throw Error("Descrição inválida.");
      payload.description=value.trim();
    }else if(key==="available"){
      if(typeof value!=="boolean")throw Error("Disponibilidade inválida.");
      payload.available=value;
    }
  }
  if(creating&&(!payload.name||!payload.cents||!payload.category))throw Error("Preencha nome, preço e categoria.");
  if(!Object.keys(payload).length)throw Error("Nenhuma alteração recebida.");
  payload.updated_at=new Date().toISOString();
  return payload;
}
async function saveProduct(request,env,productId){
  const input=await body(request);
  const payload=productFields(input,!productId);
  if(productId){
    if(!/^[a-z0-9-]{2,70}$/.test(productId))return error("Produto inválido.");
    const changed=await dbRequest(env,"bn_products","PATCH",filterEq("id",productId),
      payload,{"Prefer":"return=representation"});
    if(!changed?.[0])return error("Produto não encontrado.",404);
    return reply({product:productView(changed[0])});
  }
  const existing=await dbRequest(env,"bn_products","GET","select=sort_order&order=sort_order.desc&limit=1");
  const sortOrder=Math.min(1000000,(Number(existing?.[0]?.sort_order)||0)+1);
  const slug=payload.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,51)||"item";
  const newId=slug+"-"+randomHex(3);
  const result=await dbRequest(env,"bn_products","POST","",{
    ...payload,id:newId,description:payload.description||"",available:payload.available!==false,sort_order:sortOrder
  },{"Prefer":"return=representation"});
  if(!result?.[0])return error("Não foi possível cadastrar o produto.",503);
  return reply({product:productView(result[0])},201);
}
async function archiveProduct(request,env,productId){
  if(!/^[a-z0-9-]{2,70}$/.test(productId))return error("Produto inválido.");
  const input=await body(request);
  if(typeof input?.archive!=="boolean")return error("Escolha se deseja remover ou restaurar o produto.");
  // Exclusão lógica, sem destruir fotos nem o histórico de pedidos.
  const rows=await dbRequest(env,"bn_products","PATCH",filterEq("id",productId),
    {archived_at:input.archive?new Date().toISOString():null,updated_at:new Date().toISOString()},
    {"Prefer":"return=representation"});
  if(!rows?.[0])return error("Produto não encontrado.",404);
  return reply({product:productView(rows[0])});
}
async function financeReport(env,url){
  const period=url.searchParams.get("period")||"today";
  if(!["today","week","month","all"].includes(period))return error("Período inválido.");
  const data=await dbRequest(env,"rpc/bn_finance_summary","POST","",{p_period:period});
  return reply({report:data});
}
async function customerReport(env){
  const data=await dbRequest(env,"rpc/bn_customers_summary","POST","",{p_limit:250});
  return reply({customers:Array.isArray(data)?data:[]});
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname;
    if(!path.startsWith("/api/")) {
      if(env.ASSETS)return env.ASSETS.fetch(request);
      return error("Site não configurado.",503);
    }
    if(request.method!=="GET" && request.method!=="HEAD"){
      const origin=request.headers.get("Origin");
      if(origin && origin!==url.origin)return error("Origem não autorizada.",403);
    }
    try{
      if(path==="/api/config" && request.method==="GET")return reply({ordersEnabled:liveOrders(env),adminEnabled:adminReady(env)});
      if(path==="/api/menu" && request.method==="GET")return menuList(env,true);
      if(path==="/api/site" && request.method==="GET")return siteInfo(env);
      if(path==="/api/orders"&&request.method==="POST")return submitOrder(request,env);
      const trackMatch=path.match(/^\/api\/track\/([a-f0-9]+)$/);
      if(trackMatch&&request.method==="GET")return track(trackMatch[1],env);
      if(path==="/api/lookup"&&request.method==="POST")return recover(request,env);
      if(path==="/api/admin/login"&&request.method==="POST")return login(request,env);
      if(path==="/api/admin/logout"&&request.method==="POST"){
        return reply({ok:true},200,{"Set-Cookie":"bn_session=; Secure; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0"});
      }
      if(path==="/api/admin/session"&&request.method==="GET")return reply({authenticated:!!(await sessionUser(request,env))});
      if(!path.startsWith("/api/admin/"))return error("Rota não encontrada.",404);
      if(!(await sessionUser(request,env)))return error("Entre como administrador.",401);
      if(path==="/api/admin/orders"&&request.method==="GET")return listOrders(env,url);
      if(path==="/api/admin/products"&&request.method==="GET")return menuList(env,false);
      if(path==="/api/admin/products"&&request.method==="POST")return saveProduct(request,env);
      const productEdit=path.match(/^\/api\/admin\/products\/([a-z0-9-]{2,70})$/);
      if(productEdit&&request.method==="PATCH")return saveProduct(request,env,productEdit[1]);
      const archiveMatch=path.match(/^\/api\/admin\/products\/([a-z0-9-]{2,70})\/archive$/);
      if(archiveMatch&&request.method==="PATCH")return archiveProduct(request,env,archiveMatch[1]);
      if(path==="/api/admin/finance"&&request.method==="GET")return financeReport(env,url);
      if(path==="/api/admin/customers"&&request.method==="GET")return customerReport(env);
      if(path==="/api/admin/site"&&request.method==="GET")return siteInfo(env);
      if(path==="/api/admin/site"&&request.method==="PATCH")return updateSiteText(request,env);
      const siteMediaMatch=path.match(/^\/api\/admin\/site\/(logo|cover)$/);
      if(siteMediaMatch&&request.method==="POST")return saveSiteAsset(request,env,siteMediaMatch[1]);
      if(siteMediaMatch&&request.method==="DELETE")return removeSiteAsset(env,siteMediaMatch[1]);
      const photoMatch=path.match(/^\/api\/admin\/products\/([a-z0-9-]{2,70})\/photo$/);
      if(photoMatch&&request.method==="POST")return saveProductPhoto(request,env,photoMatch[1]);
      if(photoMatch&&request.method==="DELETE")return deleteProductPhoto(env,photoMatch[1]);
      const m=path.match(/^\/api\/admin\/orders\/(\d+)$/);
      if(m&&request.method==="PATCH")return updateOrder(request,env,Number(m[1]));
      return error("Rota não encontrada.",404);
    } catch(e) {
      if(e instanceof Error && !/D1_ERROR|SQLITE|database|no such table|binding/i.test(e.message)){
        if(/inválid|indisponível|informe|preencha|muito|escolha|fora da etapa|não pode|adicional|tamanho|nenhuma|acima do limite/i.test(e.message.toLowerCase()))return error(e.message,400);
      }
      console.error("API error",e instanceof Error?e.message:e);
      return error("Não foi possível processar agora. Verifique a configuração ou tente novamente.",503);
    }
  }
};
