import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import worker from "../src/worker.js";

test("fluxo completo: pedido real, acompanhamento e exibição para a cozinha", async () => {
  const origin="https://bn-lanche.example";
  const env={
    SUPABASE_URL:"https://teste.supabase.co",
    SUPABASE_SECRET_KEY:"sb_secret_mock_only",
    ADMIN_USERNAME:"bn_admin",
    ADMIN_PASSWORD:"test-password-not-real",
    SESSION_SECRET:"local-test-secret-at-least-32-characters",
    TRACKING_SECRET:"local-track-secret-at-least-32-characters",
    ORDERS_ENABLED:"true"
  };
  const orders=[];
  const prevFetch=globalThis.fetch;
  globalThis.fetch=async (input,init={})=>{
    const u=new URL(input);
    assert.equal(u.origin,"https://teste.supabase.co");
    const table=u.pathname.split("/").pop();
    if(table==="bn_products"){
      return Response.json([{id:"misto",name:"Misto",cents:1900,category:"Hambúrgueres",available:true}]);
    }
    if(table==="bn_login_attempts"){
      return Response.json(init.method==="DELETE"?null:[]);
    }
    if(table==="bn_orders"){
      if(init.method==="POST"){
        const row={id:1,...JSON.parse(init.body)};
        orders.push(row);
        return Response.json([row],{status:201});
      }
      if(init.method==="GET"){
        const targetKey=u.searchParams.get("request_key");
        const token=u.searchParams.get("tracking_token");
        if(targetKey)return Response.json(orders.filter(o=>o.request_key===targetKey.slice(3)));
        if(token)return Response.json(orders.filter(o=>o.tracking_token===token.slice(3)));
        const status=u.searchParams.get("status");
        return Response.json(status==="in.(novo,aceito,pronto)"?orders.filter(o=>o.status==="novo"):orders);
      }
    }
    throw Error("Requisição de banco inesperada: "+u.pathname+" "+init.method);
  };
  try{
    const health=await worker.fetch(new Request(origin+"/api/config"),env);
    assert.equal((await health.json()).ordersEnabled,true);
    const order=await worker.fetch(new Request(origin+"/api/orders",{
      method:"POST",
      headers:{"content-type":"application/json","Origin":origin},
      body:JSON.stringify({
        name:"Cliente de teste",
        phone:"16999999999",
        paymentMethod:"pix",
        requestId:crypto.randomUUID(),
        items:[{id:"misto",quantity:2,extraIds:[0],note:"Sem tomate"}]
      })
    }),env);
    assert.equal(order.status,201);
    const receipt=await order.json();
    assert.equal(receipt.number,1);
    assert.equal(receipt.totalCents,4600);
    assert.equal(receipt.items[0].extras[0].name,"Catupiry");
    assert.match(receipt.token,/^[a-f0-9]{48}$/);
    assert.match(receipt.code,/^[A-Z2-9]{10}$/);
    const tracked=await worker.fetch(new Request(origin+"/api/track/"+receipt.token),env);
    assert.equal(tracked.status,200);
    assert.equal((await tracked.json()).status,"novo");
    const denied=await worker.fetch(new Request(origin+"/api/admin/orders"),env);
    assert.equal(denied.status,401);
    const login=await worker.fetch(new Request(origin+"/api/admin/login",{
      method:"POST",headers:{"content-type":"application/json","Origin":origin},
      body:JSON.stringify({username:"bn_admin",password:"test-password-not-real"})
    }),env);
    assert.equal(login.status,200);
    const cookie=login.headers.get("set-cookie")?.split(";")[0];
    assert.match(cookie,/^bn_session=/);
    const incoming=await worker.fetch(new Request(origin+"/api/admin/orders",{
      headers:{Cookie:cookie}
    }),env);
    assert.equal(incoming.status,200);
    const list=await incoming.json();
    assert.equal(list.orders.length,1);
    assert.equal(list.orders[0].number,receipt.number);
  }finally{
    globalThis.fetch=prevFetch;
  }
});
