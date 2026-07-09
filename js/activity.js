import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { initTheme } from "./theme.js";
import { fmtMSS } from "./plan-engine.js";
import { listRuns, addRun, updateRun, deleteRun } from "./db.js";

initTheme();
renderNav("activity");
const user = await requireAuth();
document.getElementById("app-content").hidden = false;

/* ── DATE HELPERS (parse as local date, not UTC, to avoid off-by-one) ── */
function parseLocalDate(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dayShort(dateISO) {
  return parseLocalDate(dateISO).toLocaleDateString(undefined, { weekday: "short" });
}
function dayNum(dateISO) {
  return parseLocalDate(dateISO).getDate();
}
function monthShort(dateISO) {
  return parseLocalDate(dateISO).toLocaleDateString(undefined, { month: "short" });
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

let runs = [];

/* ── RUN LIST ── */
function renderRunList() {
  const list = document.getElementById("run-list");
  if (!runs.length) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 4a2 2 0 100-4 2 2 0 000 4z"/><path d="M17 21l-4-6-3 2-3-5"/><path d="M3 21l4-7 3 2 3-4 4 3 4-2"/></svg>
      <p>No runs logged yet. Add your first one above.</p>
    </div>`;
    return;
  }
  list.innerHTML = runs
    .map(
      (r) => `
    <div class="run-item" data-id="${r.id}">
      <div class="run-item-date">
        <div class="run-item-day">${dayShort(r.dateISO)} · ${monthShort(r.dateISO)}</div>
        <div class="run-item-daynum">${dayNum(r.dateISO)}</div>
      </div>
      <div class="run-item-main">
        <div class="run-item-dist">${r.distanceKm} km <span class="run-type-badge rt-${r.type || "other"}">${r.type || "other"}</span></div>
        <div class="run-item-sub">${fmtDuration(r.durationSec)}${r.hrAvg ? " · " + r.hrAvg + " bpm avg" : ""}${r.timeOfDay ? " · " + r.timeOfDay : ""}</div>
      </div>
      <div class="run-item-pace">
        <div class="run-item-pace-val">${r.paceSecPerKm ? fmtMSS(r.paceSecPerKm) : "—"}</div>
        <div class="run-item-pace-sub">min/km</div>
      </div>
    </div>`
    )
    .join("");
  list.querySelectorAll(".run-item").forEach((el) => {
    el.addEventListener("click", () => openEditModal(el.dataset.id));
  });
}

function fmtDuration(sec) {
  if (!sec) return "0:00";
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = Math.floor(sec % 60);
  return (h > 0 ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

async function reload() {
  runs = await listRuns(user.uid);
  renderRunList();
}

/* ── TYPE CHIP SELECTOR ── */
function wireTypeRow(rowId) {
  const row = document.getElementById(rowId);
  row.addEventListener("click", (e) => {
    const chip = e.target.closest(".type-chip");
    if (!chip) return;
    row.querySelectorAll(".type-chip").forEach((c) => c.classList.toggle("active", c === chip));
  });
}
function getSelectedType(rowId) {
  const active = document.querySelector(`#${rowId} .type-chip.active`);
  return active ? active.dataset.type : "easy";
}
function setSelectedType(rowId, type) {
  document.querySelectorAll(`#${rowId} .type-chip`).forEach((c) => c.classList.toggle("active", c.dataset.type === type));
}
wireTypeRow("f-type-row");
wireTypeRow("e-type-row");

/* ── PACE LIVE PREVIEW ── */
function wirePacePreview(prefix) {
  const distEl = document.getElementById(`${prefix}-distance`);
  const hEl = document.getElementById(`${prefix}-dur-h`);
  const mEl = document.getElementById(`${prefix}-dur-m`);
  const sEl = document.getElementById(`${prefix}-dur-s`);
  const out = document.getElementById(`${prefix}-pace-out`);
  function update() {
    const dist = parseFloat(distEl.value);
    const durationSec = (parseInt(hEl.value) || 0) * 3600 + (parseInt(mEl.value) || 0) * 60 + (parseInt(sEl.value) || 0);
    if (dist > 0 && durationSec > 0) {
      out.textContent = fmtMSS(durationSec / dist) + " /km";
    } else {
      out.textContent = "—:— /km";
    }
  }
  [distEl, hEl, mEl, sEl].forEach((el) => el.addEventListener("input", update));
  return update;
}
wirePacePreview("f");
wirePacePreview("e");

/* ── ADD RUN FORM ── */
document.getElementById("f-date").value = todayISO();

document.getElementById("run-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("f-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";
  try {
    const durationSec = (parseInt(document.getElementById("f-dur-h").value) || 0) * 3600 + (parseInt(document.getElementById("f-dur-m").value) || 0) * 60 + (parseInt(document.getElementById("f-dur-s").value) || 0);
    await addRun(user.uid, {
      dateISO: document.getElementById("f-date").value,
      timeOfDay: document.getElementById("f-time").value || null,
      distanceKm: parseFloat(document.getElementById("f-distance").value),
      durationSec,
      hrMax: parseInt(document.getElementById("f-hr-max").value) || null,
      hrMin: parseInt(document.getElementById("f-hr-min").value) || null,
      hrAvg: parseInt(document.getElementById("f-hr-avg").value) || null,
      type: getSelectedType("f-type-row"),
      notes: document.getElementById("f-notes").value || null,
    });
    document.getElementById("run-form").reset();
    document.getElementById("f-date").value = todayISO();
    setSelectedType("f-type-row", "easy");
    document.getElementById("f-pace-out").textContent = "—:— /km";
    await reload();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save run";
  }
});

/* ── EDIT MODAL ── */
let editingId = null;
function openEditModal(id) {
  const r = runs.find((x) => x.id === id);
  if (!r) return;
  editingId = id;
  document.getElementById("e-date").value = r.dateISO;
  document.getElementById("e-time").value = r.timeOfDay || "";
  document.getElementById("e-distance").value = r.distanceKm;
  const h = Math.floor(r.durationSec / 3600),
    m = Math.floor((r.durationSec % 3600) / 60),
    s = Math.floor(r.durationSec % 60);
  document.getElementById("e-dur-h").value = h || "";
  document.getElementById("e-dur-m").value = m;
  document.getElementById("e-dur-s").value = s;
  document.getElementById("e-hr-max").value = r.hrMax || "";
  document.getElementById("e-hr-min").value = r.hrMin || "";
  document.getElementById("e-hr-avg").value = r.hrAvg || "";
  document.getElementById("e-notes").value = r.notes || "";
  setSelectedType("e-type-row", r.type || "easy");
  document.getElementById("e-pace-out").textContent = r.paceSecPerKm ? fmtMSS(r.paceSecPerKm) + " /km" : "—:— /km";
  document.getElementById("edit-modal").style.display = "flex";
}
function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
  editingId = null;
}
document.getElementById("edit-close").addEventListener("click", closeEditModal);
document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target.id === "edit-modal") closeEditModal();
});

document.getElementById("edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;
  const durationSec = (parseInt(document.getElementById("e-dur-h").value) || 0) * 3600 + (parseInt(document.getElementById("e-dur-m").value) || 0) * 60 + (parseInt(document.getElementById("e-dur-s").value) || 0);
  await updateRun(user.uid, editingId, {
    dateISO: document.getElementById("e-date").value,
    timeOfDay: document.getElementById("e-time").value || null,
    distanceKm: parseFloat(document.getElementById("e-distance").value),
    durationSec,
    hrMax: parseInt(document.getElementById("e-hr-max").value) || null,
    hrMin: parseInt(document.getElementById("e-hr-min").value) || null,
    hrAvg: parseInt(document.getElementById("e-hr-avg").value) || null,
    type: getSelectedType("e-type-row"),
    notes: document.getElementById("e-notes").value || null,
  });
  closeEditModal();
  await reload();
});

document.getElementById("edit-delete").addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("Delete this run? This can't be undone.")) return;
  await deleteRun(user.uid, editingId);
  closeEditModal();
  await reload();
});

await reload();
