// Cardápio digital — demonstração segura, sem pedidos reais.
const categories = ["Todos", "Hambúrgueres", "Hot-dogs", "Frango", "Porções", "Bebidas", "Sobremesas"];
const product = (id, name, cents, category, desc = "") => ({ id, name, cents, category, desc });
const menu = [
  product("misto","Misto",1900,"Hambúrgueres","Pão, maionese, tomate, presunto e mussarela."),
  product("mistao","Mistão",2100,"Hambúrgueres","Pão, maionese, tomate, presunto, ovo e mussarela."),
  product("x-burguer","X-Burguer",2400,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres e mussarela."),
  product("x-salada","X-Salada",2600,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, salada e mussarela."),
  product("x-acebolado","X-Acebolado",2800,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, cebola e mussarela."),
  product("x-azeitonado","X-Azeitonado",2700,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, azeitona e mussarela."),
  product("x-catupiry","X-Catupiry",2800,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, catupiry e mussarela."),
  product("x-calabresa","X-Calabresa",2800,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, calabresa e mussarela."),
  product("x-vegetariano","X-Vegetariano",2400,"Hambúrgueres","Pão, maionese, tomate, alface, azeitona, milho, ovo, catupiry e mussarela."),
  product("x-hamburgao","X-Hamburgão",2700,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, ovo, presunto e mussarela."),
  product("x-americano","X-Americano",2800,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, ovo, alface, presunto e mussarela."),
  product("x-milho","X-Milho",2700,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, milho e mussarela."),
  product("x-bacon","X-Bacon",2800,"Hambúrgueres","Pão, maionese, tomate, 2 hambúrgueres, bacon e mussarela."),
  product("x-tudo","X-Tudo",3300,"Hambúrgueres","Pão, maionese, tomate, milho, azeitona, 2 hambúrgueres, bacon, ovo, catupiry, presunto e mussarela."),
  product("x-super-tudo","X-Super Tudo",3800,"Hambúrgueres","Pão, maionese, tomate, milho, azeitona, 2 hambúrgueres, 2 salsichas, bacon, ovo, catupiry, presunto e mussarela."),
  product("x-especial-bn","X-Especial BN",4400,"Hambúrgueres","Pão, maionese, tomate, milho, azeitona, 2 hambúrgueres, bacon, ovo, frango, catupiry, presunto e mussarela."),
  product("hot-tradicional","Hot-dog Tradicional",1300,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas e batata palha."),
  product("hot-americano","Hot-dog Americano",2199,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, alface, ovo, presunto e batata palha."),
  product("hot-bacon","Hot-dog Bacon",2199,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, bacon e batata palha."),
  product("hot-egg","Hot-dog Egg",1600,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, ovo e batata palha."),
  product("hot-frango","Hot-dog Frango",2200,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, frango e batata palha."),
  product("hot-cheddar","Hot-dog Cheddar",2199,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, cheddar e batata palha."),
  product("hot-catupiry","Hot-dog Catupiry",2199,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, catupiry e batata palha."),
  product("hot-frango-catupiry","Hot-dog Frango Catupiry",2799,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, frango, catupiry e batata palha."),
  product("hot-burguer","Hot-dog Burguer",2700,"Hot-dogs","Pão, maionese, ketchup, mostarda, 2 salsichas, 2 hambúrgueres e batata palha."),
  product("hot-tudo","Hot-dog Tudo",2500,"Hot-dogs","Pão, maionese, ketchup, mostarda, milho, azeitona, salsichas, ovo, bacon, catupiry e batata palha."),
  product("frango","X-Frango",2799,"Frango","Pão, maionese, tomate, frango e mussarela."),
  product("frango-catupiry","X-Frango Catupiry",3299,"Frango","Pão, maionese, tomate, frango, catupiry e mussarela."),
  product("frango-tudo","X-Frango Tudo",3500,"Frango","Pão, maionese, tomate, milho, azeitona, frango, bacon, ovo, presunto, catupiry e mussarela."),
  product("frango-hamburgao","X-Frango Hamburgão",2999,"Frango","Pão, maionese, tomate, frango, presunto, ovo e mussarela."),
  product("frango-bacon","X-Frango Bacon",3300,"Frango","Pão, maionese, tomate, frango, bacon e mussarela."),
  product("frango-cheddar","X-Frango Cheddar",3299,"Frango","Pão, maionese, tomate, frango, cheddar e mussarela."),
  product("frango-americano","X-Frango Americano",3199,"Frango","Pão, maionese, tomate, frango, presunto, alface, ovo e mussarela."),
  product("frango-caipira","X-Frango Caipira",3400,"Frango","Pão, maionese, tomate, milho, frango, catupiry, cebola e mussarela."),
  product("frango-salada","X-Frango Salada",2899,"Frango","Pão, maionese, tomate, frango, alface e mussarela."),
  product("frango-azeitonado","X-Frango Azeitonado",2900,"Frango","Pão, maionese, tomate, frango, azeitona e mussarela."),
  product("frango-milho","X-Frango Milho",2700,"Frango","Pão, maionese, tomate, frango, milho e mussarela."),
  product("batata","Batata frita 500 g",2000,"Porções","Porção de batata frita de 500 gramas."),
  product("batata-cheddar","Batata c/ cheddar e bacon 500 g",2499,"Porções","Batata frita com cheddar e bacon, 500 gramas."),
  product("pastelzinho","Pastelzinho de chocolate",499,"Sobremesas","Pastelzinho recheado com chocolate."),
  product("coca-lata","Coca-Cola lata 350 ml",500,"Bebidas"),
  product("fanta-lata","Fanta lata 350 ml",500,"Bebidas"),
  product("sprite-lata","Sprite lata 350 ml",500,"Bebidas"),
  product("coca-2l","Coca-Cola 2 litros",1200,"Bebidas"),
  product("sprite-2l","Sprite 2 litros",1100,"Bebidas"),
  product("fanta-laranja-2l","Fanta Laranja 2 litros",1100,"Bebidas"),
  product("fanta-uva-2l","Fanta Uva 2 litros",1100,"Bebidas"),
  product("guarana-maca-2l","Guaraná São Carlos Maçã 2 litros",700,"Bebidas")
];
const extras = [
  ["Catupiry",400],["Presunto (2 fatias)",300],["Azeitona",300],["Frango",600],["Lombo",600],["Alface",200],
  ["Mussarela (2 fatias)",400],["Bacon",600],["Ovo",300],["Milho",300],["Cebola",300],["Carne de hambúrguer",600]
].map(([name,cents])=>({name,cents}));
const centsMoney = cents => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents / 100);
const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const byId = id => document.getElementById(id);
const clientStorageKey = "bn-lanches:lembrar-cliente:v1";
const cart = [];
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
 byId("products").innerHTML=found.map(p=>'<article class="product"><div class="product-photo" aria-hidden="true">'+emoji(p)+'</div><div class="product-content"><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.desc||p.category)+'</p><div class="product-bottom"><strong class="price">'+escapeHtml(centsMoney(p.cents))+'</strong><button type="button" data-product="'+escapeHtml(p.id)+'">Adicionar +</button></div></div></article>').join("");
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
 close("item-dialog");renderCart();message("Produto adicionado ao carrinho!");
}
function readRemembered(){
 try{
  const s=JSON.parse(localStorage.getItem(clientStorageKey)||"null");
  if(s && typeof s.name==="string" && typeof s.phone==="string"){
   byId("client-name").value=s.name;
   byId("client-phone").value=s.phone;
   byId("remember").checked=true;
  }
 }catch{}
}
function validBrazilPhone(phone){
 const digits=phone.replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"");
 return /^\d{10,11}$/.test(digits) && Number(digits.slice(0,2))>=11;
}
function previewTracking(evt){
 evt.preventDefault();
 if(!cart.length)return message("Escolha pelo menos um produto.");
 const name=byId("client-name").value.trim(),phone=byId("client-phone").value.trim();
 if(name.length<2){byId("client-name").setCustomValidity("Informe seu nome.");byId("client-name").reportValidity();return;}
 if(!validBrazilPhone(phone)){byId("client-phone").setCustomValidity("Digite um WhatsApp com DDD, por exemplo (16) 99999-9999.");byId("client-phone").reportValidity();return;}
 if(byId("remember").checked){
  try{localStorage.setItem(clientStorageKey,JSON.stringify({name,phone}));}catch{}
 }else{try{localStorage.removeItem(clientStorageKey);}catch{}}
 byId("tracking-title").textContent="Pedido de exemplo";
 byId("tracking-greeting").textContent=name+", este é o acompanhamento que você verá quando o sistema estiver ativo. Nenhum pedido foi enviado ao BN.";
 close("checkout-dialog");
 dialog("tracking-dialog");
 message("Simulação concluída. Nenhum pedido real foi criado.");
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
 const i=Number(b.dataset.remove);if(Number.isInteger(i)&&i>=0&&i<cart.length){cart.splice(i,1);renderCart();}
});
byId("checkout-open").addEventListener("click",()=>{
 if(!cart.length)return;
 byId("checkout-total").textContent=centsMoney(cartTotal());
 readRemembered();close("cart-dialog");dialog("checkout-dialog");
});
byId("checkout").addEventListener("submit",previewTracking);
byId("client-name").addEventListener("input",()=>byId("client-name").setCustomValidity(""));
byId("client-phone").addEventListener("input",()=>byId("client-phone").setCustomValidity(""));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>close(b.dataset.close)));
categoriesHtml();renderMenu();updateCartButton();
