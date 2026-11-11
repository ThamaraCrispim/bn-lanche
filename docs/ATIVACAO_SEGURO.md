# BN Lanches — ativação segura (Cloudflare Workers + D1)

## Publicação
O GitHub contém o site unificado e uma API preparada para pedidos. Enquanto o banco e os segredos não estiverem configurados, a API retorna erro controlado e **não recebe pedidos reais**. Não compartilhe o endereço com clientes ainda.

## 1. Banco D1
Crie um banco chamado `bn-lanche-db` em Cloudflare > Storage & databases > D1, no plano gratuito. No Worker `bn-lanche`, adicione uma vinculação D1 com o nome exato `DB` apontando para esse banco (binding). Execute o conteúdo de `db/schema.sql` no console SQL desse banco antes de ativar pedidos.

Não coloque IDs de banco, senhas ou tokens no GitHub. Se preferir usar Wrangler CLI, siga a documentação atual da Cloudflare.

## 2. Segredos do Worker
Em Workers & Pages > bn-lanche > Settings > Variables and Secrets, crie os seguintes **Secrets** (não como texto público):
- `ADMIN_USERNAME`: nome de usuário escolhido pelo proprietário.
- `ADMIN_PASSWORD`: senha longa e exclusiva, criada pelo proprietário.
- `SESSION_SECRET`: valor secreto aleatório forte (mínimo 32 caracteres).
- `TRACKING_SECRET`: outro valor secreto aleatório, diferente do anterior.

Não compartilhe senhas ou secrets pelo chat. Nunca ponha essas configurações no JavaScript do navegador.

## 3. Pedidos reais
Depois de configurar D1 + secrets e TESTAR com pedidos fictícios, adicione a variável `ORDERS_ENABLED` com valor `true` nas configurações do Worker e publique.

Configure proteção contra spam (recomendado: Cloudflare Turnstile) e backups regulares antes de receber pedidos reais. O código já inclui validações de produto/valor e bloqueio simples de pedidos repetidos, mas não é suficiente para evitar todo abuso.

## 4. Como o cliente acompanha
Após finalizar, o cliente recebe link privado e código de recuperação. Atualizar a página não apaga o ticket, e o aparelho guarda o link se o armazenamento local estiver habilitado. Para recuperar em outro aparelho, usa WhatsApp + código. **Somente o WhatsApp não é suficiente por segurança**, já que terceiros poderiam conhecer esse número.

## 5. Administração
No mesmo site, menu > Entrar como administrador. O painel exige usuário e senha e carrega pedidos do banco. O BN aceita, marca pronto, confirma pagamento e marca retirada.

A API usa cookie de sessão HttpOnly/Secure/SameSite=Strict e limita tentativas de login. Ainda é preciso testar os fluxos no ambiente publicado.

## 6. Fluxos a testar antes de divulgar
1. Pedido simples, adicional, observação e preço calculado no servidor
2. Atualização de página com carrinho, nome e WhatsApp preservados
3. Pedido gerado e recuperação por WhatsApp + código em outro dispositivo
4. Dois pedidos simultâneos e envio duplicado
5. Login com senha errada, senha correta e saída
6. Aceitar > Pronto > Pagamento > Retirada e acompanhamento do cliente
7. Loja offline e fluxo de contingência por telefone/WhatsApp
8. Testes em Android e iPhone no horário de atendimento

**Nota:** esta versão não inclui edição de fotos/preços via painel nem notificações nativas em segundo plano. São módulos futuros.
