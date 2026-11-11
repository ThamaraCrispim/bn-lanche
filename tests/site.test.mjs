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
