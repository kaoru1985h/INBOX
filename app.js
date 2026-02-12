const defaultCategories = ["買い物", "アイディア", "タスク", "連絡"];
const ADD_CATEGORY_VALUE = "__add_new_category__";
const SORT_MODES = {
  newest: "newest",
  oldest: "oldest",
  category: "category"
};

const state = {
  items: [],
  categories: [...defaultCategories],
  sortMode: SORT_MODES.newest
};

const refs = {
  inboxView: document.getElementById("inbox-view"),
  manageView: document.getElementById("manage-view"),
  showInbox: document.getElementById("show-inbox"),
  showManage: document.getElementById("show-manage"),
  addForm: document.getElementById("add-form"),
  itemInput: document.getElementById("item-input"),
  addMessage: document.getElementById("add-message"),
  sortMode: document.getElementById("sort-mode"),
  itemsList: document.getElementById("items-list")
};

const STORAGE_KEY = "inbox_app_v1";
const expandedItemIds = new Set();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) {
      state.items = parsed.items.map((item) => ({
        id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
        text: typeof item.text === "string" ? item.text : "",
        category: typeof item.category === "string" ? item.category : "",
        createdAt: item.createdAt || new Date().toISOString(),
        memo: typeof item.memo === "string" ? item.memo : "",
        dueAt: typeof item.dueAt === "string" ? item.dueAt : ""
      }));
    }
    if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      const merged = [...defaultCategories];
      for (const c of parsed.categories) {
        if (typeof c === "string" && c.trim() && !merged.includes(c.trim())) {
          merged.push(c.trim());
        }
      }
      state.categories = merged;
    }
    if (Object.values(SORT_MODES).includes(parsed.sortMode)) {
      state.sortMode = parsed.sortMode;
    }
  } catch {
    state.items = [];
    state.categories = [...defaultCategories];
    state.sortMode = SORT_MODES.newest;
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

function sortByDateDesc(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function sortByDateAsc(a, b) {
  return new Date(a.createdAt) - new Date(b.createdAt);
}

function formatGoogleDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function buildGoogleCalendarUrl(item) {
  const now = new Date();
  const start = item.dueAt ? new Date(item.dueAt) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.text || "IN BOX 項目",
    details: item.memo || "",
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function openGoogleCalendar(item) {
  const url = buildGoogleCalendarUrl(item);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function createItemElement(item) {
  const li = document.createElement("li");
  li.className = "item";
  const isExpanded = expandedItemIds.has(item.id);

  const info = document.createElement("div");
  const text = document.createElement("div");
  text.className = "item-text";
  text.textContent = item.text;

  const meta = document.createElement("div");
  meta.className = "muted";
  meta.textContent = `追加: ${formatDate(item.createdAt)}`;

  info.append(text, meta);

  const header = document.createElement("div");
  header.className = "item-header";

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "detail-toggle";
  toggleButton.setAttribute("aria-expanded", String(isExpanded));
  toggleButton.textContent = isExpanded ? "詳細を閉じる" : "詳細";
  toggleButton.addEventListener("click", () => {
    if (expandedItemIds.has(item.id)) {
      expandedItemIds.delete(item.id);
    } else {
      expandedItemIds.add(item.id);
    }
    renderItems();
  });
  actions.append(toggleButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "complete-btn";
  deleteButton.textContent = "完了して削除";
  deleteButton.addEventListener("click", () => {
    state.items = state.items.filter((target) => target.id !== item.id);
    expandedItemIds.delete(item.id);
    save();
    renderItems();
  });
  actions.append(deleteButton);

  header.append(info, actions);

  const details = document.createElement("div");
  details.className = "item-details";
  details.classList.toggle("hidden", !isExpanded);

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
    renderItems();
  });

  const controls = document.createElement("div");
  controls.className = "item-controls";

  controls.append(select);

  const memoInput = document.createElement("textarea");
  memoInput.className = "memo-input";
  memoInput.rows = 2;
  memoInput.placeholder = "メモ";
  memoInput.value = item.memo || "";
  memoInput.addEventListener("change", (e) => {
    item.memo = e.target.value;
    save();
  });
  controls.append(memoInput);

  const calendarButton = document.createElement("button");
  calendarButton.type = "button";
  calendarButton.className = "calendar-btn";
  calendarButton.textContent = "Googleカレンダーへ";
  calendarButton.addEventListener("click", () => {
    openGoogleCalendar(item);
  });
  controls.append(calendarButton);
  details.append(controls);

  li.append(header, details);
  return li;
}

function addGroupTitle(title) {
  const li = document.createElement("li");
  li.className = "group-title";
  li.textContent = title;
  refs.itemsList.append(li);
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

  if (state.sortMode === SORT_MODES.newest) {
    const sorted = [...state.items].sort(sortByDateDesc);
    for (const item of sorted) {
      refs.itemsList.append(createItemElement(item));
    }
    return;
  }

  if (state.sortMode === SORT_MODES.oldest) {
    const sorted = [...state.items].sort(sortByDateAsc);
    for (const item of sorted) {
      refs.itemsList.append(createItemElement(item));
    }
    return;
  }

  const grouped = new Map();
  for (const item of state.items) {
    const key = item.category || "未分類";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  }

  const categoryOrder = [];
  for (const category of state.categories) {
    if (grouped.has(category)) {
      categoryOrder.push(category);
    }
  }
  for (const key of grouped.keys()) {
    if (!categoryOrder.includes(key) && key !== "未分類") {
      categoryOrder.push(key);
    }
  }
  if (grouped.has("未分類")) {
    categoryOrder.push("未分類");
  }

  for (const category of categoryOrder) {
    addGroupTitle(category);
    const groupedItems = grouped.get(category).sort(sortByDateDesc);
    for (const item of groupedItems) {
      refs.itemsList.append(createItemElement(item));
    }
  }
}

refs.showInbox.addEventListener("click", () => setView("inbox"));
refs.showManage.addEventListener("click", () => {
  setView("manage");
  renderItems();
});

refs.sortMode.addEventListener("change", (e) => {
  state.sortMode = e.target.value;
  save();
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
    createdAt: new Date().toISOString(),
    memo: "",
    dueAt: ""
  });

  refs.itemInput.value = "";
  refs.addMessage.textContent = "項目を追加しました。分類画面でジャンル分けできます。";
  save();
  renderItems();
});

load();
refs.sortMode.value = state.sortMode;
renderItems();
