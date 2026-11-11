import {
  STATUS,
  formatMoney,
  transitionOrder,
  confirmPayment,
  summarizeOrders,
  customerMessage
} from "./order-model.mjs";

const STORAGE_KEY = "bn-lanches:demo-pedidos:v1";
const filterButtons = document.querySelectorAll("[data-filter]");
const ordersList = document.getElementById("orders-list");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("order-search");
const confirmDialog = document.getElementById("confirm-dialog");
const customerDialog = document.getElementById("customer-dialog");
const toast = document.getElementById("toast");

const STATUS_LABELS = {
  [STATUS.NOVO]: "Novo pedido",
  [STATUS.ACEITO]: "Aceito",
  [STATUS.PRONTO]: "Pronto",
  [STATUS.RETIRADO]: "Retirado"
};

const priority = {
  [STATUS.NOVO]: 0,
  [STATUS.ACEITO]: 1,
  [STATUS.PRONTO]: 2,
  [STATUS.RETIRADO]: 3
};

let currentFilter = "ativos";
let searchText = "";
let pendingConfirmation = null;
let toastTimeout;

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function exampleOrders() {
  return [
    {
      id: 1042, customer: "Mariana", status: STATUS.NOVO, createdAt: minutesAgo(4),
      total: 36,
      payment: { method: "Pix na retirada", paid: false, paidAt: null },
      items: [
        { name: "X-Bacon", quantity: 1, price: 30, options: ["+ Catupiry"], note: "SEM TOMATE" },
        { name: "Refrigerante lata", quantity: 1, price: 6, options: [], note: "" }
      ]
    },
    {
      id: 1041, customer: "Lucas", status: STATUS.ACEITO, createdAt: minutesAgo(11),
      total: 39,
      payment: { method: "Cartão na retirada", paid: false, paidAt: null },
      items: [
        { name: "X-Tudo", quantity: 1, price: 39, options: [], note: "SEM CEBOLA" }
      ]
    },
    {
      id: 1040, customer: "Ana", status: STATUS.PRONTO, createdAt: minutesAgo(23),
      total: 48,
      payment: { method: "Dinheiro na retirada", paid: false, paidAt: null },
      items: [
        { name: "X-Salada", quantity: 2, price: 24, options: [], note: "" }
      ]
    }
  ];
}

function validOrder(order) {
  return order
    && Number.isSafeInteger(order.id)
    && typeof order.customer === "string"
    && Object.values(STATUS).includes(order.status)
    && Array.isArray(order.items)
    && Number.isFinite(order.total)
    && order.payment
    && typeof order.payment.paid === "boolean"
    && typeof order.payment.method === "string";
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return exampleOrders();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validOrder)) throw new Error("Dados inválidos");
    return parsed;
  } catch {
    return exampleOrders();
  }
}

let orders = loadOrders();

function saveOrders() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    return true;
  } catch {
    showToast("Não foi possível salvar no navegador. Use o modo demonstração apenas.");
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 3500);
}

function formatTime(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "--:--" : new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit"
  }).format(parsed);
}

function renderItem(item) {
  const itemTotal = formatMoney(item.price * item.quantity);
  const options = item.options?.length
    ? `<div class="item-options">${item.options.map(escapeHtml).join(" · ")}</div>` : "";
  const note = item.note
    ? `<div class="item-note">⚠ ${escapeHtml(item.note)}</div>` : "";

  return `<div class="item-line">
    <div class="item-main">
      <div class="item-name">${escapeHtml(item.quantity)}× ${escapeHtml(item.name)}</div>
      ${options}
      ${note}
    </div>
    <div class="item-price">${escapeHtml(itemTotal)}</div>
  </div>`;
}

function renderActions(order) {
  switch (order.status) {
    case STATUS.NOVO:
      return `<button type="button" class="button button-primary button-main" data-action="aceitar" data-id="${order.id}">✓ Aceitar pedido</button>`;
    case STATUS.ACEITO:
      return `
        <button type="button" class="button button-primary button-main" data-action="pronto" data-id="${order.id}">✓ Marcar como pronto</button>
        ${order.payment.paid ? "" : `<button type="button" class="button button-outline" data-action="pagar" data-id="${order.id}">Confirmar pagamento</button>`}
      `;
    case STATUS.PRONTO:
      return order.payment.paid
        ? `<button type="button" class="button button-success button-main" data-action="retirar" data-id="${order.id}">✓ Confirmar retirada</button>`
        : `<button type="button" class="button button-success button-main" data-action="pagar" data-id="${order.id}">✓ Confirmar pagamento</button>`;
    case STATUS.RETIRADO:
      return `<span class="status-badge retirado">Pedido concluído</span>`;
    default:
      return "";
  }
}

function renderOrder(order) {
  return `<article class="order-card ${order.status === STATUS.NOVO ? "is-new" : ""} ${order.status === STATUS.PRONTO ? "is-ready" : ""} ${order.status === STATUS.RETIRADO ? "is-complete" : ""}" aria-label="Pedido ${order.id} de ${escapeHtml(order.customer)}">
    <div class="card-head">
      <div><div class="order-id">#${order.id}</div><div class="order-time">Recebido às ${escapeHtml(formatTime(order.createdAt))}</div></div>
      <span class="status-badge ${order.status}">${STATUS_LABELS[order.status]}</span>
    </div>
    <div class="customer-row">
      <div class="avatar" aria-hidden="true">${escapeHtml(order.customer.trim().charAt(0).toUpperCase())}</div>
      <div class="customer-info">
        <div class="customer-name">${escapeHtml(order.customer)}</div>
        <div class="customer-subtitle">Retirada no balcão</div>
      </div>
    </div>
    <div class="order-items">${order.items.map(renderItem).join("")}</div>
    <div class="payment-row">
      <div><div class="total-label">TOTAL DO PEDIDO</div><div class="order-total">${escapeHtml(formatMoney(order.total))}</div></div>
      <span class="payment-chip ${order.payment.paid ? "paid" : ""}">${order.payment.paid ? "✓ Pago" : "⏳ Pendente"}<br />${escapeHtml(order.payment.method)}</span>
    </div>
    <div class="card-actions">${renderActions(order)}</div>
    <button class="link-button" type="button" data-action="preview" data-id="${order.id}">Ver o que o cliente acompanha</button>
  </article>`;
}

function render() {
  const stats = summarizeOrders(orders);
  document.getElementById("stat-new").textContent = stats.newCount;
  document.getElementById("stat-accepted").textContent = stats.acceptedCount;
  document.getElementById("stat-ready").textContent = stats.readyCount;
  document.getElementById("stat-revenue").textContent = formatMoney(stats.paidTotal);

  const selected = orders
    .filter(order => currentFilter === "ativos"
      ? order.status !== STATUS.RETIRADO
      : order.status === currentFilter)
    .filter(order => {
      const needle = searchText.trim().toLocaleLowerCase("pt-BR");
      return !needle || String(order.id).includes(needle)
        || order.customer.toLocaleLowerCase("pt-BR").includes(needle);
    })
    .sort((a, b) => (priority[a.status] - priority[b.status])
      || (new Date(a.createdAt) - new Date(b.createdAt)));

  ordersList.innerHTML = selected.map(renderOrder).join("");
  emptyState.hidden = selected.length > 0;
}

function setFilter(filter) {
  currentFilter = filter;
  for (const button of filterButtons) {
    const selected = button.dataset.filter === filter;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  render();
}

function findOrder(id) {
  return orders.find(order => order.id === id);
}

function updateOrder(id, updater) {
  const index = orders.findIndex(order => order.id === id);
  if (index < 0) return showToast("Pedido não encontrado.");
  try {
    const updated = updater(orders[index]);
    orders = orders.map((order, i) => i === index ? updated : order);
    saveOrders();
    render();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Não foi possível atualizar o pedido.");
  }
}

function askToConfirm(title, description, action, confirmLabel) {
  pendingConfirmation = action;
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-description").textContent = description;
  document.getElementById("confirm-action").textContent = confirmLabel;
  confirmDialog.showModal();
}

function previewCustomer(order) {
  document.getElementById("customer-order-title").textContent = `Pedido #${order.id}`;
  document.getElementById("customer-order-message").textContent = customerMessage(order);
  const stages = [
    ["Pedido recebido", true],
    ["Pedido aceito", order.status !== STATUS.NOVO],
    ["Pronto para retirada", [STATUS.PRONTO, STATUS.RETIRADO].includes(order.status)],
    ["Retirado", order.status === STATUS.RETIRADO]
  ];
  document.getElementById("customer-timeline").innerHTML = stages.map(([label, done]) =>
    `<li class="${done ? "done" : ""}">${escapeHtml(label)}</li>`
  ).join("");
  customerDialog.showModal();
}

function handleCardAction(action, id) {
  const order = findOrder(id);
  if (!order) return showToast("Pedido não encontrado.");

  if (action === "preview") return previewCustomer(order);

  if (action === "pagar") {
    return askToConfirm(
      "Pagamento recebido?",
      `Confirme ${formatMoney(order.total)} (${order.payment.method}) somente depois de receber o valor. Nesta versão é apenas uma simulação.`,
      () => {
        updateOrder(id, confirmPayment);
        showToast(`Pagamento do pedido #${id} marcado como recebido.`);
      },
      "Sim, recebi"
    );
  }

  const actions = {
    aceitar: { operation: "aceitar", message: "Pedido aceito. O cliente poderá acompanhar esta etapa." },
    pronto: { operation: "pronto", message: "Pedido pronto para retirada." },
    retirar: { operation: "retirar", message: "Retirada concluída. Pedido no histórico." }
  };

  if (!Object.hasOwn(actions, action)) return;
  updateOrder(id, current => transitionOrder(current, actions[action].operation));
  showToast(actions[action].message);
}

ordersList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  handleCardAction(button.dataset.action, Number(button.dataset.id));
});

document.getElementById("status-filters").addEventListener("click", event => {
  const button = event.target.closest("button[data-filter]");
  if (button) setFilter(button.dataset.filter);
});

searchInput.addEventListener("input", event => {
  searchText = event.target.value;
  render();
});

document.getElementById("add-demo-order").addEventListener("click", () => {
  const id = Math.max(1042, ...orders.map(order => order.id)) + 1;
  const examples = [
    { customer: "Beatriz", items: [{ name: "X-Bacon", quantity: 2, price: 30, options: ["+ Catupiry"], note: "SEM TOMATE" }], total: 60, method: "Pix na retirada" },
    { customer: "Rafael", items: [{ name: "X-Salada", quantity: 1, price: 24, options: [], note: "" }, { name: "Refrigerante lata", quantity: 1, price: 6, options: [], note: "" }], total: 30, method: "Dinheiro na retirada" },
    { customer: "Camila", items: [{ name: "X-Tudo", quantity: 1, price: 39, options: [], note: "SEM CEBOLA" }], total: 39, method: "Cartão na retirada" }
  ];
  const selection = examples[(id - 1043) % examples.length];
  orders = [...orders, {
    id, customer: selection.customer, items: selection.items, total: selection.total,
    createdAt: new Date().toISOString(), status: STATUS.NOVO,
    payment: { method: selection.method, paid: false, paidAt: null }
  }];
  saveOrders();
  searchInput.value = "";
  searchText = "";
  setFilter("ativos");
  showToast(`Pedido fictício #${id} criado para teste.`);
});

document.getElementById("reset-demo").addEventListener("click", () => {
  askToConfirm(
    "Reiniciar demonstração?",
    "Os pedidos fictícios e as alterações salvas neste navegador serão substituídos pelo estado inicial.",
    () => {
      orders = exampleOrders();
      saveOrders();
      searchInput.value = "";
      searchText = "";
      setFilter("ativos");
      showToast("Demonstração reiniciada.");
    },
    "Reiniciar"
  );
});

document.getElementById("cancel-action").addEventListener("click", () => confirmDialog.close());
document.getElementById("confirm-action").addEventListener("click", () => {
  const action = pendingConfirmation;
  pendingConfirmation = null;
  confirmDialog.close();
  if (action) action();
});
confirmDialog.addEventListener("close", () => { pendingConfirmation = null; });
document.getElementById("close-customer").addEventListener("click", () => customerDialog.close());

window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY) {
    orders = loadOrders();
    render();
  }
});

saveOrders();
render();
