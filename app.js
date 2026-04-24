const t = {
  code: "\u4ee3\u7801\u5b9e\u9a8c",
  paper: "\u8bba\u6587\u9605\u8bfb",
  study: "\u77e5\u8bc6\u5b66\u4e60",
  publish: "\u8bba\u6587\u53d1\u8868",
  other: "\u5176\u4ed6",
  empty: "\u6682\u65e0\u4efb\u52a1",
  start: "\u5f00\u59cb",
  focusing: "\u4e13\u6ce8\u4e2d",
  abort: "\u4e2d\u6b62",
  all: "\u5168\u90e8",
  doing: "\u8fdb\u884c\u4e2d",
  done: "\u5b8c\u6210",
  accumulated: "\u7d2f\u8ba1",
  saved: "\u5df2\u4fdd\u5b58",
  saveFailed: "\u4fdd\u5b58\u5931\u8d25",
  noStats: "\u5f53\u5929\u6682\u65e0\u4e13\u6ce8\u8bb0\u5f55",
  reportSaved: "\u65e5\u62a5\u5df2\u5b58\u6863",
  noArchive: "\u6682\u65e0\u65e5\u62a5\u5b58\u6863",
  noTaskDescription: "\u6682\u65e0\u4efb\u52a1\u8bf4\u660e"
};

const state = {
  tasks: [],
  filter: "doing",
  timerLocked: false,
  activeTaskId: null,
  currentStats: null,
  fullSessions: 0,
  currentDate: "",
  lastMinuteKey: ""
};

const els = {};

async function init() {
  bindElements();
  setTodayDates();
  setBrandDate();
  bindEvents();
  scheduleDateRefresh();

  if (!hasNativeBridge()) {
    window.updateUI("[]");
    return;
  }

  render();
  await restoreTimerState();
}

function bindElements() {
  Object.assign(els, {
    taskView: document.getElementById("taskView"),
    statsView: document.getElementById("statsView"),
    reportView: document.getElementById("reportView"),
    archiveView: document.getElementById("archiveView"),
    brandTitle: document.getElementById("brandTitle"),
    openAddTaskBtn: document.getElementById("openAddTaskBtn"),
    addTaskDialog: document.getElementById("addTaskDialog"),
    cancelAddTaskBtn: document.getElementById("cancelAddTaskBtn"),
    taskForm: document.getElementById("taskForm"),
    taskInput: document.getElementById("taskInput"),
    taskDescriptionInput: document.getElementById("taskDescriptionInput"),
    taskDescriptionDialog: document.getElementById("taskDescriptionDialog"),
    taskDescriptionTitle: document.getElementById("taskDescriptionTitle"),
    taskDescriptionContent: document.getElementById("taskDescriptionContent"),
    closeTaskDescriptionBtn: document.getElementById("closeTaskDescriptionBtn"),
    categorySelect: document.getElementById("categorySelect"),
    categoryTrigger: document.getElementById("categoryTrigger"),
    categoryMenu: document.getElementById("categoryMenu"),
    categoryOptions: Array.from(document.querySelectorAll(".select-option")),
    taskList: document.getElementById("taskList"),
    dailyProgress: document.getElementById("dailyProgress"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    statsBtn: document.getElementById("statsBtn"),
    reportBtn: document.getElementById("reportBtn"),
    statsTitle: document.getElementById("statsTitle"),
    statsDate: document.getElementById("statsDate"),
    reportDate: document.getElementById("reportDate"),
    refreshStatsBtn: document.getElementById("refreshStatsBtn"),
    statsChart: document.getElementById("statsChart"),
    reportHead: document.getElementById("reportHead"),
    reportSummary: document.getElementById("reportSummary"),
    summaryToggle: document.getElementById("summaryToggle"),
    reportNotes: document.getElementById("reportNotes"),
    saveReportBtn: document.getElementById("saveReportBtn"),
    reportReminderDialog: document.getElementById("reportReminderDialog"),
    closeReportReminderBtn: document.getElementById("closeReportReminderBtn"),
    archiveBtn: document.getElementById("archiveBtn"),
    archiveList: document.getElementById("archiveList"),
    timer: document.getElementById("timer"),
    timerBar: document.getElementById("timerBar"),
    toast: document.getElementById("toast")
  });
}

function setTodayDates() {
  const today = getLocalDateString();
  state.currentDate = today;
  els.statsDate.value = today;
  els.reportDate.value = today;
}

function setBrandDate() {
  const title = `${getShortDateString()} Todo`;
  els.brandTitle.textContent = title;
  document.title = title;
}

function getLocalDateString() {
  return formatDate(new Date());
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getShortDateString() {
  const date = new Date();
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function bindEvents() {
  els.openAddTaskBtn.addEventListener("click", openAddTaskDialog);
  els.cancelAddTaskBtn.addEventListener("click", closeAddTaskDialog);
  els.addTaskDialog.addEventListener("click", event => {
    if (event.target === els.addTaskDialog) closeAddTaskDialog();
  });
  els.closeTaskDescriptionBtn.addEventListener("click", closeTaskDescriptionDialog);
  els.taskDescriptionDialog.addEventListener("click", event => {
    if (event.target === els.taskDescriptionDialog) closeTaskDescriptionDialog();
  });
  els.taskForm.addEventListener("submit", addTask);
  els.categoryTrigger.addEventListener("click", toggleCategoryMenu);
  els.categoryOptions.forEach(option => {
    option.addEventListener("click", () => setCategory(option.dataset.value));
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#categoryPicker")) closeCategoryMenu();
  });

  els.tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      state.filter = tab.dataset.filter;
      render();
    });
  });

  els.taskList.addEventListener("click", handleTaskClick);
  els.statsBtn.addEventListener("click", () => openStatsView(getLocalDateString()));
  els.reportBtn.addEventListener("click", () => openReportView(getLocalDateString()));
  els.refreshStatsBtn.addEventListener("click", () => loadStats(els.statsDate.value));
  els.statsDate.addEventListener("change", () => loadStats(els.statsDate.value));
  els.reportDate.addEventListener("change", () => openReportView(els.reportDate.value));
  els.saveReportBtn.addEventListener("click", saveReport);
  els.summaryToggle.addEventListener("click", toggleReportHeader);
  els.closeReportReminderBtn.addEventListener("click", closeReportReminder);
  els.reportReminderDialog.addEventListener("cancel", event => event.preventDefault());
  els.archiveBtn.addEventListener("click", openArchiveView);

  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });
}

function scheduleDateRefresh() {
  runScheduledMinuteTasks();
  setInterval(() => runScheduledMinuteTasks(), 60 * 1000);
  window.addEventListener("focus", () => runScheduledMinuteTasks(true));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) runScheduledMinuteTasks(true);
  });
}

async function runScheduledMinuteTasks(force = false) {
  const now = new Date();
  const minuteKey = `${formatDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (!force && minuteKey === state.lastMinuteKey) return;
  state.lastMinuteKey = minuteKey;

  await handleReportReminder(now);
  await handleReportAutosave(now);
  await refreshDateContext(now);
}

async function refreshDateContext(now = new Date()) {
  const today = formatDate(now);
  const previous = state.currentDate || today;
  if (today === previous) return;

  await autoSaveReportForDate(previous, "date-rollover");

  state.currentDate = today;
  setBrandDate();

  const statsWasToday = !els.statsDate.value || els.statsDate.value === previous;
  const reportWasToday = !els.reportDate.value || els.reportDate.value === previous;

  if (statsWasToday) {
    els.statsDate.value = today;
    if (els.statsView.classList.contains("active")) await loadStats(today);
  }

  if (reportWasToday) {
    const reportHasDraft = els.reportView.classList.contains("active") && els.reportNotes.value.trim();
    if (!reportHasDraft) {
      els.reportDate.value = today;
      if (els.reportView.classList.contains("active")) await openReportView(today);
    }
  }

  await refreshTodayProgress();
}

async function handleReportReminder(now) {
  const date = formatDate(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const reminderMinute = 21 * 60 + 30;
  if (minutes < reminderMinute) return;
  if (localStorage.getItem(reportReminderDismissKey(date)) === "1") return;

  await showReportReminder(date);
}

async function showReportReminder(date = getLocalDateString()) {
  const alreadyEditingTarget =
    els.reportView.classList.contains("active") &&
    els.reportDate.value === date;
  if (!alreadyEditingTarget) await openReportView(date);
  if (typeof els.reportReminderDialog.showModal === "function" && !els.reportReminderDialog.open) {
    els.reportReminderDialog.showModal();
  } else {
    els.reportReminderDialog.setAttribute("open", "");
  }
}

function closeReportReminder() {
  const date = els.reportDate.value || getLocalDateString();
  localStorage.setItem(reportReminderDismissKey(date), "1");
  if (els.reportReminderDialog.open) els.reportReminderDialog.close();
  else els.reportReminderDialog.removeAttribute("open");
}

function reportReminderDismissKey(date) {
  return `flowy.reportReminder.dismissed.${date}`;
}

async function handleReportAutosave(now) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (hour === 23 && minute === 59) {
    await autoSaveReportForDate(formatDate(now), "2359");
  }
  if (hour === 0 && minute === 0) {
    await autoSaveReportForDate(formatDate(addDays(now, -1)), "0000");
  }
}

async function autoSaveReportForDate(date, phase) {
  if (!date) return;
  const key = `flowy.reportAutosaved.${date}.${phase}`;
  if (localStorage.getItem(key) === "1") return;
  const result = await saveReportForDate(date, true);
  if (result.ok) localStorage.setItem(key, "1");
}

async function addTask(event) {
  event.preventDefault();
  const title = els.taskInput.value.trim();
  const description = els.taskDescriptionInput.value.trim();
  if (!title) return;

  state.tasks.unshift({
    id: String(Date.now()),
    title,
    description,
    category: els.categorySelect.value,
    status: "doing",
    time_spent: 0
  });

  els.taskInput.value = "";
  els.taskDescriptionInput.value = "";
  closeAddTaskDialog();
  state.filter = "doing";
  await persist();
  render();
}

function openAddTaskDialog() {
  els.taskInput.value = "";
  els.taskDescriptionInput.value = "";
  if (typeof els.addTaskDialog.showModal === "function") {
    els.addTaskDialog.showModal();
  } else {
    els.addTaskDialog.setAttribute("open", "");
  }
  setTimeout(() => els.taskInput.focus(), 0);
}

function closeAddTaskDialog() {
  if (els.addTaskDialog.open) els.addTaskDialog.close();
  else els.addTaskDialog.removeAttribute("open");
  closeCategoryMenu();
}

function openTaskDescriptionDialog(task) {
  els.taskDescriptionTitle.textContent = task.title;
  els.taskDescriptionContent.textContent = task.description.trim() || t.noTaskDescription;
  els.taskDescriptionContent.classList.toggle("empty-description", !task.description.trim());
  if (typeof els.taskDescriptionDialog.showModal === "function") {
    els.taskDescriptionDialog.showModal();
  } else {
    els.taskDescriptionDialog.setAttribute("open", "");
  }
}

function closeTaskDescriptionDialog() {
  if (els.taskDescriptionDialog.open) els.taskDescriptionDialog.close();
  else els.taskDescriptionDialog.removeAttribute("open");
}

function toggleCategoryMenu() {
  const isOpen = els.categoryMenu.classList.toggle("open");
  els.categoryTrigger.setAttribute("aria-expanded", String(isOpen));
}

function closeCategoryMenu() {
  els.categoryMenu.classList.remove("open");
  els.categoryTrigger.setAttribute("aria-expanded", "false");
}

function setCategory(value) {
  els.categorySelect.value = value;
  els.categoryTrigger.textContent = value;
  els.categoryOptions.forEach(option => {
    const selected = option.dataset.value === value;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
  });
  closeCategoryMenu();
}

async function handleTaskClick(event) {
  const button = event.target.closest("button");
  const card = event.target.closest("[data-id]");
  if (!button || !card) return;

  const task = state.tasks.find(item => item.id === card.dataset.id);
  if (!task) return;

  if (button.dataset.action === "description") {
    openTaskDescriptionDialog(task);
    return;
  }

  if (button.dataset.action === "abort") {
    if (state.activeTaskId !== task.id) return;
    const result = await callAhk("CancelTimer", task.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    resetTimerState();
    render();
    await refreshTodayProgress();
    return;
  }

  if (state.timerLocked) return;

  if (button.dataset.action === "toggle") {
    task.status = task.status === "done" ? "doing" : "done";
    await persist();
    render();
  }

  if (button.dataset.action === "start") {
    const result = await callAhk("StartTimer", task.id);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    task.status = "doing";
    state.activeTaskId = task.id;
    state.timerLocked = true;
    await persist();
    render();
  }
}

async function persist() {
  const result = await callAhk("SaveTaskState", JSON.stringify(state.tasks));
  if (!result.ok) notify(result.message || t.saveFailed);
}

function showView(name) {
  els.taskView.classList.toggle("active", name === "task");
  els.statsView.classList.toggle("active", name === "stats");
  els.reportView.classList.toggle("active", name === "report");
  els.archiveView.classList.toggle("active", name === "archive");
}

async function openStatsView(date = getLocalDateString()) {
  showView("stats");
  els.statsDate.value = date || getLocalDateString();
  await loadStats(els.statsDate.value);
}

async function loadStats(date) {
  updateStatsTitle(date);
  const result = await callAhk("GetStats", date);
  state.currentStats = result.ok ? parseMessageJson(result.message, fallbackStats(date)) : fallbackStats(date);
  if (date === getLocalDateString()) state.fullSessions = Number(state.currentStats.full_sessions || 0);
  renderDailyProgress();
  renderStatsChart(state.currentStats);
}

function updateStatsTitle(date) {
  els.statsTitle.textContent = date === getLocalDateString() ? "今日统计" : "历史统计";
}

async function openReportView(date = getLocalDateString()) {
  showView("report");
  setReportHeaderExpanded(false);
  els.reportDate.value = date || getLocalDateString();
  await loadStats(els.reportDate.value);

  const saved = await callAhk("LoadDailyReport", els.reportDate.value);
  const loaded = saved.ok ? parseMessageJson(saved.message, { content: "" }) : { content: "" };
  const draft = buildReportDraft(state.currentStats);

  if (loaded.content) {
    const split = splitSavedReport(loaded.content);
    els.reportSummary.textContent = draft.summary;
    els.reportNotes.value = cleanLoadedReportNotes(split.notes);
  } else {
    els.reportSummary.textContent = draft.summary;
    els.reportNotes.value = "";
  }
}

async function saveReport() {
  const result = await saveReportForDate(els.reportDate.value);
  notify(result.ok ? t.reportSaved : result.message);
}

async function saveReportForDate(date, silent = false) {
  const targetDate = date || getLocalDateString();
  let summary = "";
  let notes = "";

  if (els.reportDate.value === targetDate) {
    summary = els.reportSummary.textContent.trim();
    notes = els.reportNotes.value.trim();
  } else {
    const statsResult = await callAhk("GetStats", targetDate);
    const stats = statsResult.ok ? parseMessageJson(statsResult.message, fallbackStats(targetDate)) : fallbackStats(targetDate);
    summary = buildReportDraft(stats).summary;

    const saved = await callAhk("LoadDailyReport", targetDate);
    const loaded = saved.ok ? parseMessageJson(saved.message, { content: "" }) : { content: "" };
    notes = loaded.content ? cleanLoadedReportNotes(splitSavedReport(loaded.content).notes).trim() : "";
  }

  const content = `${summary}\n\n${notes}`;
  const result = await callAhk("SaveDailyReport", targetDate, content);
  if (!silent && !result.ok) notify(result.message);
  return result;
}

async function openArchiveView() {
  showView("archive");
  const result = await callAhk("ListDailyReports");
  const items = result.ok ? parseMessageJson(result.message, []) : [];
  renderArchive(items);
}

function renderArchive(items) {
  els.archiveList.innerHTML = "";
  if (!items.length) {
    els.archiveList.append(emptyNode(t.noArchive));
    return;
  }

  items.sort((a, b) => b.date.localeCompare(a.date)).forEach(item => {
    const row = document.createElement("button");
    row.className = "archive-item";
    row.type = "button";
    row.textContent = item.date;
    row.addEventListener("click", () => openReportView(item.date));
    els.archiveList.append(row);
  });
}

function render() {
  renderTabs();
  renderTaskList();
  renderDailyProgress();
}

function renderTabs() {
  const counts = {
    all: state.tasks.length,
    doing: state.tasks.filter(task => task.status !== "done").length,
    done: state.tasks.filter(task => task.status === "done").length
  };
  const labels = { all: t.all, doing: t.doing, done: t.done };
  els.tabs.forEach(tab => {
    const filter = tab.dataset.filter;
    tab.classList.toggle("active", filter === state.filter);
    tab.textContent = "";
    tab.append(document.createTextNode(labels[filter]));
    const count = document.createElement("span");
    count.className = "tab-count";
    count.textContent = counts[filter];
    tab.append(count);
  });
}

function renderTaskList() {
  const visible = state.tasks.filter(task => {
    if (state.filter === "all") return true;
    if (state.filter === "doing") return task.status !== "done";
    return task.status === state.filter;
  });
  els.taskList.innerHTML = "";
  if (!visible.length) {
    els.taskList.append(emptyNode(t.empty));
    return;
  }
  visible.forEach(task => els.taskList.append(renderTask(task)));
}

function renderDailyProgress() {
  els.dailyProgress.innerHTML = "";
  const completed = Math.max(0, Math.min(8, Number(state.fullSessions || 0)));
  for (let index = 1; index <= 8; index += 1) {
    const dot = document.createElement("span");
    dot.className = `hour-dot ${index <= completed ? "lit" : ""}`;
    els.dailyProgress.append(dot);
  }
}

function renderTask(task) {
  const card = document.createElement("article");
  card.className = `task-card ${task.status === "done" ? "done" : ""}`;
  card.dataset.id = task.id;
  const locked = state.timerLocked;
  const active = state.activeTaskId === task.id;
  const hasDescription = Boolean(task.description.trim());

  card.innerHTML = `
    <button class="task-check" type="button" data-action="toggle" ${locked ? "disabled" : ""}>${task.status === "done" ? "\u2713" : ""}</button>
    <div class="task-main">
      <div class="task-title"></div>
      <div class="task-meta">
        <button class="description-btn ${hasDescription ? "has-description" : ""}" type="button" data-action="description" aria-label="\u67e5\u770b\u4efb\u52a1\u8bf4\u660e" title="\u67e5\u770b\u4efb\u52a1\u8bf4\u660e">\u2709</button>
        <span class="tag ${categoryClass(task.category)}"></span>
        <span>${t.accumulated} ${Number(task.time_spent || 0)}m</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="task-btn start" type="button" data-action="start" ${locked || task.status === "done" ? "disabled" : ""}>${t.start}</button>
      <button class="task-btn abort" type="button" data-action="abort" ${active ? "" : "disabled"}>${t.abort}</button>
    </div>
  `;
  card.querySelector(".task-title").textContent = task.title;
  card.querySelector(".tag").textContent = task.category;
  return card;
}

function renderStatsChart(stats) {
  els.statsChart.innerHTML = "";
  const items = stats.items
    .filter(item => Number(item.minutes || 0) > 0)
    .sort((a, b) => Number(b.minutes || 0) - Number(a.minutes || 0));
  els.statsChart.append(totalNode(Number(stats.total || 0), Number(stats.full_sessions || 0)));
  if (!items.length) {
    els.statsChart.append(emptyNode(t.noStats));
    return;
  }

  els.statsChart.append(renderPie(items, Number(stats.total || 0)));

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "chart-item";
    const minutes = Number(item.minutes || 0);
    const done = item.status === "done";
    const status = done ? "\u5df2\u5b8c\u6210" : "\u672a\u5b8c\u6210";
    row.innerHTML = `
      <div>
        <div class="chart-name"></div>
        <div class="chart-meta"></div>
      </div>
      <div class="chart-min ${minutes > 60 ? "long" : ""}">${minutes}m</div>
    `;
    row.querySelector(".chart-name").textContent = item.title;
    row.querySelector(".chart-meta").append(
      document.createTextNode(`${item.category} / `),
      statusPill(status, done)
    );
    els.statsChart.append(row);
  });
}

function statusPill(label, done) {
  const pill = document.createElement("span");
  pill.className = `status-pill ${done ? "done" : "doing"}`;
  pill.textContent = label;
  return pill;
}

function totalNode(total, fullSessions) {
  const node = document.createElement("div");
  node.className = "stats-total";
  node.innerHTML = `<span>\u603b\u65f6\u957f</span><strong>${total}m</strong><span>\u5b8c\u6574 1h\uff1a${fullSessions}/8</span>`;
  return node;
}

function renderPie(items, total) {
  const colors = ["#7ba7e8", "#72d6a4", "#f6c177", "#c4a7e7", "#f08a8a", "#8bd5ca"];
  const wrap = document.createElement("div");
  wrap.className = "pie-wrap";

  let cursor = 0;
  const segments = items.map((item, index) => {
    const minutes = Number(item.minutes || 0);
    const start = cursor;
    const end = total > 0 ? cursor + (minutes / total) * 100 : cursor;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  const pie = document.createElement("div");
  pie.className = "pie-chart";
  pie.style.background = `conic-gradient(${segments.join(", ")})`;

  const legend = document.createElement("div");
  legend.className = "pie-legend";
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "legend-item";
    const percent = total > 0 ? Math.round((Number(item.minutes || 0) / total) * 100) : 0;
    row.innerHTML = `<span class="legend-dot" style="background:${colors[index % colors.length]}"></span><span class="chart-name"></span><span>${percent}%</span>`;
    row.querySelector(".chart-name").textContent = item.title;
    legend.append(row);
  });

  wrap.append(pie, legend);
  return wrap;
}

function buildReportDraft(stats) {
  const date = stats.date;
  const total = Number(stats.total || 0);
  const fullSessions = Math.max(0, Math.min(8, Number(stats.full_sessions || 0)));
  const lines = [`\u65e5\u671f\uff1a${date}`, "\u4efb\u52a1\u7edf\u8ba1\uff1a"];
  lines.push(`\u603b\u8ba1\u4e13\u6ce8\u65f6\u95f4\uff1a${total}\u5206\u949f`);
  lines.push(`1\u5c0f\u65f6\u4e13\u6ce8\u5b8c\u6210\u60c5\u51b5\uff1a${fullSessions}/8`);
  stats.items.forEach(item => {
    const status = item.status === "done" ? "\u5df2\u5b8c\u6210" : "\u672a\u5b8c\u6210";
    lines.push(`${item.title}\u82b1\u8d39${Number(item.minutes || 0)}\u5206\u949f\uff08${status}\uff09`);
  });
  return { summary: lines.join("\n") };
}

function toggleReportHeader() {
  setReportHeaderExpanded(!els.reportHead.classList.contains("expanded"));
}

function setReportHeaderExpanded(expanded) {
  els.reportHead.classList.toggle("expanded", expanded);
  els.reportSummary.classList.toggle("expanded", expanded);
  els.summaryToggle.setAttribute("aria-expanded", String(expanded));
  els.summaryToggle.textContent = expanded ? "\u2303" : "\u2304";
}

function splitSavedReport(content) {
  const marker = "\n\n";
  const index = content.indexOf(marker);
  if (index < 0) return { summary: content, notes: "" };
  return { summary: content.slice(0, index), notes: content.slice(index + marker.length) };
}

function cleanLoadedReportNotes(notes) {
  return notes
    .replace(/^\s*\u5b66\u4e60\u60c5\u51b5\u5206\u6790\uff1a.*?(?:\r?\n|$)/u, "")
    .replace(/^\s*Learning analysis:\s*(?:\r?\n.*?(?:\r?\n|$))?/iu, "")
    .replace(/^\s*My notes:\s*(?:\r?\n)?/iu, "")
    .trimStart();
}

function fallbackStats(date) {
  const total = state.tasks.reduce((sum, task) => sum + Number(task.time_spent || 0), 0);
  return {
    date,
    total,
    full_sessions: Math.min(8, Math.floor(total / 60)),
    items: state.tasks.map(task => ({
      id: task.id,
      title: task.title,
      category: task.category,
      status: task.status,
      minutes: Number(task.time_spent || 0),
      time_spent: task.time_spent
    }))
  };
}

function emptyNode(message) {
  const node = document.createElement("div");
  node.className = "empty";
  node.textContent = message;
  return node;
}

function normalizeTask(task) {
  return {
    id: String(task.id || Date.now()),
    title: String(task.title || "Untitled"),
    description: String(task.description || ""),
    category: String(task.category || t.code),
    status: ["todo", "doing", "done"].includes(task.status) ? task.status : "doing",
    time_spent: Number(task.time_spent || 0)
  };
}

function categoryClass(category) {
  if (category.includes("\u8bba\u6587")) return "tag-paper";
  if (category.includes("\u5b66\u4e60") || category.includes("\u77e5\u8bc6")) return "tag-study";
  if (category.includes("\u5176\u4ed6")) return "tag-other";
  return "tag-code";
}

window.updateUI = function updateUI(jsonString) {
  try {
    const parsed = JSON.parse(jsonString || "[]");
    state.tasks = Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
  } catch {
    state.tasks = [];
  }
  render();
  refreshTodayProgress();
  if (hasNativeBridge()) restoreTimerState();
};

async function restoreTimerState() {
  const result = await callAhk("GetTimerState");
  const timer = result.ok
    ? parseMessageJson(result.message, { running: false, paused: false, taskId: "", percent: 0 })
    : { running: false, paused: false, taskId: "", percent: 0 };

  state.timerLocked = Boolean(timer.running);
  state.activeTaskId = timer.taskId || null;
  if (timer.running) {
    window.updateTimerProgress(timer.percent || 0);
  } else {
    resetTimerState();
  }
  render();
}

async function refreshTodayProgress() {
  const date = getLocalDateString();
  const result = await callAhk("GetStats", date);
  const stats = result.ok ? parseMessageJson(result.message, fallbackStats(date)) : fallbackStats(date);
  state.fullSessions = Number(stats.full_sessions || 0);
  renderDailyProgress();
}

window.updateTimerProgress = function updateTimerProgress(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  els.timer.classList.toggle("active", value > 0 && value < 100);
  els.timerBar.style.width = `${value}%`;
  if (value >= 100) {
    resetTimerState(false);
    setTimeout(() => {
      els.timer.classList.remove("active");
      els.timerBar.style.width = "0%";
      render();
    }, 700);
  } else if (value > 0) {
    if (!state.timerLocked) {
      state.timerLocked = true;
      render();
    }
  }
};

function resetTimerState(clearBar = true) {
  state.timerLocked = false;
  state.activeTaskId = null;
  if (clearBar) {
    els.timer.classList.remove("active");
    els.timerBar.style.width = "0%";
  }
}

window.showTaskViewFromAhk = function showTaskViewFromAhk() {
  showView("task");
};

window.openStatsFromAhk = function openStatsFromAhk() {
  openStatsView();
};

window.openReportReminderFromAhk = function openReportReminderFromAhk(date) {
  showReportReminder(date || getLocalDateString());
};

window.runScheduledMinuteTasksFromAhk = function runScheduledMinuteTasksFromAhk() {
  runScheduledMinuteTasks(true);
};

async function getAhk() {
  if (window.chrome && chrome.webview && chrome.webview.hostObjects) {
    return await chrome.webview.hostObjects.ahk;
  }
  return {
    StartTimer: async () => JSON.stringify({ ok: true, message: "preview" }),
    CancelTimer: async () => JSON.stringify({ ok: true, message: "cancelled" }),
    SaveTaskState: async json => (localStorage.setItem("flowy.todo.preview", json), JSON.stringify({ ok: true, message: "saved" })),
    GetStats: async date => JSON.stringify({ ok: true, message: JSON.stringify(fallbackStats(date)) }),
    GetTimerState: async () => JSON.stringify({ ok: true, message: JSON.stringify({ running: false, paused: false, taskId: "", percent: 0 }) }),
    SaveDailyReport: async (date, content) => (localStorage.setItem(`flowy.report.${date}`, content), JSON.stringify({ ok: true, message: "saved" })),
    LoadDailyReport: async date => JSON.stringify({ ok: true, message: JSON.stringify({ date, content: localStorage.getItem(`flowy.report.${date}`) || "" }) }),
    ListDailyReports: async () => JSON.stringify({ ok: true, message: JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith("flowy.report.")).map(k => ({ date: k.replace("flowy.report.", "") }))) })
  };
}

async function callAhk(method, ...args) {
  try {
    const ahk = await getAhk();
    let raw = "";
    if (method === "StartTimer") raw = await ahk.StartTimer(args[0] || "");
    else if (method === "CancelTimer") raw = await ahk.CancelTimer(args[0] || "");
    else if (method === "SaveTaskState") raw = await ahk.SaveTaskState(args[0] || "[]");
    else if (method === "GetStats") raw = await ahk.GetStats(args[0] || "");
    else if (method === "GetTimerState") raw = await ahk.GetTimerState();
    else if (method === "SaveDailyReport") raw = await ahk.SaveDailyReport(args[0] || "", args[1] || "");
    else if (method === "LoadDailyReport") raw = await ahk.LoadDailyReport(args[0] || "");
    else if (method === "ListDailyReports") raw = await ahk.ListDailyReports();
    else throw new Error(`Unknown AHK method: ${method}`);
    return normalizeResult(raw);
  } catch (error) {
    return { ok: false, message: error.message || String(error) };
  }
}

function normalizeResult(raw) {
  if (raw && typeof raw === "object" && "ok" in raw) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return { ok: true, message: raw }; }
  }
  return { ok: true, message: "" };
}

function parseMessageJson(message, fallback) {
  try { return JSON.parse(message); } catch { return fallback; }
}

function notify(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function hasNativeBridge() {
  return Boolean(window.chrome && chrome.webview && chrome.webview.hostObjects);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
