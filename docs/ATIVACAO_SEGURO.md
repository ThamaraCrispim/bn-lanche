# BN Lanches — ativação com Cloudflare + Supabase

O aplicativo permanece publicado no mesmo domínio da Cloudflare. A interface do cliente está em \`/\`, e o administrador em \`/admin.html\`.

## Status atual
- Supabase \`bn-lanches\`: projeto criado, na região São Paulo.
- Banco de produção criado: \`public.bn_orders\` e \`public.bn_login_attempts\`, ambos com RLS e sem acesso público direto.
- API do Worker adaptada para consultar Supabase via REST no backend.
- **Pedidos reais continuam desativados** até adicionar credenciais, fazer testes e confirmar o funcionamento.

## 1. Configurar segredos sem colocá-los no GitHub

No painel do Cloudflare Workers do projeto \`bn-lanche\`, abra **Settings → Variables and Secrets**.

Cadastre as seguintes variáveis/segredos:
- \`SUPABASE_URL\` — valor exato: \`https://wmtgqompgrthddznazdz.supabase.co\` (pode ser variável comum; não é senha).
- \`SUPABASE_SECRET_KEY\` — crie/copie no painel do projeto BN Lanches em Supabase → Project Settings → API Keys, tipo **secret key** (\`sb_secret_...\`); guardar como **Secret**.
- \`ADMIN_USERNAME\` — login desejado pelo BN; Secret.
- \`ADMIN_PASSWORD\` — senha exclusiva e longa escolhida pelo BN; Secret.
- \`SESSION_SECRET\` — string aleatória forte (mínimo 32 bytes); Secret.
- \`TRACKING_SECRET\` — outra string aleatória forte (mínimo 32 bytes); Secret.

**Não compartilhe nenhum desses valores secretos pelo chat ou em prints.** O Worker usa \`SUPABASE_SECRET_KEY\` somente no servidor. Nunca coloque essa chave no \`public/\` e nunca faça commit dela.

Não defina \`ORDERS_ENABLED=true\` até validar o login e os pedidos fictícios de ponta a ponta.

## 2. Publicação e login
Confirme em **Workers & Pages → bn-lanche → Deployments** que o deploy do commit com backend Supabase concluiu com sucesso. Abra \`/api/config\`:
- Com todos os segredos configurados, \`adminEnabled\` deverá ser \`true\`.
- \`ordersEnabled\` deve ficar \`false\` até a homologação.

Acesse \`/admin.html\` e teste login correto e incorreto sem enviar senhas no chat.

## 3. Testar pedidos
Quando login, banco e domínio estiverem corretos, habilite temporariamente \`ORDERS_ENABLED=true\` em ambiente de testes controlado.
- Faça um pedido fictício pelo cardápio.
- Verifique o aparecimento no painel do BN.
- Faça Aceitar → Pronto → Confirmar pagamento → Confirmar retirada.
- Confira acompanhamento por link e por WhatsApp + código.
- Teste atualizar a página, duplicações e falhas de rede.

Durante o teste, use nomes/dados fictícios. Só compartilhe o link com clientes quando passar na homologação e configurar proteção antispam e plano de contingência.

## 4. Segurança e custos
Supabase Free: controle uso de banco, banda e possíveis pausas de projeto. Cloudflare Free: respeite limites de requisições; planos gratuitos não garantem disponibilidade para um negócio.
O sistema ainda não tem painel de edição de cardápio/fotos, alertas confiáveis com celular fechado, backups automatizados e uma proteção antispam robusta. Antes de produção real, esses itens precisam de atenção.

O Bella Agenda não participa da infraestrutura nem do banco BN Lanches.
