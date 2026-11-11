// Regras de pedidos usadas pela interface de demonstração.
// A API/banco de dados deverá validar essas mesmas transições no servidor.
export const STATUS = Object.freeze({
  NOVO: "novo",
  ACEITO: "aceito",
  PRONTO: "pronto",
  RETIRADO: "retirado"
});

const ACTIONS = Object.freeze({
  aceitar: [STATUS.NOVO, STATUS.ACEITO],
  pronto: [STATUS.ACEITO, STATUS.PRONTO],
  retirar: [STATUS.PRONTO, STATUS.RETIRADO]
});

export function formatMoney(amount) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amount);
}

export function transitionOrder(order, action, now = new Date().toISOString()) {
  if (!order || !Object.hasOwn(ACTIONS, action)) {
    throw new Error("Ação inválida.");
  }

  const [expected, target] = ACTIONS[action];
  if (order.status !== expected) {
    throw new Error("O pedido não está na etapa correta.");
  }

  if (action === "retirar" && !order.payment.paid) {
    throw new Error("Confirme o pagamento antes de finalizar a retirada.");
  }

  const updates = {
    aceitar: { acceptedAt: now },
    pronto: { readyAt: now },
    retirar: { deliveredAt: now }
  };

  return {
    ...order,
    ...updates[action],
    status: target,
    updatedAt: now
  };
}

export function confirmPayment(order, now = new Date().toISOString()) {
  if (!order || !order.payment || order.payment.paid) {
    throw new Error("Este pagamento já foi confirmado ou o pedido é inválido.");
  }

  if (![STATUS.ACEITO, STATUS.PRONTO].includes(order.status)) {
    throw new Error("Aceite o pedido antes de confirmar o pagamento.");
  }

  return {
    ...order,
    payment: { ...order.payment, paid: true, paidAt: now },
    updatedAt: now
  };
}

export function summarizeOrders(orders) {
  const active = orders.filter(order => order.status !== STATUS.RETIRADO);
  const completed = orders.filter(order => order.status === STATUS.RETIRADO);

  return {
    newCount: active.filter(order => order.status === STATUS.NOVO).length,
    acceptedCount: active.filter(order => order.status === STATUS.ACEITO).length,
    readyCount: active.filter(order => order.status === STATUS.PRONTO).length,
    completedCount: completed.length,
    paidTotal: orders
      .filter(order => order.payment.paid)
      .reduce((sum, order) => sum + order.total, 0)
  };
}

export function customerMessage(order) {
  switch (order.status) {
    case STATUS.NOVO:
      return "Seu pedido chegou ao BN Lanches e aguarda confirmação.";
    case STATUS.ACEITO:
      return "Pedido aceito! Vamos preparar seu lanche.";
    case STATUS.PRONTO:
      return "Pedido pronto! Já pode retirar no balcão.";
    case STATUS.RETIRADO:
      return "Pedido finalizado. Obrigado pela preferência!";
    default:
      return "Status indisponível.";
  }
}
