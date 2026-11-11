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
function parseCart(items) {
  if(!Array.isArray(items)||items.length<1||items.length>30) throw new Error("Escolha entre 1 e 30 itens.");
  const clean=[];
  let total=0;
  for(const item of items) {
    if(!item||typeof item.id!=="string") throw new Error("Produto inválido.");
    const p=menu.find(p=>p.id===item.id);
    const qty=Number(item.quantity);
    if(!p||!Number.isInteger(qty)||qty<1||qty>30) throw new Error("Produto ou quantidade inválida.");
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
    name:row.customer_name,items:JSON.parse(row.items_json),
    paymentMethod:row.payment_method,paid:!!row.paid,
    createdAt:row.created_at,updatedAt:row.updated_at,
    acceptedAt:row.accepted_at,readyAt:row.ready_at,deliveredAt:row.delivered_at
  };
}
function hasDb(env){return Boolean(env.DB);}
function liveOrders(env){return env.ORDERS_ENABLED==="true" && hasDb(env) && !!env.TRACKING_SECRET;}
function adminReady(env){return hasDb(env) && !!env.ADMIN_USERNAME && !!env.ADMIN_PASSWORD && !!env.SESSION_SECRET;}
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
  await env.DB.prepare("DELETE FROM login_attempts WHERE created_at < ?").bind(now-MS_15MIN).run();
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND created_at > ?").bind(rateKey,now-MS_15MIN).first();
  if((count?.n||0)>=5)return error("Muitas tentativas. Aguarde 15 minutos.",429);
  if(!safeEqual(user,env.ADMIN_USERNAME)||!safeEqual(pass,env.ADMIN_PASSWORD)){
    await env.DB.prepare("INSERT INTO login_attempts(key,created_at) VALUES(?,?)").bind(rateKey,now).run();
    return error("Usuário ou senha inválidos.",401);
  }
  await env.DB.prepare("DELETE FROM login_attempts WHERE key=?").bind(rateKey).run();
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
  const {clean,total}=parseCart(input.items);
  const old=await env.DB.prepare("SELECT * FROM orders WHERE request_key=?").bind(key).first();
  if(old) return error("Este pedido já foi registrado. Consulte seu comprovante anterior.",409);
  const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE phone=? AND created_at>?").bind(phone,Date.now()-10*60000).first();
  if((recent?.n||0)>=4)return error("Muitos pedidos recentes. Entre em contato com a lanchonete.",429);
  const token=randomHex(24), code=randomCode();
  const digest=await hmac(env.TRACKING_SECRET,phone+"|"+code);
  const now=Date.now();
  const inserted=await env.DB.prepare(
    "INSERT INTO orders (request_key,tracking_token,recovery_hash,customer_name,phone,items_json,total_cents,payment_method,status,paid,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?, 'novo',0,?,?) RETURNING id"
  ).bind(key,token,digest,customerName,phone,JSON.stringify(clean),total,input.paymentMethod,now,now).first();
  return reply({number:inserted.id,token,code,status:"novo",name:customerName,totalCents:total},201);
}
async function track(token,env) {
  if(!hasDb(env))return error("Acompanhamento ainda não disponível.",503);
  if(!/^[a-f0-9]{48}$/.test(token))return error("Código de acompanhamento inválido.",404);
  const row=await env.DB.prepare("SELECT * FROM orders WHERE tracking_token=?").bind(token).first();
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
  const row=await env.DB.prepare("SELECT * FROM orders WHERE phone=? AND recovery_hash=?").bind(phone,hash).first();
  if(!row)return error("Nenhum pedido encontrado com esses dados.",404);
  return reply({...orderDto(row),token:row.tracking_token});
}
async function listOrders(env,url) {
  const filter=url.searchParams.get("status")||"abertos";
  const valid=ORDER_STATES.includes(filter)||filter==="abertos"||filter==="todos";
  if(!valid)return error("Filtro inválido.");
  let sql="SELECT * FROM orders";
  const args=[];
  if(filter==="abertos")sql+=" WHERE status IN ('novo','aceito','pronto')";
  else if(filter!=="todos"){sql+=" WHERE status=?";args.push(filter);}
  sql+=" ORDER BY CASE status WHEN 'novo' THEN 0 WHEN 'aceito' THEN 1 WHEN 'pronto' THEN 2 ELSE 3 END, created_at DESC LIMIT 100";
  const result=await env.DB.prepare(sql).bind(...args).all();
  return reply({orders:(result.results||[]).map(orderDto)});
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
  if(action==="pagar"){
    const row=await env.DB.prepare("UPDATE orders SET paid=1,paid_at=?,updated_at=? WHERE id=? AND status IN ('aceito','pronto') AND paid=0 RETURNING *").bind(now,now,id).first();
    return row?reply({order:orderDto(row)}):error("Pagamento já registrado ou pedido fora da etapa correta.",409);
  }
  const x=transitions[action];
  if(!x)return error("Ação inválida.");
  const extra=action==="retirar"?" AND paid=1":"";
  const row=await env.DB.prepare("UPDATE orders SET status=?, "+x.col+"=?, updated_at=? WHERE id=? AND status=?"+extra+" RETURNING *").bind(x.to,now,now,id,x.from).first();
  return row?reply({order:orderDto(row)}):error("Não foi possível atualizar. Confirme a etapa e o pagamento.",409);
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
      const m=path.match(/^\/api\/admin\/orders\/(\d+)$/);
      if(m&&request.method==="PATCH")return updateOrder(request,env,Number(m[1]));
      return error("Rota não encontrada.",404);
    } catch(e) {
      if(e instanceof Error && !/D1_ERROR|SQLITE|database|no such table|binding/i.test(e.message)){
        if(/inválid|informe|muito|escolha|fora da etapa|não pode|adicional/i.test(e.message.toLowerCase()))return error(e.message,400);
      }
      console.error("API error",e instanceof Error?e.message:e);
      return error("Não foi possível processar agora. Verifique a configuração ou tente novamente.",503);
    }
  }
};
