const defaultCategories = ["買い物", "アイディア", "タスク", "連絡"];

const state = {
  items: [],
  categories: [...defaultCategories]
};

const refs = {
  inboxView: document.getElementById("inbox-view"),
  manageView: document.getElementById("manage-view"),
  showInbox: document.getElementById("show-inbox"),
  showManage: document.getElementById("show-manage"),
  addForm: document.getElementById("add-form"),
  itemInput: document.getElementById("item-input"),
  addMessage: document.getElementById("add-message"),
  categoryForm: document.getElementById("category-form"),
  categoryInput: document.getElementById("category-input"),
  itemsList: document.getElementById("items-list")
};

const STORAGE_KEY = "inbox_app_v1";

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) state.items = parsed.items;
    if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      const merged = [...defaultCategories];
      for (const c of parsed.categories) {
        if (typeof c === "string" && c.trim() && !merged.includes(c.trim())) {
          merged.push(c.trim());
        }
      }
      state.categories = merged;
    }
  } catch {
    state.items = [];
    state.categories = [...defaultCategories];
  }
}

function setView(view) {
  const isInbox = view === "inbox";
  refs.inboxView.classList.toggle("hidden", !isInbox);
  refs.manageView.classList.toggle("hidden", isInbox);
  refs.showInbox.classList.toggle("active", isInbox);
  refs.showManage.classList.toggle("active", !isInbox);
}

function formatDate(iso) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderItems() {
  refs.itemsList.innerHTML = "";

  if (state.items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "まだ項目がありません。入力画面から追加してください。";
    refs.itemsList.append(empty);
    return;
  }

  for (const item of state.items) {
    const li = document.createElement("li");
    li.className = "item";

    const info = document.createElement("div");
    const text = document.createElement("div");
    text.className = "item-text";
    text.textContent = item.text;

    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = `追加: ${formatDate(item.createdAt)}`;

    info.append(text, meta);

    const select = document.createElement("select");
    select.setAttribute("aria-label", "ジャンル");

    const noCategory = document.createElement("option");
    noCategory.value = "";
    noCategory.textContent = "未分類";
    select.append(noCategory);

    for (const category of state.categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.append(option);
    }

    select.value = item.category || "";
    select.addEventListener("change", (e) => {
      item.category = e.target.value;
      save();
    });

    li.append(info, select);
    refs.itemsList.append(li);
  }
}

refs.showInbox.addEventListener("click", () => setView("inbox"));
refs.showManage.addEventListener("click", () => {
  setView("manage");
  renderItems();
});

refs.addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = refs.itemInput.value.trim();
  if (!text) return;

  state.items.unshift({
    id: crypto.randomUUID(),
    text,
    category: "",
    createdAt: new Date().toISOString()
  });

  refs.itemInput.value = "";
  refs.addMessage.textContent = "項目を追加しました。分類画面でジャンル分けできます。";
  save();
  renderItems();
});

refs.categoryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const category = refs.categoryInput.value.trim();
  if (!category) return;

  if (state.categories.includes(category)) {
    refs.categoryInput.value = "";
    return;
  }

  state.categories.push(category);
  refs.categoryInput.value = "";
  save();
  renderItems();
});

load();
renderItems();
