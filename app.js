const defaultCategories = ["買い物", "アイディア", "タスク", "連絡"];
const ADD_CATEGORY_VALUE = "__add_new_category__";

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

    const addCategory = document.createElement("option");
    addCategory.value = ADD_CATEGORY_VALUE;
    addCategory.textContent = "＋分類を追加";
    select.append(addCategory);

    select.value = item.category || "";
    select.addEventListener("change", (e) => {
      const selected = e.target.value;
      if (selected === ADD_CATEGORY_VALUE) {
        const newCategoryRaw = window.prompt("新しい分類名を入力してください");
        const newCategory = newCategoryRaw ? newCategoryRaw.trim() : "";
        if (!newCategory) {
          select.value = item.category || "";
          return;
        }

        if (!state.categories.includes(newCategory)) {
          state.categories.push(newCategory);
        }
        item.category = newCategory;
        save();
        renderItems();
        return;
      }

      item.category = selected;
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

load();
renderItems();
