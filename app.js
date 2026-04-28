const APP_CONFIG = {
  appName: "HumiTrack",
  apiUrl: "",
  storageKey: "humitrack_bw_records",
  configKey: "humitrack_bw_config",
  lastSyncKey: "humitrack_bw_last_sync"
};

const USERS = [
  { id: 1, username: "admin", password: "admin123", name: "Administrator", role: "admin" },
  { id: 2, username: "ajay", password: "ajay123", name: "Ajay", role: "user" },
  { id: 3, username: "poornima", password: "poornima123", name: "Poornima", role: "user" },
  { id: 4, username: "sairam", password: "sairam123", name: "Sairam", role: "user" }
];

const ROOMS = ["Assembly Area", "Curing Room"];

const SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00"
];

const SLOT_LABELS = {
  "06:00": "6 AM", "07:00": "7 AM", "08:00": "8 AM", "09:00": "9 AM", "10:00": "10 AM",
  "11:00": "11 AM", "12:00": "12 PM", "13:00": "1 PM", "14:00": "2 PM", "15:00": "3 PM",
  "16:00": "4 PM", "17:00": "5 PM", "18:00": "6 PM", "19:00": "7 PM", "20:00": "8 PM",
  "21:00": "9 PM", "22:00": "10 PM"
};

const SEED_RECORDS = [
  { id: 1, date: "2026-04-25", room: "Assembly Area", checker: "Ajay", readings: { "06:00": 47.1, "07:00": 46.8, "08:00": 45.6, "09:00": 44.9, "10:00": 44.2, "11:00": 43.7, "12:00": 42.9, "13:00": 42.1, "14:00": 41.5, "15:00": 43.0, "16:00": 44.3, "17:00": 46.2, "18:00": 48.1, "19:00": 49.3, "20:00": 50.4, "21:00": 51.2, "22:00": 49.8 }, status: "Checked", notes: "" },
  { id: 2, date: "2026-04-25", room: "Curing Room", checker: "Ajay", readings: { "06:00": 38.9, "07:00": 39.8, "08:00": 40.2, "09:00": 41.4, "10:00": 42.3, "11:00": 43.8, "12:00": 44.2, "13:00": 44.8, "14:00": 45.1, "15:00": 45.5, "16:00": 46.0, "17:00": 47.1, "18:00": 48.2, "19:00": 49.4, "20:00": 50.1, "21:00": 50.6, "22:00": 49.9 }, status: "Checked", notes: "Stable room trend." }
];

let currentUser = null;
let records = [];
let alerts = [];
let config = { min: 38, max: 60 };
let entryDraft = {};
let reminderTimer = null;
let lastReminderHour = -1;
let activePage = "";
let syncEnabled = false;

function qs(id) {
  return document.getElementById(id);
}

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function safeReadings(readings = {}) {
  const output = {};
  SLOTS.forEach((slot) => {
    output[slot] = readings[slot] ?? null;
  });
  return output;
}

function readingsValues(readings) {
  return SLOTS
    .map((slot) => readings[slot])
    .filter((value) => value !== null && value !== "" && value !== undefined)
    .map(Number);
}

function statusClass(value) {
  if (value === "" || value === null || value === undefined || Number.isNaN(Number(value))) return "";
  const num = Number(value);
  if (num > config.max) return "high";
  if (num < config.min) return "low";
  return "ok";
}

function readingBadge(value) {
  if (value === null || value === "" || value === undefined) {
    return `<span class="muted-text">--</span>`;
  }
  const type = statusClass(value);
  return `<span class="reading ${type}">${Number(value).toFixed(1)}%</span>`;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  qs("toast-container").appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    setTimeout(() => node.remove(), 250);
  }, 3500);
}

function persistLocal() {
  localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(records));
  localStorage.setItem(APP_CONFIG.configKey, JSON.stringify(config));
  localStorage.setItem(APP_CONFIG.lastSyncKey, new Date().toISOString());
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}

async function loadRecordsFromApi() {
  if (!APP_CONFIG.apiUrl) return false;
  const data = await fetchJson(`${APP_CONFIG.apiUrl}?action=getRecords`, { method: "GET" });
  records = Array.isArray(data.records) ? data.records.map((record) => ({ ...record, readings: safeReadings(record.readings) })) : clone(SEED_RECORDS);
  if (data.config) config = data.config;
  syncEnabled = true;
  return true;
}

async function saveRecordToApi(record) {
  if (!APP_CONFIG.apiUrl) return false;
  await fetchJson(APP_CONFIG.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "saveRecord", record })
  });
  syncEnabled = true;
  return true;
}

async function saveConfigToApi(nextConfig) {
  if (!APP_CONFIG.apiUrl) return false;
  await fetchJson(APP_CONFIG.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "saveConfig", config: nextConfig })
  });
  syncEnabled = true;
  return true;
}

function buildAlerts() {
  alerts = [];
  records.forEach((record) => {
    SLOTS.forEach((slot) => {
      const value = record.readings[slot];
      if (value === null || value === "" || value === undefined) return;
      const num = Number(value);
      if (num > config.max) {
        alerts.push({ type: "high", room: record.room, date: record.date, time: slot, value: num, checker: record.checker });
      } else if (num < config.min) {
        alerts.push({ type: "low", room: record.room, date: record.date, time: slot, value: num, checker: record.checker });
      }
    });
  });
  alerts.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const badge = qs("alert-count");
  badge.textContent = String(alerts.length);
  badge.classList.toggle("hidden", alerts.length === 0);
}

async function initializeApp() {
  try {
    const localRecords = localStorage.getItem(APP_CONFIG.storageKey);
    const localConfig = localStorage.getItem(APP_CONFIG.configKey);
    records = localRecords ? JSON.parse(localRecords) : clone(SEED_RECORDS);
    config = localConfig ? JSON.parse(localConfig) : { min: 38, max: 60 };
  } catch (error) {
    records = clone(SEED_RECORDS);
    config = { min: 38, max: 60 };
  }

  try {
    await loadRecordsFromApi();
  } catch (error) {
    syncEnabled = false;
  }

  records = records.map((record) => ({ ...record, readings: safeReadings(record.readings) }));
  buildAlerts();
  populateRoomFilters();
  refreshSyncBanner();
}

function refreshSyncBanner() {
  const banner = qs("sync-banner");
  if (!banner) return;
  if (syncEnabled) {
    banner.textContent = "Google Sheets sync connected.";
    banner.className = "inline-alert muted";
  } else {
    banner.textContent = "Local mode active. Add your Google Apps Script URL in `app.js` to sync with Google Sheets.";
    banner.className = "inline-alert muted";
  }
}

function populateRoomFilters() {
  const roomOptions = [`<option value="">All Rooms</option>`]
    .concat(ROOMS.map((room) => `<option value="${room}">${room}</option>`))
    .join("");
  qs("history-room").innerHTML = roomOptions;
  qs("records-room").innerHTML = roomOptions;
}

function login() {
  const username = qs("login-username").value.trim();
  const password = qs("login-password").value.trim();
  const user = USERS.find((item) => item.username === username && item.password === password);

  if (!user) {
    qs("login-error").classList.remove("hidden");
    return;
  }

  qs("login-error").classList.add("hidden");
  currentUser = user;

  qs("login-screen").classList.remove("active");
  qs("app-screen").classList.add("active");

  qs("user-name").textContent = user.name;
  qs("user-role").textContent = user.role === "admin" ? "Administrator" : "User";
  qs("user-avatar").textContent = user.name.charAt(0).toUpperCase();

  buildNavigation();
  startHourlyReminder();
  navigate(user.role === "admin" ? "overview" : "entry");
}

function logout() {
  currentUser = null;
  activePage = "";
  lastReminderHour = -1;
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;
  qs("app-screen").classList.remove("active");
  qs("login-screen").classList.add("active");
  qs("login-username").value = "";
  qs("login-password").value = "";
}

function buildNavigation() {
  const items = currentUser.role === "admin"
    ? [
        ["overview", "Overview"],
        ["records", "All Records"],
        ["alerts", "Alerts"],
        ["users", "Users"],
        ["settings", "Settings"]
      ]
    : [
        ["entry", "Today&apos;s Entry"],
        ["history", "My History"],
        ["alerts", "Alerts"]
      ];

  qs("nav-list").innerHTML = items
    .map(([page, label]) => `<button class="nav-item" data-page="${page}" type="button">${label}</button>`)
    .join("");

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.page));
  });
}

function navigate(page) {
  activePage = page;
  document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((node) => node.classList.toggle("active", node.dataset.page === page));
  qs(`page-${page}`).classList.add("active");

  const renderers = {
    entry: renderEntryPage,
    history: renderHistoryPage,
    alerts: renderAlertsPage,
    overview: renderOverviewPage,
    records: renderRecordsPage,
    users: renderUsersPage,
    settings: renderSettingsPage
  };

  renderers[page]();
}

function ensureDraft(date) {
  ROOMS.forEach((room) => {
    const existing = records.find((record) => record.date === date && record.room === room && record.checker === currentUser.name);
    if (!entryDraft[date]) entryDraft[date] = {};
    if (!entryDraft[date][room]) {
      entryDraft[date][room] = {
        notes: existing?.notes || "",
        readings: safeReadings(existing?.readings || {})
      };
    }
  });
}

function renderEntryPage() {
  const date = qs("entry-date")?.value || todayISO();
  ensureDraft(date);

  let html = `
    <div class="banner">
      Normal range: <strong>${config.min}% to ${config.max}%</strong>. Values outside this range create alerts.
    </div>
    <div class="panel">
      <div class="entry-toolbar">
        <label class="field">
          <span>Date</span>
          <input id="entry-date" type="date" max="${todayISO()}" value="${date}">
        </label>
        <label class="field">
          <span>Checker</span>
          <input type="text" value="${currentUser.name}" disabled>
        </label>
      </div>
      <div class="room-grid">
  `;

  ROOMS.forEach((room) => {
    const draft = entryDraft[date][room];
    const filled = SLOTS.filter((slot) => draft.readings[slot] !== null && draft.readings[slot] !== "" && draft.readings[slot] !== undefined).length;
    html += `
      <article class="room-card">
        <div class="room-head">
          <div>
            <h4>${room}</h4>
            <p class="subtle">${filled}/${SLOTS.length} time slots filled</p>
          </div>
          <span class="badge ok">${currentUser.name}</span>
        </div>
        <div class="room-body">
          <div class="slot-grid">
            ${SLOTS.map((slot) => {
              const value = draft.readings[slot];
              const type = statusClass(value);
              const statusLabel = type === "high" ? "High" : type === "low" ? "Low" : type === "ok" ? "Normal" : "";
              return `
                <div class="slot-card">
                  <div class="slot-label">${SLOT_LABELS[slot]}</div>
                  <input class="slot-input ${type}" type="number" min="0" max="100" step="0.1" data-room="${room}" data-slot="${slot}" value="${value ?? ""}">
                  <div class="slot-status">${statusLabel}</div>
                </div>
              `;
            }).join("")}
          </div>
          <div class="field" style="margin-top:16px;">
            <span>Notes</span>
            <textarea data-room-notes="${room}" placeholder="Write observations or missing-reading reason">${draft.notes}</textarea>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" type="button" data-save-room="${room}">Save ${room}</button>
            <button class="btn btn-secondary" type="button" data-clear-room="${room}">Clear</button>
          </div>
        </div>
      </article>
    `;
  });

  html += "</div></div>";
  qs("entry-root").innerHTML = html;

  qs("entry-date").addEventListener("change", () => renderEntryPage());
  document.querySelectorAll(".slot-input").forEach((input) => {
    input.addEventListener("input", () => onDraftInput(input));
  });
  document.querySelectorAll("[data-room-notes]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      entryDraft[date][textarea.dataset.roomNotes].notes = textarea.value;
    });
  });
  document.querySelectorAll("[data-save-room]").forEach((button) => {
    button.addEventListener("click", () => saveRoom(button.dataset.saveRoom));
  });
  document.querySelectorAll("[data-clear-room]").forEach((button) => {
    button.addEventListener("click", () => clearRoom(button.dataset.clearRoom));
  });
}

function onDraftInput(input) {
  const date = qs("entry-date").value;
  const room = input.dataset.room;
  const slot = input.dataset.slot;
  const raw = input.value.trim();
  const value = raw === "" ? null : Number(raw);
  entryDraft[date][room].readings[slot] = Number.isNaN(value) ? null : value;

  const type = statusClass(value);
  input.className = `slot-input ${type}`.trim();
  input.nextElementSibling.textContent = type === "high" ? "High" : type === "low" ? "Low" : type === "ok" ? "Normal" : "";

  if (type === "high") toast(`${room} is above limit at ${SLOT_LABELS[slot]}: ${Number(value).toFixed(1)}%`);
  if (type === "low") toast(`${room} is below limit at ${SLOT_LABELS[slot]}: ${Number(value).toFixed(1)}%`);
}

async function saveRoom(room) {
  const date = qs("entry-date").value;
  const draft = entryDraft[date][room];
  const record = {
    id: Date.now(),
    date,
    room,
    checker: currentUser.name,
    readings: safeReadings(draft.readings),
    status: "Checked",
    notes: draft.notes || ""
  };

  const existingIndex = records.findIndex((item) => item.date === date && item.room === room && item.checker === currentUser.name);
  if (existingIndex >= 0) {
    record.id = records[existingIndex].id;
    records[existingIndex] = record;
  } else {
    records.push(record);
  }

  persistLocal();
  buildAlerts();

  try {
    await saveRecordToApi(record);
    persistLocal();
  } catch (error) {
    syncEnabled = false;
    refreshSyncBanner();
    toast("Saved locally. Google Sheets sync is not connected yet.");
  }

  refreshSyncBanner();
  toast(`${room} saved for ${formatDate(date)}`);
  navigate(activePage);
}

function clearRoom(room) {
  const date = qs("entry-date").value;
  entryDraft[date][room] = {
    notes: "",
    readings: safeReadings({})
  };
  renderEntryPage();
}

function renderHistoryPage() {
  const search = qs("history-search").value.trim().toLowerCase();
  const room = qs("history-room").value;
  const rows = records
    .filter((record) => {
      if (record.checker !== currentUser.name) return false;
      if (room && record.room !== room) return false;
      if (!search) return true;
      return record.room.toLowerCase().includes(search) || record.date.includes(search) || formatDate(record.date).includes(search);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  qs("history-root").innerHTML = rows.length ? renderTable(rows, false) : `<div class="empty-state">No history records found.</div>`;
}

function renderAlertsPage() {
  const alertRows = currentUser.role === "admin"
    ? alerts
    : alerts.filter((alert) => {
        const record = records.find((item) => item.date === alert.date && item.room === alert.room && item.checker === currentUser.name);
        return Boolean(record);
      });

  const hour = new Date().getHours();
  let html = "";
  if (hour >= 6 && hour <= 22) {
    const slot = `${String(hour).padStart(2, "0")}:00`;
    html += `<div class="banner">Hourly reminder: please enter humidity reading for <strong>${SLOT_LABELS[slot] || slot}</strong>.</div>`;
  }

  if (!alertRows.length) {
    html += `<div class="empty-state">No alert records. All saved values are inside the configured range.</div>`;
    qs("alerts-root").innerHTML = html;
    return;
  }

  const highCount = alertRows.filter((item) => item.type === "high").length;
  const lowCount = alertRows.filter((item) => item.type === "low").length;

  html += `
    <div class="alert-summary">
      <div class="alert-card"><div class="stat-label">High Alerts</div><div class="stat-value">${highCount}</div></div>
      <div class="alert-card"><div class="stat-label">Low Alerts</div><div class="stat-value">${lowCount}</div></div>
    </div>
    <div class="panel">
      <div class="alert-list">
        ${alertRows.map((alert) => `
          <div class="alert-item">
            <div class="alert-title">${alert.type === "high" ? "High Humidity" : "Low Humidity"} | ${alert.room}</div>
            <div class="alert-meta">${Number(alert.value).toFixed(1)}% at ${SLOT_LABELS[alert.time]} on ${formatDate(alert.date)} by ${alert.checker}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  qs("alerts-root").innerHTML = html;
}

function renderOverviewPage() {
  const allValues = records.flatMap((record) => readingsValues(record.readings));
  const overallAvg = allValues.length ? (allValues.reduce((sum, value) => sum + value, 0) / allValues.length).toFixed(1) : "--";
  const today = todayISO();
  const todayRecords = records.filter((record) => record.date === today);
  const checkers = [...new Set(records.map((record) => record.checker))];

  let html = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total Records</div><div class="stat-value">${records.length}</div></div>
      <div class="stat-card"><div class="stat-label">Today&apos;s Entries</div><div class="stat-value">${todayRecords.length}</div></div>
      <div class="stat-card"><div class="stat-label">Overall Average</div><div class="stat-value">${overallAvg}%</div></div>
      <div class="stat-card"><div class="stat-label">Total Alerts</div><div class="stat-value">${alerts.length}</div></div>
    </div>
    <div class="room-grid">
      <div class="today-card">
        <h4>Today&apos;s Room Status</h4>
        <div class="alert-list" style="margin-top:14px;">
          ${ROOMS.map((room) => {
            const row = todayRecords.find((record) => record.room === room);
            if (!row) {
              return `<div class="alert-item"><div class="alert-title">${room}</div><div class="alert-meta">No entry saved today.</div></div>`;
            }
            const values = readingsValues(row.readings);
            const avg = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "--";
            const high = values.filter((value) => value > config.max).length;
            const low = values.filter((value) => value < config.min).length;
            return `
              <div class="alert-item">
                <div class="alert-title">${room}</div>
                <div class="alert-meta">Avg ${avg}% | ${values.length}/${SLOTS.length} slots | ${row.checker}</div>
                <div class="alert-meta">${high ? `${high} high` : "0 high"} | ${low ? `${low} low` : "0 low"}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
      <div class="today-card">
        <h4>Checker Activity</h4>
        <div class="alert-list" style="margin-top:14px;">
          ${checkers.map((checker) => {
            const count = records.filter((record) => record.checker === checker).length;
            return `<div class="alert-item"><div class="alert-title">${checker}</div><div class="alert-meta">${count} saved records</div></div>`;
          }).join("")}
        </div>
      </div>
    </div>
  `;

  qs("overview-root").innerHTML = html;
}

function renderTable(rows, includeSlots) {
  const headers = includeSlots
    ? `
      <tr>
        <th>Date</th>
        <th>Room</th>
        <th>Checker</th>
        ${SLOTS.map((slot) => `<th>${SLOT_LABELS[slot]}</th>`).join("")}
        <th>Status</th>
        <th>Notes</th>
      </tr>
    `
    : `
      <tr>
        <th>Date</th>
        <th>Room</th>
        <th>Checker</th>
        <th>Min</th>
        <th>Max</th>
        <th>Average</th>
        <th>Alerts</th>
        <th>Slots</th>
      </tr>
    `;

  const body = rows.map((record) => {
    const values = readingsValues(record.readings);
    const min = values.length ? Math.min(...values).toFixed(1) : "--";
    const max = values.length ? Math.max(...values).toFixed(1) : "--";
    const avg = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "--";
    const high = values.filter((value) => value > config.max).length;
    const low = values.filter((value) => value < config.min).length;

    if (!includeSlots) {
      return `
        <tr>
          <td>${formatDate(record.date)}</td>
          <td>${record.room}</td>
          <td>${record.checker}</td>
          <td>${readingBadge(min === "--" ? null : min)}</td>
          <td>${readingBadge(max === "--" ? null : max)}</td>
          <td>${avg === "--" ? "--" : `${avg}%`}</td>
          <td>${high || low ? `${high} high / ${low} low` : "Normal"}</td>
          <td>${values.length}/${SLOTS.length}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${formatDate(record.date)}</td>
        <td>${record.room}</td>
        <td>${record.checker}</td>
        ${SLOTS.map((slot) => `<td>${readingBadge(record.readings[slot])}</td>`).join("")}
        <td><span class="badge ok">${record.status}</span></td>
        <td>${record.notes || "--"}</td>
      </tr>
    `;
  }).join("");

  return `<div class="table-shell"><table><thead>${headers}</thead><tbody>${body}</tbody></table></div>`;
}

function renderRecordsPage() {
  const checkerSelect = qs("records-checker");
  const currentChecker = checkerSelect.value;
  const checkerOptions = [`<option value="">All Checkers</option>`]
    .concat([...new Set(records.map((record) => record.checker))].map((checker) => `<option value="${checker}" ${checker === currentChecker ? "selected" : ""}>${checker}</option>`))
    .join("");
  checkerSelect.innerHTML = checkerOptions;

  const searchDate = qs("records-date").value.trim().toLowerCase();
  const room = qs("records-room").value;
  const checker = qs("records-checker").value;

  const rows = records
    .filter((record) => {
      if (room && record.room !== room) return false;
      if (checker && record.checker !== checker) return false;
      if (!searchDate) return true;
      return record.date.includes(searchDate) || formatDate(record.date).toLowerCase().includes(searchDate);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  qs("records-root").innerHTML = rows.length ? renderTable(rows, true) : `<div class="empty-state">No records match your filters.</div>`;
}

function renderUsersPage() {
  qs("users-root").innerHTML = `
    <div class="user-grid">
      ${USERS.map((user) => {
        const count = records.filter((record) => record.checker === user.name).length;
        return `
          <article class="user-card">
            <p class="eyebrow">${user.role}</p>
            <h4 style="margin:6px 0 8px;">${user.name}</h4>
            <p class="subtle">@${user.username}</p>
            <p style="margin-top:14px;" class="subtle">${count} saved records</p>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderSettingsPage() {
  qs("settings-root").innerHTML = `
    <div class="settings-grid">
      <div class="panel settings-panel">
        <h4>Alert Thresholds</h4>
        <div class="settings-row">
          <div>
            <div>Minimum humidity</div>
            <div class="subtle">Values below this become low alerts.</div>
          </div>
          <input id="setting-min" type="number" min="0" max="100" step="0.1" value="${config.min}" style="max-width:100px;">
        </div>
        <div class="settings-row">
          <div>
            <div>Maximum humidity</div>
            <div class="subtle">Values above this become high alerts.</div>
          </div>
          <input id="setting-max" type="number" min="0" max="100" step="0.1" value="${config.max}" style="max-width:100px;">
        </div>
        <div class="action-row">
          <button id="save-settings-button" class="btn btn-primary" type="button">Save Thresholds</button>
        </div>
      </div>
      <div class="panel settings-panel">
        <h4>Data and Reminder Notes</h4>
        <div class="alert-list" style="margin-top:14px;">
          <div class="alert-item"><div class="alert-title">Hourly reminder</div><div class="alert-meta">Users receive a reminder between 6 AM and 10 PM.</div></div>
          <div class="alert-item"><div class="alert-title">Storage</div><div class="alert-meta">${syncEnabled ? "Google Sheets sync is active." : "Currently saving locally until Google Apps Script is connected."}</div></div>
          <div class="alert-item"><div class="alert-title">Mobile app</div><div class="alert-meta">This project includes a web app that can be installed on mobile as a PWA.</div></div>
        </div>
      </div>
    </div>
  `;

  qs("save-settings-button").addEventListener("click", saveSettings);
}

async function saveSettings() {
  const min = Number(qs("setting-min").value);
  const max = Number(qs("setting-max").value);
  if (Number.isNaN(min) || Number.isNaN(max) || min >= max) {
    toast("Minimum must be less than maximum.");
    return;
  }

  config = { min, max };
  persistLocal();
  buildAlerts();

  try {
    await saveConfigToApi(config);
  } catch (error) {
    syncEnabled = false;
    refreshSyncBanner();
    toast("Thresholds saved locally. Sync is not connected yet.");
  }

  refreshSyncBanner();
  toast("Threshold settings updated.");
  navigate("settings");
}

function exportCsv() {
  const headers = ["Date", "Room", "Checker"].concat(SLOTS.map((slot) => SLOT_LABELS[slot])).concat(["Status", "Notes"]);
  const rows = records.map((record) => [
    formatDate(record.date),
    record.room,
    record.checker,
    ...SLOTS.map((slot) => record.readings[slot] ?? ""),
    record.status,
    record.notes || ""
  ]);
  const csv = [headers].concat(rows).map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `humitrack-${todayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function startHourlyReminder() {
  if (reminderTimer) clearInterval(reminderTimer);
  checkHourlyReminder();
  reminderTimer = setInterval(checkHourlyReminder, 60 * 1000);
}

function checkHourlyReminder() {
  if (!currentUser || currentUser.role === "admin") return;
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour >= 6 && hour <= 22 && minute <= 2 && hour !== lastReminderHour) {
    lastReminderHour = hour;
    const slot = `${String(hour).padStart(2, "0")}:00`;
    toast(`Reminder: enter humidity value for ${SLOT_LABELS[slot] || slot}.`);
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function wireEvents() {
  qs("login-button").addEventListener("click", login);
  qs("login-password").addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
  qs("logout-button").addEventListener("click", logout);
  qs("alerts-shortcut").addEventListener("click", () => navigate("alerts"));
  qs("history-search").addEventListener("input", renderHistoryPage);
  qs("history-room").addEventListener("change", renderHistoryPage);
  qs("records-date").addEventListener("input", renderRecordsPage);
  qs("records-room").addEventListener("change", renderRecordsPage);
  qs("records-checker").addEventListener("change", renderRecordsPage);
  qs("export-button").addEventListener("click", exportCsv);
}

initializeApp().then(() => {
  wireEvents();
  registerServiceWorker();
});
