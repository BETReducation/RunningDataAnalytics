import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { initTheme } from "./theme.js";
import { fmtMSS, computeTrainingPlan } from "./plan-engine.js";
import { listRuns, listGoals, addGoal, deleteGoal } from "./db.js";

initTheme();
renderNav("progress");
const user = await requireAuth();
document.getElementById("app-content").hidden = false;

let allRuns = [];
let goals = [];
const openPlans = new Set();

/* ── DISTANCE / TIME HELPERS ── */
function distanceLabel(km) {
  if (Math.abs(km - 5) < 0.01) return "5K";
  if (Math.abs(km - 10) < 0.01) return "10K";
  if (Math.abs(km - 21.0975) < 0.05) return "Half marathon";
  if (Math.abs(km - 42.195) < 0.05) return "Marathon";
  return km + " km";
}
function riegel(t1, d1, d2) {
  return t1 * Math.pow(d2 / d1, 1.06);
}
function computeCurrent(runs, distanceKm) {
  const tight = runs.filter((r) => Math.abs(r.distanceKm - distanceKm) <= distanceKm * 0.05);
  if (tight.length) {
    return { time: Math.min(...tight.map((r) => r.durationSec)), source: "logged" };
  }
  if (!runs.length) return null;
  const predicted = runs.map((r) => riegel(r.durationSec, r.distanceKm, distanceKm));
  return { time: Math.min(...predicted), source: "estimated" };
}
function computeProgressPct(baselineSec, currentSec, targetSec) {
  if (currentSec == null) return null;
  if (baselineSec <= targetSec) return 100;
  const raw = ((baselineSec - currentSec) / (baselineSec - targetSec)) * 100;
  return Math.max(0, Math.min(100, raw));
}
function weeksAvailable(raceDateISO) {
  if (!raceDateISO) return 16;
  const [y, m, d] = raceDateISO.split("-").map(Number);
  const race = new Date(y, m - 1, d);
  const diffDays = Math.ceil((race - new Date()) / 86400000);
  return Math.max(8, Math.min(24, Math.ceil(diffDays / 7) || 8));
}

/* ── LOAD / RELOAD ── */
async function reload() {
  [allRuns, goals] = await Promise.all([listRuns(user.uid), listGoals(user.uid)]);
  renderGoals();
}

/* ── GOAL CARDS ── */
function renderGoals() {
  const list = document.getElementById("goal-list");
  const active = goals.filter((g) => !g.archived);
  if (!active.length) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>
      <p>No goals yet. Add a race target above to start tracking progress.</p>
    </div>`;
    return;
  }
  list.innerHTML = active.map(renderGoalCard).join("");

  list.querySelectorAll("[data-delete-goal]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this goal?")) return;
      await deleteGoal(user.uid, btn.dataset.deleteGoal);
      await reload();
    });
  });
  list.querySelectorAll("[data-toggle-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.togglePlan;
      if (openPlans.has(id)) openPlans.delete(id);
      else openPlans.add(id);
      renderGoals();
    });
  });
  list.querySelectorAll(".tp-week-header[data-week-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const detail = el.nextElementSibling;
      const chev = el.querySelector(".tp-week-chevron");
      const open = detail.classList.toggle("open");
      chev.classList.toggle("open", open);
    });
  });
}

function renderGoalCard(g) {
  const current = computeCurrent(allRuns, g.distanceKm);
  const hasBaseline = g.baselineTimeSec != null;
  const pct = hasBaseline ? computeProgressPct(g.baselineTimeSec, current ? current.time : null, g.targetTimeSec) : null;
  const achieved = current != null && current.time <= g.targetTimeSec;
  const raceDateStr = g.raceDateISO
    ? new Date(g.raceDateISO + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;

  const progressBlock =
    pct == null
      ? `<div class="goal-estimated-note">Log a run to start tracking progress toward this goal.</div>`
      : `
      <div class="progress-stats">
        <span class="progress-pct">${Math.round(pct)}%</span>
        <span class="progress-label">to goal</span>
      </div>
      <div class="progress-bar-goal"><div class="progress-bar-goal-inner" style="width:${pct}%"></div></div>
      <div class="goal-compare">
        <div class="goal-compare-item"><div class="metric-label">Baseline</div><div class="goal-compare-val">${fmtMSS(g.baselineTimeSec)}</div></div>
        <div class="goal-compare-item"><div class="metric-label">Current${current && current.source === "estimated" ? " (est.)" : ""}</div><div class="goal-compare-val">${current ? fmtMSS(current.time) : "—"}</div></div>
        <div class="goal-compare-item"><div class="metric-label">Target</div><div class="goal-compare-val">${fmtMSS(g.targetTimeSec)}</div></div>
      </div>
      ${achieved ? `<div class="goal-badge-achieved">🏆 Goal achieved</div>` : ""}
      ${current && current.source === "estimated" ? `<div class="goal-estimated-note">Estimated from your other runs via the Riegel formula — log a run at this distance for a more precise reading.</div>` : ""}
    `;

  const isOpen = openPlans.has(g.id);
  const planPanel = isOpen ? renderPlanPanel(g, current) : "";

  return `
    <div class="goal-card">
      <div class="goal-header">
        <div>
          <div class="goal-name">${escapeHtml(g.raceName)}</div>
          <div class="goal-sub">${distanceLabel(g.distanceKm)} · Target ${fmtMSS(g.targetTimeSec)}${raceDateStr ? " · " + raceDateStr : ""}</div>
        </div>
        <button class="goal-menu-btn" data-delete-goal="${g.id}" aria-label="Delete goal">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      ${progressBlock}
      <div class="goal-plan-link">
        <button class="btn btn-sm" data-toggle-plan="${g.id}">${isOpen ? "Hide" : "Generate"} training plan</button>
      </div>
      ${planPanel}
    </div>
  `;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/* ── INLINE TRAINING PLAN PANEL ── */
const badgeMap = {
  easy: { cls: "tp-badge-easy", label: "Easy" },
  long: { cls: "tp-badge-long", label: "Long" },
  intervals: { cls: "tp-badge-intervals", label: "Intervals" },
  tempo: { cls: "tp-badge-tempo", label: "Threshold" },
  strength: { cls: "tp-badge-strength", label: "Strength" },
  race: { cls: "tp-badge-race", label: "Race" },
  rest: { cls: "tp-badge-rest", label: "Rest" },
};

function renderPlanPanel(g, current) {
  const weeks = weeksAvailable(g.raceDateISO);
  const startingSec = current ? current.time : g.baselineTimeSec || g.targetTimeSec * 1.1;
  const plan = computeTrainingPlan(g.targetTimeSec, g.distanceKm, startingSec, weeks);
  const allWeeks = [...plan.weeks.base, ...plan.weeks.build, ...plan.weeks.sharp, ...plan.weeks.taper];

  const paceGrid = `
    <div class="tp-pace-grid">
      <div class="tp-pace-card"><div class="tp-pace-label">Race pace</div><div class="tp-pace-val">${fmtMSS(plan.paces.race)}</div><div class="tp-pace-sub">per km</div></div>
      <div class="tp-pace-card"><div class="tp-pace-label">Intervals</div><div class="tp-pace-val">${fmtMSS(plan.paces.intC)}</div><div class="tp-pace-sub">per km · sharpen</div></div>
      <div class="tp-pace-card"><div class="tp-pace-label">Threshold</div><div class="tp-pace-val">${fmtMSS(plan.paces.thresh)}</div><div class="tp-pace-sub">per km</div></div>
      <div class="tp-pace-card"><div class="tp-pace-label">Easy / Long</div><div class="tp-pace-val">${fmtMSS(plan.paces.easy)}</div><div class="tp-pace-sub">per km</div></div>
    </div>
  `;

  const weeksHtml = allWeeks
    .map((w, i) => {
      const wId = `plan-${g.id}-w${i}`;
      const daysHtml = w.days
        .map((day) => {
          const bm = badgeMap[day.t] || badgeMap.rest;
          return `<div class="tp-day-row"><div class="tp-day-name">${day.d}</div><span class="tp-day-badge ${bm.cls}">${bm.label}</span><div class="tp-day-work${day.t === "rest" ? " is-rest" : ""}">${day.w}</div></div>`;
        })
        .join("");
      return `<div class="tp-week-row">
        <div class="tp-week-header" data-week-id="${wId}"><span class="tp-week-num">Week ${w.week}</span><span class="tp-week-focus">${w.focus}</span><span class="tp-week-km">${w.km}</span><span class="tp-week-chevron">▶</span></div>
        <div class="tp-week-detail"><div class="tp-day-grid">${daysHtml}</div></div>
      </div>`;
    })
    .join("");

  return `
    <div style="margin-top:18px;padding-top:18px;border-top:1px solid var(--border)">
      <div class="tp-disclaimer">Plan structure is generated from our 10k training engine, scaled to your goal distance and pace — best calibrated for 5k–half marathon goals. ${weeks} weeks until race day.</div>
      ${paceGrid}
      <div class="tp-week-list">${weeksHtml}</div>
    </div>
  `;
}

/* ── ADD GOAL FORM ── */
document.getElementById("g-distance").addEventListener("change", (e) => {
  document.getElementById("g-distance-custom-wrap").style.display = e.target.value === "custom" ? "" : "none";
});

document.getElementById("goal-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const distSel = document.getElementById("g-distance").value;
  const distanceKm = distSel === "custom" ? parseFloat(document.getElementById("g-distance-custom").value) : parseFloat(distSel);
  const targetTimeSec = (parseInt(document.getElementById("g-h").value) || 0) * 3600 + (parseInt(document.getElementById("g-m").value) || 0) * 60 + (parseInt(document.getElementById("g-s").value) || 0);
  if (!distanceKm || !targetTimeSec) return;

  const current = computeCurrent(allRuns, distanceKm);

  await addGoal(user.uid, {
    raceName: document.getElementById("g-name").value,
    distanceKm,
    targetTimeSec,
    raceDateISO: document.getElementById("g-date").value || null,
    baselineTimeSec: current ? current.time : null,
    baselineSource: current ? current.source : null,
  });

  document.getElementById("goal-form").reset();
  document.getElementById("g-distance-custom-wrap").style.display = "none";
  await reload();
});

await reload();
