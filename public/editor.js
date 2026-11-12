/* Editor visual. Todas as gravacoes usam a API autenticada do painel. */
(() => {
  "use strict";
  if(new URL(location.href).searchParams.get("editar")!=="1")return;
  const $=id=>document.getElementById(id);
  const FORMATS=["image/jpeg","image/png","image/webp"];
  const keys={
    storeName:"store-header-name",
    tagline:"store-tagline",
    heroTitle:"store-hero-title",
    heroEmphasis:"store-hero-emphasis",
    heroDescription:"store-hero-description"
  };
  const limits={
    storeName:[2,70],
    tagline:[0,110],
    heroTitle:[2,90],
    heroEmphasis:[2,70],
    heroDescription:[0,240]
  };
  const categories=["Hambúrgueres","Hot-dogs","Frango","Porções","Bebidas","Sobremesas"];
  const imageBase="https://wmtgqompgrthddznazdz.supabase.co/storage/v1/object/public/bn-menu/";
  let site=null,products=[],pendingLogo=null,pendingCover=null;
  let activeProduct=null,removeProductPhoto=false;
  let saving=false,dirty=false,toastTimer=null;

  async function request(path,options={}){
    const r=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});
    let data={};
    try{data=await r.json();}catch{}
    if(!r.ok)throw Error(data.error||"Não foi possível salvar a alteração.");
    return data;
  }
  const clean=s=>String(s||"").replace(/\s+/g," ").trim();
  const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function isGoodImageUrl(str){
    return typeof str==="string"&&str.startsWith(imageBase)&&(()=>{try{const u=new URL(str);return u.protocol==="https:"&&u.hostname==="wmtgqompgrthddznazdz.supabase.co";}catch{return false;}})();
  }
  function toast(msg,problem=false){
    let area=$("bn-editor-toast");
    if(!area){area=document.createElement("div");area.id="bn-editor-toast";area.className="bn-editor-toast";area.setAttribute("role","status");document.body.append(area);}
    area.textContent=msg;area.classList.toggle("is-error",problem);
    area.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{area.hidden=true;},6000);
  }
  function markDirty(){
    dirty=true;
    document.querySelectorAll("[data-bn-unsaved]").forEach(x=>x.textContent="● Alterações não salvas");
  }
  function markClean(){
    dirty=false;
    document.querySelectorAll("[data-bn-unsaved]").forEach(x=>x.textContent="✓ Tudo salvo");
  }
  function renderToolbar(){
    const toolbar=document.createElement("div");
    toolbar.className="bn-editor-toolbar";
    toolbar.innerHTML='<div class="bn-editor-toolbar-title"><span>✎</span><div><strong>Editando BN Lanches</strong><small data-bn-unsaved>✓ Tudo salvo</small></div></div>'+
      '<div class="bn-editor-toolbar-actions">'+
        '<button class="bn-editor-btn" id="bn-view-as-customer" type="button">Ver como cliente ↗</button>'+
        '<a class="bn-editor-btn" id="bn-exit-editor" href="/admin.html">✕ Sair</a>'+
        '<button class="bn-editor-btn primary-action" id="bn-save-top" type="button">Salvar alterações</button></div>';
    document.body.prepend(toolbar);
    const bottom=document.createElement("div");
    bottom.className="bn-editor-bottom";
    bottom.innerHTML='<p>Toque nas <b>canetinhas ✎</b> para editar. As alterações são publicadas ao salvar.</p>'+
      '<button id="bn-cancel-edit" class="bn-cancel-edit" type="button">Cancelar</button>'+
      '<button id="bn-save-bottom" type="button">Salvar alterações</button>';
    document.body.append(bottom);
    $("bn-save-top").addEventListener("click",saveChanges);
    $("bn-save-bottom").addEventListener("click",saveChanges);
    $("bn-cancel-edit").addEventListener("click",()=>{
      if(dirty&&!confirm("Cancelar as alterações que ainda não foram salvas?"))return;
      dirty=false;
      location.assign("/admin.html");
    });
    $("bn-view-as-customer").addEventListener("click",()=>{
      if(dirty&&!confirm("Há alterações ainda não salvas. Ver a página publicada mesmo assim?"))return;
      window.open("/","_blank","noopener,noreferrer");
    });
    $("bn-exit-editor").addEventListener("click",evt=>{
      if(dirty){
        if(!confirm("Sair sem salvar as alterações?"))evt.preventDefault();
        else dirty=false;
      }
    });
  }
  function editableText(){
    for(const [key,id] of Object.entries(keys)){
      const element=$(id);
      if(!element)continue;
      const pencil=document.createElement("button");
      pencil.type="button";pencil.className="bn-edit-inline";
      pencil.textContent="✎";pencil.title="Editar "+key;
      pencil.setAttribute("aria-label","Editar "+key);
      pencil.addEventListener("click",()=>{
        element.setAttribute("contenteditable","true");
        element.setAttribute("spellcheck","true");
        element.focus();
        toast("Digite o novo texto e toque em Salvar alterações.");
      });
      element.addEventListener("input",()=>{
        markDirty();
        if(key==="storeName"&&$("store-footer-name"))$("store-footer-name").textContent=element.textContent;
      });
      element.addEventListener("keydown",evt=>{
        if(evt.key==="Enter"){evt.preventDefault();element.blur();}
      });
      element.insertAdjacentElement("afterend",pencil);
    }
  }
  function imagePreview(file,kind){
    const link=URL.createObjectURL(file);
    if(kind==="logo"){
      const logo=$("store-logo");
      logo.onload=()=>URL.revokeObjectURL(link);
      logo.src=link;
    }else{
      const hero=document.querySelector(".hero");
      hero.style.backgroundImage='linear-gradient(90deg,rgba(12,9,8,.85),rgba(12,9,8,.43)),url("'+link+'")';
      hero.style.backgroundSize="cover";
      hero.style.backgroundPosition="center";
      hero.classList.add("has-cover");
    }
  }
  function validateImage(file,maxBytes){
    if(!file)return "Escolha uma imagem primeiro.";
    if(!FORMATS.includes(file.type))return "Escolha JPG, PNG ou WebP.";
    if(file.size>maxBytes)return "Imagem muito grande. Reduza o tamanho e tente novamente.";
    return "";
  }
  function addImageControls(){
    const brand=document.querySelector(".brand");
    if(brand){
      const box=document.createElement("div");
      box.className="bn-logo-edit";
      box.innerHTML='<label for="bn-logo-image" class="bn-edit-inline" title="Trocar logomarca" aria-label="Trocar logomarca">✎</label>'+
        '<input class="bn-edit-image-input" type="file" id="bn-logo-image" accept="image/jpeg,image/png,image/webp">';
      brand.append(box);
      $("bn-logo-image").addEventListener("change",event=>{
        const file=event.target.files?.[0];
        const err=validateImage(file,2*1024*1024);
        if(err)return toast(err,true);
        pendingLogo=file;imagePreview(file,"logo");markDirty();toast("Prévia da nova logomarca. Toque em Salvar alterações.");
      });
    }
    const hero=document.querySelector(".hero");
    if(hero){
      const box=document.createElement("div");
      box.className="bn-cover-tools";
      box.innerHTML='<label for="bn-cover-image" class="bn-edit-on-photo">✎ Alterar capa</label>'+
        '<input class="bn-edit-image-input" id="bn-cover-image" type="file" accept="image/jpeg,image/png,image/webp">'+
        '<button type="button" class="bn-edit-photo-reset" id="bn-remove-cover">Remover capa</button>';
      hero.append(box);
      $("bn-cover-image").addEventListener("change",event=>{
        const file=event.target.files?.[0];
        const err=validateImage(file,5*1024*1024);
        if(err)return toast(err,true);
        pendingCover=file;imagePreview(file,"cover");markDirty();toast("Prévia da nova capa. Toque em Salvar alterações.");
      });
      $("bn-remove-cover").addEventListener("click",async()=>{
        if(dirty)return toast("Salve ou cancele as alterações pendentes antes de remover a capa.",true);
        if(!confirm("Remover a foto de capa publicada?"))return;
        try{
          await request("/api/admin/site/cover",{method:"DELETE"});
          pendingCover=null;
          await refreshPublic();
          toast("Capa removida.");
        }catch(e){toast(e.message,true);}
      });
    }
  }
  function readValues(){
    const payload={};
    for(const [key,id] of Object.entries(keys)){
      const value=clean($(id)?.textContent);
      const [min,max]=limits[key];
      if(value.length<min||value.length>max){
        $(id)?.focus();
        throw Error("O texto de "+key+" precisa ter entre "+min+" e "+max+" caracteres.");
      }
      payload[key]=value;
    }
    return payload;
  }
  async function uploadSite(kind,file){
    const err=validateImage(file,kind==="logo"?2*1024*1024:5*1024*1024);
    if(err)throw Error(err);
    return request("/api/admin/site/"+kind,{method:"POST",headers:{"Content-Type":file.type},body:file});
  }
  async function refreshPublic(){
    if(typeof window.bnEditorRefresh==="function")await window.bnEditorRefresh();
    // The load module may still be initializing on slower phones.
    const result=await request("/api/admin/site");
    site=result.site;
  }
  async function saveChanges(){
    if(saving)return;
    let payload;
    try{payload=readValues();}catch(e){toast(e.message,true);return;}
    saving=true;
    $("bn-save-top").disabled=true;$("bn-save-bottom").disabled=true;
    $("bn-save-top").textContent="Salvando...";
    $("bn-save-bottom").textContent="Salvando...";
    try{
      const changed=Object.keys(keys).some(key=>payload[key]!==clean(site?.[key]));
      if(changed){
        const result=await request("/api/admin/site",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        site=result.site;
      }
      if(pendingLogo){site=(await uploadSite("logo",pendingLogo)).site;pendingLogo=null;}
      if(pendingCover){site=(await uploadSite("cover",pendingCover)).site;pendingCover=null;}
      await refreshPublic();
      for(const el of document.querySelectorAll("[contenteditable=true]"))el.removeAttribute("contenteditable");
      markClean();toast("Alterações publicadas! Use Ver como cliente para conferir.");
    }catch(e){toast("Não foi possível concluir: "+e.message,true);}
    finally{saving=false;$("bn-save-top").disabled=false;$("bn-save-bottom").disabled=false;$("bn-save-top").textContent="Salvar alterações";$("bn-save-bottom").textContent="Salvar alterações";}
  }
  function createProductDialog(){
    const dialog=document.createElement("dialog");
    dialog.id="bn-product-modal";dialog.className="bn-editor-dialog";
    dialog.innerHTML='<div class="bn-editor-dialog-header"><strong id="bn-product-heading">Editar produto</strong><button type="button" id="bn-product-close" aria-label="Fechar">×</button></div>'+
      '<form class="bn-editor-form" id="bn-edit-product-form">'+
      '<label class="bn-editor-field">Nome do produto<input id="bn-p-name" required maxlength="100"></label>'+
      '<label class="bn-editor-field">Categoria<select id="bn-p-category">'+categories.map(c=>'<option>'+escape(c)+'</option>').join("")+'</select></label>'+
      '<label class="bn-editor-field">Preço (R$)<input id="bn-p-price" required type="number" min="0.01" max="2000" step="0.01"></label>'+
      '<label class="bn-editor-field">Descrição e ingredientes<textarea id="bn-p-desc" maxlength="800"></textarea></label>'+
      '<label class="bn-editor-availability"><input id="bn-p-available" type="checkbox" checked> Disponível no cardápio</label>'+
      '<div class="bn-editor-preview" id="bn-p-preview"><span>📷</span></div>'+
      '<label class="bn-editor-field">Foto do produto (JPG, PNG ou WebP, até 2 MB)<input id="bn-p-file" type="file" accept="image/jpeg,image/png,image/webp"></label>'+
      '<button id="bn-p-remove" class="bn-editor-btn" type="button" hidden>Remover foto atual</button>
      '<button id="bn-p-archive" class="bn-editor-archive" type="button" hidden>Retirar do cardápio</button>'+
      '<footer><button type="button" class="secondary" id="bn-p-cancel">Cancelar</button><button type="submit" id="bn-p-save">Salvar produto</button></footer>'+
      '</form>';
    document.body.append(dialog);
    $("bn-product-close").addEventListener("click",()=>dialog.close());
    $("bn-p-cancel").addEventListener("click",()=>dialog.close());
    $("bn-p-archive").addEventListener("click",archiveCurrentProduct);
    $("bn-p-remove").addEventListener("click",()=>{
      removeProductPhoto=true;
      $("bn-p-file").value="";
      $("bn-p-preview").innerHTML="<span>📷</span>";
      $("bn-p-remove").hidden=true;
    });
    $("bn-p-file").addEventListener("change",evt=>{
      const file=evt.target.files?.[0];
      if(!file)return;
      const err=validateImage(file,2*1024*1024);
      if(err){toast(err,true);evt.target.value="";return;}
      removeProductPhoto=false;
      const url=URL.createObjectURL(file);
      $("bn-p-preview").innerHTML='<img alt="Prévia da foto escolhida">';
      const img=$("bn-p-preview").querySelector("img");
      img.onload=()=>URL.revokeObjectURL(url);
      img.src=url;
    });
    $("bn-edit-product-form").addEventListener("submit",saveProduct);
    return dialog;
  }
  function openProduct(id=null){
    activeProduct=id?products.find(p=>p.id===id):null;
    if(id&&!activeProduct){toast("Produto não encontrado.",true);return;}
    removeProductPhoto=false;
    $("bn-product-heading").textContent=activeProduct?"Editar "+activeProduct.name:"Adicionar produto";
    $("bn-p-name").value=activeProduct?.name||"";
    $("bn-p-category").value=activeProduct?.category||categories[0];
    $("bn-p-price").value=activeProduct?(activeProduct.cents/100).toFixed(2):"";
    $("bn-p-desc").value=activeProduct?.desc||"";
    $("bn-p-available").checked=activeProduct?.available!==false;
    $("bn-p-archive").hidden=!activeProduct;
    $("bn-p-archive").textContent=activeProduct?.archivedAt?"↩ Restaurar no cardápio":"🗑 Retirar do cardápio";
    $("bn-p-archive").classList.toggle("is-restore",Boolean(activeProduct?.archivedAt));
    $("bn-p-file").value="";
    if(isGoodImageUrl(activeProduct?.photoUrl)){
      const img=document.createElement("img");
      img.alt="Foto atual";img.src=activeProduct.photoUrl;
      $("bn-p-preview").replaceChildren(img);
      $("bn-p-remove").hidden=false;
    }else{
      $("bn-p-preview").innerHTML="<span>📷</span>";
      $("bn-p-remove").hidden=true;
    }
    $("bn-product-modal").showModal();
  }
  async function archiveCurrentProduct(){
    const p=activeProduct;
    if(!p||saving)return;
    const archive=!p.archivedAt;
    const question=archive?
      'Retirar "'+p.name+'" do cardápio? Os clientes não poderão pedir esse produto, mas você poderá restaurá-lo. O histórico de pedidos será mantido.':
      'Restaurar "'+p.name+'" ao cardápio?';
    if(!confirm(question))return;
    saving=true;
    $("bn-p-archive").disabled=true;
    try{
      await request("/api/admin/products/"+encodeURIComponent(p.id)+"/archive",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({archive})
      });
      $("bn-product-modal").close();
      await loadProducts();
      toast(archive?"Produto retirado. Para restaurar, toque na canetinha novamente.":"Produto restaurado no cardápio!");
    }catch(e){toast("Não foi possível atualizar: "+e.message,true);}
    finally{saving=false;$("bn-p-archive").disabled=false;}
  }
  async function loadProducts(){
    const data=await request("/api/admin/products");
    products=Array.isArray(data.products)?data.products:[];
    window.dispatchEvent(new CustomEvent("bn-editor-products",{detail:{products}}));
    decorateProducts();
  }
  async function saveProduct(event){
    event.preventDefault();
    if(saving)return;
    const price=Math.round(Number($("bn-p-price").value)*100);
    const payload={
      name:clean($("bn-p-name").value),
      cents:price,
      category:$("bn-p-category").value,
      desc:$("bn-p-desc").value.trim(),
      available:$("bn-p-available").checked
    };
    if(payload.name.length<2||payload.name.length>100||!Number.isInteger(price)||price<1||price>200000){
      toast("Confira nome e preço do produto.",true);return;
    }
    const file=$("bn-p-file").files?.[0];
    if(file){
      const err=validateImage(file,2*1024*1024);
      if(err)return toast(err,true);
    }
    saving=true;$("bn-p-save").disabled=true;$("bn-p-save").textContent="Salvando...";
    try{
      const id=activeProduct?.id;
      const saved=await request(id?"/api/admin/products/"+encodeURIComponent(id):"/api/admin/products",{
        method:id?"PATCH":"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const productId=saved.product.id;
      if(removeProductPhoto&&id)await request("/api/admin/products/"+encodeURIComponent(productId)+"/photo",{method:"DELETE"});
      if(file)await request("/api/admin/products/"+encodeURIComponent(productId)+"/photo",{
        method:"POST",headers:{"Content-Type":file.type},body:file
      });
      $("bn-product-modal").close();
      await loadProducts();
      toast("Produto salvo! O cardápio dos clientes foi atualizado.");
    }catch(e){toast("Erro ao salvar produto: "+e.message,true);}
    finally{saving=false;$("bn-p-save").disabled=false;$("bn-p-save").textContent="Salvar produto";}
  }
  function decorateProducts(){
    const cards=[...$("products").querySelectorAll(".product")];
    for(const card of cards){
      const id=card.querySelector("[data-product]")?.dataset.product;
      if(!id||card.querySelector(".bn-product-edit"))continue;
      const button=document.createElement("button");
      button.type="button";
      button.className="bn-product-edit";
      button.textContent="✎";
      button.setAttribute("aria-label","Editar "+(products.find(p=>p.id===id)?.name||"produto"));
      button.addEventListener("click",event=>{
        event.stopPropagation();
        openProduct(id);
      });
      card.append(button);
      const p=products.find(p=>p.id===id);
      if(p?.archivedAt||p?.available===false){
        const state=document.createElement("span");
        state.className="bn-product-unavailable";
        state.textContent=p?.archivedAt?"Retirado do cardápio":"Indisponível";
        card.querySelector(".product-content")?.append(state);
      }
    }
  }
  function productControls(){
    const container=$("products");
    const observer=new MutationObserver(()=>{decorateProducts();});
    observer.observe(container,{childList:true});
    const section=$("cardapio");
    const add=document.createElement("button");
    add.type="button";add.id="bn-add-new-product";add.className="bn-editor-add-product";
    add.textContent="+ Adicionar novo produto";
    const title=section.querySelector(".title");
    if(title)title.insertAdjacentElement("afterend",add);
    else section.prepend(add);
    add.addEventListener("click",()=>openProduct());
  }
  async function init(){
    let session;
    try{session=await request("/api/admin/session");}
    catch{location.replace("/admin.html");return;}
    if(!session.authenticated){location.replace("/admin.html");return;}
    document.body.classList.add("bn-edit-mode");
    renderToolbar();
    createProductDialog();
    editableText();
    addImageControls();
    productControls();
    try{
      const results=await Promise.all([request("/api/admin/site"),request("/api/admin/products")]);
      site=results[0].site;
      products=results[1].products||[];
      window.dispatchEvent(new CustomEvent("bn-editor-products",{detail:{products}}));
      // Avoid text mismatch when the site request resolves after editor startup.
      if(site){
        for(const [key,id]of Object.entries(keys)){
          if(!$(id).isContentEditable)$(id).textContent=site[key]||"";
        }
      }
      decorateProducts();
      markClean();
      toast("Editor aberto. Toque nas canetinhas para alterar a página.");
    }catch(e){toast("Não foi possível carregar o editor: "+e.message,true);}
    window.addEventListener("beforeunload",event=>{
      if(dirty){event.preventDefault();event.returnValue="";}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();