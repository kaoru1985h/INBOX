const defaultCategories = ["買い物", "アイディア", "タスク", "連絡"];
const CATEGORY_ACTION_VALUES = {
  manage: "__category_action_manage__"
};
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
let addMessageTimer;
let categoryManagerDialog;
let categoryListEl;
let categoryAddInputEl;
let draggedCategoryIndex = null;

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

function addCategory(rawName) {
  const name = rawName ? rawName.trim() : "";
  if (!name) return null;
  if (state.categories.includes(name)) return null;
  state.categories.push(name);
  return name;
}

function renameCategory(oldName, newRawName) {
  const newName = newRawName ? newRawName.trim() : "";
  if (!newName || oldName === newName) return false;
  if (state.categories.includes(newName)) return false;
  const index = state.categories.indexOf(oldName);
  if (index < 0) return false;
  state.categories[index] = newName;
  for (const item of state.items) {
    if (item.category === oldName) {
      item.category = newName;
    }
  }
  return true;
}

function removeCategory(category) {
  const index = state.categories.indexOf(category);
  if (index < 0) return false;
  state.categories.splice(index, 1);
  for (const item of state.items) {
    if (item.category === category) {
      item.category = "";
    }
  }
  return true;
}

function ensureCategoryManagerDialog() {
  if (categoryManagerDialog) return;

  const dialog = document.createElement("dialog");
  dialog.className = "category-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="category-dialog__panel">
      <div class="category-dialog__header">
        <h3>分類を管理</h3>
        <button class="category-dialog__close" value="cancel" type="submit" aria-label="閉じる">閉じる</button>
      </div>
      <p class="category-dialog__desc">ドラッグで順序変更、右側ボタンで編集・削除できます。</p>
      <ul class="category-list" id="category-list"></ul>
      <div class="category-add">
        <input id="category-add-input" type="text" placeholder="新しい分類名" autocomplete="off" />
        <button id="category-add-button" type="button">追加</button>
      </div>
    </form>
  `;

  document.body.append(dialog);
  categoryManagerDialog = dialog;
  categoryListEl = dialog.querySelector("#category-list");
  categoryAddInputEl = dialog.querySelector("#category-add-input");
  const addButton = dialog.querySelector("#category-add-button");

  addButton.addEventListener("click", () => {
    const added = addCategory(categoryAddInputEl.value);
    if (!added) {
      window.alert("分類名が未入力か、すでに存在しています。");
      return;
    }
    categoryAddInputEl.value = "";
    save();
    renderCategoryManager();
    renderItems();
  });

  categoryAddInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addButton.click();
    }
  });
}

function moveCategoryByIndex(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || toIndex < 0) return;
  if (fromIndex >= state.categories.length || toIndex >= state.categories.length) return;
  const [moved] = state.categories.splice(fromIndex, 1);
  state.categories.splice(toIndex, 0, moved);
}

function buildCategoryRow(category, index) {
  const li = document.createElement("li");
  li.className = "category-row";
  li.draggable = true;
  li.dataset.index = String(index);

  const label = document.createElement("span");
  label.className = "category-row__label";
  label.textContent = category;

  const rowActions = document.createElement("div");
  rowActions.className = "category-row__actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "category-row__btn";
  editButton.textContent = "編集";
  editButton.addEventListener("click", () => {
    const renamed = renameCategory(category, window.prompt("新しい分類名を入力してください", category));
    if (!renamed) {
      window.alert("分類名を変更できませんでした。空欄または重複の可能性があります。");
      return;
    }
    save();
    renderCategoryManager();
    renderItems();
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "category-row__btn danger";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", () => {
    const confirmed = window.confirm(`分類「${category}」を削除しますか？\nこの分類の項目は未分類に戻ります。`);
    if (!confirmed) return;
    removeCategory(category);
    save();
    renderCategoryManager();
    renderItems();
  });

  rowActions.append(editButton, deleteButton);
  li.append(label, rowActions);

  li.addEventListener("dragstart", (e) => {
    draggedCategoryIndex = Number(li.dataset.index);
    li.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", li.dataset.index);
    }
  });

  li.addEventListener("dragend", () => {
    draggedCategoryIndex = null;
    li.classList.remove("dragging");
    for (const row of categoryListEl.querySelectorAll(".category-row")) {
      row.classList.remove("drop-target");
    }
  });

  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    li.classList.add("drop-target");
  });

  li.addEventListener("dragleave", () => {
    li.classList.remove("drop-target");
  });

  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("drop-target");
    const from = draggedCategoryIndex;
    const to = Number(li.dataset.index);
    if (from === null || Number.isNaN(to)) return;
    moveCategoryByIndex(from, to);
    save();
    renderCategoryManager();
    renderItems();
  });

  return li;
}

function renderCategoryManager() {
  if (!categoryListEl) return;
  categoryListEl.innerHTML = "";
  for (const [index, category] of state.categories.entries()) {
    categoryListEl.append(buildCategoryRow(category, index));
  }
}

function openCategoryManager() {
  ensureCategoryManagerDialog();
  renderCategoryManager();
  categoryManagerDialog.showModal();
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

  const manageOption = document.createElement("option");
  manageOption.value = CATEGORY_ACTION_VALUES.manage;
  manageOption.textContent = "＋分類を整理";
  select.append(manageOption);

  select.value = item.category || "";
  select.addEventListener("change", (e) => {
    const selected = e.target.value;
    if (selected === CATEGORY_ACTION_VALUES.manage) {
      openCategoryManager();
      select.value = item.category || "";
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
  refs.addMessage.textContent = "項目を追加しました。";
  window.clearTimeout(addMessageTimer);
  addMessageTimer = window.setTimeout(() => {
    refs.addMessage.textContent = "";
  }, 2500);
  save();
  renderItems();
});

load();
refs.sortMode.value = state.sortMode;
renderItems();
