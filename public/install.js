(() => {
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
  let deferred;
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferred=event; });
  const button=document.getElementById("install-app");
  if (!button) return;
  button.addEventListener("click", async () => {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      alert("O aplicativo já está aberto no modo instalado.");
      return;
    }
    if (deferred) {
      const prompt=deferred;
      deferred=null;
      try { await prompt.prompt(); await prompt.userChoice; } catch {}
      return;
    }
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
    const message=ios
      ? "Para instalar o BN Lanches: toque em Compartilhar e escolha 'Adicionar à Tela de Início'."
      : "Para instalar o BN Lanches: abra o menu do navegador (⋮) e escolha 'Instalar app' ou 'Adicionar à tela inicial'.";
    alert(message);
  });
})();