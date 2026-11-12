import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STATUS, transitionOrder, confirmPayment, summarizeOrders, customerMessage } from "../order-model.mjs";
import { menu, extras } from "../public/catalog.mjs";

const example = () => ({
  id: 1,
  status: STATUS.NOVO,
  total: 2800,
  payment: { paid: false, method: "Pix" }
});
test("pedido precisa ser aceito antes de ficar pronto", () => {
  const o=example();
  assert.throws(()=>transitionOrder(o,"pronto"),/etapa correta/);
  const accepted=transitionOrder(o,"aceitar");
  assert.equal(accepted.status,STATUS.ACEITO);
  assert.equal(customerMessage(accepted),"Pedido aceito! Vamos preparar seu lanche.");
  const ready=transitionOrder(accepted,"pronto");
  assert.equal(ready.status,STATUS.PRONTO);
  assert.match(customerMessage(ready),/pronto/i);
  assert.throws(()=>transitionOrder(ready,"retirar"),/pagamento/);
  const paid=confirmPayment(ready);
  assert.equal(paid.payment.paid,true);
  assert.equal(transitionOrder(paid,"retirar").status,STATUS.RETIRADO);
  assert.throws(()=>confirmPayment(paid),/confirmado/);
});
test("resumo de pedidos conta status e pagamentos",()=>{
  const rows=[example(),transitionOrder(example(),"aceitar"),confirmPayment(transitionOrder(example(),"aceitar"))];
  const summary=summarizeOrders(rows);
  assert.equal(summary.newCount,1);
  assert.equal(summary.acceptedCount,2);
  assert.equal(summary.paidTotal,2800);
});
test("o mesmo catálogo é exportado para servidor e navegador",()=>{
  assert.ok(menu.length>40);
  assert.ok(extras.length>10);
  assert.equal(menu.find(p=>p.id==="x-bacon").cents,2800);
});
test("site unificado contém navegação, PWA e recuperação de pedido",()=>{
  const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../public/cardapio.js",import.meta.url),"utf8");
  for(const id of ["install-app","track-open","lookup-dialog","tracking-share","checkout-submit","client-phone","client-name"])
    assert.ok(html.includes('id="'+id+'"'),id+" ausente");
  assert.ok(js.includes("saveCart()"));
  assert.ok(js.includes("sessionStorage"));
  assert.ok(html.includes("manifest.webmanifest"));
  assert.ok(html.includes('href="/admin.html"'));
});
test("configuração Cloudflare encaminha API ao Worker",()=>{
 const config=JSON.parse(readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8"));
 assert.equal(config.main,"src/worker.js");
 assert.deepEqual(config.assets.run_worker_first,["/api/*"]);
 const manifest=JSON.parse(readFileSync(new URL("../public/manifest.webmanifest",import.meta.url),"utf8"));
 assert.equal(manifest.display,"standalone");
});

test("API fica bloqueada quando não há segredos configurados",async()=>{
  const {default: worker}=await import("../src/worker.js");
  const origin="https://bn-lanche.example";
  const config=await worker.fetch(new Request(origin+"/api/config"),{});
  assert.equal(config.status,200);
  assert.deepEqual(await config.json(),{ordersEnabled:false,adminEnabled:false});
  const order=await worker.fetch(new Request(origin+"/api/orders",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:"Teste",phone:"16999999999",items:[]})
  }),{});
  assert.equal(order.status,503);
  const login=await worker.fetch(new Request(origin+"/api/admin/login",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:"teste",password:"teste"})
  }),{});
  assert.equal(login.status,503);
  const admin=await worker.fetch(new Request(origin+"/api/admin/orders"),{});
  assert.equal(admin.status,401);
});
test("Worker usa Supabase no servidor sem expor chave secreta no frontend",()=>{
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
 const client=readFileSync(new URL("../public/cardapio.js",import.meta.url),"utf8");
 assert.match(worker,/SUPABASE_SECRET_KEY/);
 assert.match(worker,/\/rest\/v1\//);
 assert.doesNotMatch(client,/SUPABASE_SECRET_KEY|sb_secret_/);
 assert.doesNotMatch(html,/SUPABASE_SECRET_KEY|sb_secret_/);
 assert.doesNotMatch(worker,/env\.DB/);
});


test("admin mostra menu e upload de fotos somente dentro da sessão",()=>{
  const html=readFileSync(new URL("../public/admin.html",import.meta.url),"utf8");
  const admin=readFileSync(new URL("../public/admin.js",import.meta.url),"utf8");
  const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
  const client=readFileSync(new URL("../public/cardapio.js",import.meta.url),"utf8");
  for(const id of ["tab-site","site-pane","products-pane","admin-products"])assert.ok(html.includes('id="'+id+'"'));
  assert.match(admin,/image\/jpeg/);
  assert.match(admin,/\/api\/admin\/products\//);
  assert.match(worker,/if\(!\(await sessionUser\(request,env\)\)\)/);
  assert.match(worker,/photoMatch&&request\.method==="POST"/);
  assert.match(worker,/IMAGE_MAX_BYTES/);
  assert.match(client,/\/api\/menu/);
  assert.match(client,/p\.photoUrl/);
});
test("logomarca enviada substitui o monograma no site e no painel",()=>{
  const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  const admin=readFileSync(new URL("../public/admin.html",import.meta.url),"utf8");
  const icon=readFileSync(new URL("../public/icons/bn-original.svg",import.meta.url),"utf8");
  assert.ok(html.includes("bn-original.svg"));
  assert.ok(admin.includes("bn-original.svg"));
  assert.ok(icon.includes("data:image/jpeg;base64,"));
});


test("Editar app reúne cardápio, fotos, logomarca e capa em uma única aba",()=>{
  const html=readFileSync(new URL("../public/admin.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../public/admin.js",import.meta.url),"utf8");
  const siteStart=html.indexOf('id="site-pane"');
  const menuStart=html.indexOf('id="products-pane"');
  assert.ok(siteStart>0&&menuStart>siteStart);
  assert.doesNotMatch(html,/id="tab-products"/);
  assert.match(html,/data-tab="site">Editar app/);
  for(const id of ["site-preview","site-logo-file","site-cover-file","product-search","new-product","admin-products"])
    assert.ok(html.includes('id="'+id+'"'),id+" ausente");
  assert.match(js,/const paneKeys=\["orders","customers","finance","site"\]/);
  assert.match(js,/tab==="site"&&!productsLoaded/);
});
test("Financeiro e clientes disponíveis apenas após autenticação",()=>{
  const w=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../public/admin.html",import.meta.url),"utf8");
  for(const route of ["/api/admin/finance","/api/admin/customers","/api/admin/site","/api/admin/products"])
    assert.ok(w.includes(route),route+" ausente");
  for(const id of ["finance-pane","customers-pane","finance-received","admin-customers"])
    assert.ok(html.includes('id="'+id+'"'));
  assert.ok(w.indexOf('if(!(await sessionUser(request,env)))')<w.indexOf('if(path==="/api/admin/finance"'));
});
test("Pedido mostra número real e opção de copiar comprovante, nunca número falso em demonstração",()=>{
  const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../public/cardapio.js",import.meta.url),"utf8");
  for(const id of ["tracking-number","tracking-number-panel","tracking-copy","tracking-number-copy"])
    assert.ok(html.includes('id="'+id+'"'));
  assert.match(js,/Pedido #/);
  assert.match(js,/navigator\.clipboard\.writeText/);
  assert.match(js,/Nenhum pedido foi enviado ao BN/);
  assert.match(js,/byId\("tracking-number-panel"\)\.hidden=true/);
  assert.match(js,/loadSiteAppearance/);
});

test("editor visual abre a página verdadeira, com canetinhas apenas após sessão autenticada",()=>{
  const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  const admin=readFileSync(new URL("../public/admin.html",import.meta.url),"utf8");
  const editor=readFileSync(new URL("../public/editor.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../public/editor.css",import.meta.url),"utf8");
  const client=readFileSync(new URL("../public/cardapio.js",import.meta.url),"utf8");
  assert.ok(admin.includes('href="/?editar=1"'));
  assert.ok(html.includes('src="./editor.js"'));
  assert.ok(html.includes('href="./editor.css"'));
  assert.match(editor,/searchParams\.get\("editar"\)!=="1"/);
  assert.match(editor,/request\("\/api\/admin\/session"\)/);
  assert.match(editor,/if\(!session\.authenticated\)\{location\.replace\("\/admin\.html"\);return;\}/);
  assert.ok(editor.indexOf('if(!session.authenticated)')<editor.indexOf('document.body.classList.add("bn-edit-mode")'));
  assert.match(editor,/contenteditable/);
  assert.match(editor,/bn-save-bottom/);
  assert.match(editor,/bn-cancel-edit/);
  assert.match(editor,/bn-view-as-customer/);
  assert.match(editor,/bn-cover-image/);
  assert.match(editor,/bn-logo-image/);
  assert.match(editor,/bn-product-edit/);
  assert.match(editor,/\/api\/admin\/products/);
  assert.match(css,/\.bn-edit-inline/);
  assert.match(client,/bn-editor-products/);
  assert.ok(admin.includes('<details class="visual-advanced"'));
  assert.ok(admin.includes('id="products-pane"'));
});

test("capa personalizada oculta o hamburguinho ilustrativo para nao sobrepor a foto",()=>{
  const css=readFileSync(new URL("../public/cardapio.css",import.meta.url),"utf8");
  assert.match(css,/\.hero\.has-cover\s+\.burger\{display:none\}/);
  assert.doesNotMatch(css,/\.hero\.has-cover\s+\.burger\{opacity:/);
});


test("pedidos WhatsApp: somente admin recebe telefone e mensagem pronta exige clique",()=>{
  const server=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
  const admin=readFileSync(new URL("../public/admin.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../public/admin.css",import.meta.url),"utf8");
  assert.match(server,/function adminOrderDto\(row\)\{return \{\.\.\.orderDto\(row\),phone:row\.phone\};\}/);
  assert.match(server,/\.map\(adminOrderDto\)/);
  assert.match(server,/if\(!\(await sessionUser\(request,env\)\)\)return error\("Entre como administrador\.",401\)/);
  const dto=server.slice(server.indexOf("function orderDto(row)"),server.indexOf("function adminOrderDto(row)"));
  assert.doesNotMatch(dto,/phone:/);
  assert.match(admin,/function whatsappMessage\(o\)/);
  assert.match(admin,/Seu pedido \*#/);
  assert.match(admin,/PRONTO PARA RETIRADA/);
  assert.match(admin,/https:\/\/wa\.me\/55/);
  assert.match(admin,/encodeURIComponent\(whatsappMessage\(o\)\)/);
  assert.match(admin,/target="_blank" rel="noopener noreferrer"/);
  assert.match(admin,/Confira e toque em enviar/);
  assert.match(css,/\.admin-whatsapp/);
});

test("cadastro e exclusao logica de produtos preservam historico de pedidos",()=>{
  const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
  const admin=readFileSync(new URL("../public/admin.js",import.meta.url),"utf8");
  const visual=readFileSync(new URL("../public/editor.js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../public/admin.html",import.meta.url),"utf8");
  const client=readFileSync(new URL("../public/cardapio.js",import.meta.url),"utf8");
  assert.match(worker,/async function archiveProduct\(request,env,productId\)/);
  assert.match(worker,/archived_at:input\.archive\?new Date\(\)\.toISOString\(\):null/);
  assert.match(worker,/archived_at=is\.null/);
  assert.match(worker,/p\.archived_at/);
  assert.match(worker,/archiveMatch&&request\.method==="PATCH"/);
  assert.doesNotMatch(worker,/dbRequest\(env,"bn_products","DELETE"/);
  assert.ok(html.includes('id="quick-new-product"'));
  assert.ok(html.includes('id="show-archived-products"'));
  assert.match(admin,/data-archive-product/);
  assert.match(admin,/show-archived-products/);
  assert.match(admin,/archive","PATCH",\{archive\}/);
  assert.match(visual,/id="bn-p-archive"/);
  assert.match(visual,/async function archiveCurrentProduct/);
  assert.match(visual,/id="bn-add-new-product"/);
  assert.match(visual,/title\.insertAdjacentElement\("afterend",add\)/);
  assert.match(client,/archivedAt:p\.archivedAt\|\|null/);
  assert.doesNotMatch(client,/if\(valid\.length===0\)return/);
});
