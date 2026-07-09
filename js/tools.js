import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { initTheme } from "./theme.js";
import { fmtMSS, fmtHMS, paceRange, computeTrainingPlan } from "./plan-engine.js";

initTheme();
renderNav("tools");
await requireAuth();
document.getElementById("app-content").hidden = false;

/* ── LOCK STATE (Yasso) ── */
const lockState = { 800: true, rec: true };
const LOCK_ICONS = {
  locked: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  unlocked: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>`,
};
function toggleLock(key) {
  lockState[key] = !lockState[key];
  const block = document.getElementById("block-" + key),
    lb = document.getElementById("lock-" + key),
    slider = document.getElementById("slider-" + key);
  if (lockState[key]) {
    block.classList.remove("is-unlocked");
    lb.classList.remove("is-unlocked");
    slider.disabled = true;
    lb.innerHTML = LOCK_ICONS.locked + (key === "800" ? " Locked to HM" : " Locked to 800 m");
    updateYasso(parseInt(document.getElementById("hm-slider").value));
  } else {
    block.classList.add("is-unlocked");
    lb.classList.add("is-unlocked");
    slider.disabled = false;
    lb.innerHTML = LOCK_ICONS.unlocked + " Unlocked";
  }
}
document.getElementById("lock-800").addEventListener("click", () => toggleLock("800"));
document.getElementById("lock-rec").addEventListener("click", () => toggleLock("rec"));

/* ── YASSO ── */
let goalReps = 10;
function buildRepList(repSec) {
  const maxReps = goalReps,
    startReps = Math.min(4, maxReps),
    steps = [];
  for (let r = startReps; r <= maxReps; r++) steps.push(r);
  const repData = [];
  if (maxReps <= 4) {
    repData.push([maxReps, "Week 1", "ready"]);
  } else {
    const total = maxReps - startReps + 1;
    steps.forEach((r, i) => {
      const week = i === 0 ? "Week 1" : i === total - 1 ? "Week " + total + "+" : "Week " + (i + 1);
      const pct = i / (total - 1);
      const type = pct < 0.35 ? "building" : pct < 0.7 ? "progressing" : "ready";
      repData.push([r, week, type]);
    });
  }
  const list = document.getElementById("rep-list");
  list.innerHTML = "";
  repData.forEach(([reps, week, type]) => {
    const pct = Math.round((reps / maxReps) * 100);
    const bc = type === "building" ? "badge-building" : type === "progressing" ? "badge-progressing" : "badge-ready";
    const row = document.createElement("div");
    row.className = "rep-row";
    row.innerHTML = `<div class="rep-num">${reps}</div><span class="rep-week">${week}</span><div class="rep-bar-wrap"><div class="rep-bar" style="width:${pct}%"></div></div><span class="rep-time">${fmtMSS(repSec)} ×${reps}</span><span class="badge ${bc}">${type}</span>`;
    list.appendChild(row);
  });
}
function getRepSec() {
  return lockState["800"] ? (parseInt(document.getElementById("hm-slider").value) * 60) / 60 : parseInt(document.getElementById("slider-800").value);
}
function getRecSec() {
  return lockState["rec"] ? getRepSec() : parseInt(document.getElementById("slider-rec").value);
}
function updateYasso(hmMin) {
  const repSec = lockState["800"] ? (hmMin * 60) / 60 : getRepSec();
  const recSec = lockState["rec"] ? repSec : getRecSec();
  document.getElementById("hm-display").textContent = fmtHMS(hmMin);
  document.getElementById("slider-display").textContent = fmtHMS(hmMin);
  document.getElementById("target-800").textContent = fmtMSS(repSec);
  document.getElementById("recovery-time").textContent = fmtMSS(recSec);
  document.getElementById("reps-display").textContent = goalReps;
  document.getElementById("km-pace").textContent = fmtMSS(repSec / 0.8);
  if (lockState["800"]) {
    document.getElementById("slider-800").value = repSec;
    document.getElementById("val-800").textContent = fmtMSS(repSec);
  }
  if (lockState["rec"]) {
    document.getElementById("slider-rec").value = recSec;
    document.getElementById("val-rec").textContent = fmtMSS(recSec);
  }
  const warmCool = 25 * 60,
    sessionSec = warmCool + goalReps * repSec + (goalReps - 1) * recSec,
    distKm = Math.round((2 + goalReps * 0.8 + (goalReps - 1) * 0.3) * 10) / 10;
  document.getElementById("session-dur").textContent = "~" + Math.round(sessionSec / 60) + " min";
  document.getElementById("session-dist").textContent = "~" + distKm + " km";
  buildRepList(repSec);
}
function updateReps() {
  goalReps = parseInt(document.getElementById("slider-reps").value);
  document.getElementById("val-reps").textContent = goalReps;
  updateYasso(parseInt(document.getElementById("hm-slider").value));
}
document.getElementById("hm-slider").addEventListener("input", (e) => updateYasso(parseInt(e.target.value)));
document.getElementById("slider-reps").addEventListener("input", updateReps);
document.getElementById("slider-800").addEventListener("input", (e) => {
  const sec = parseInt(e.target.value);
  document.getElementById("val-800").textContent = fmtMSS(sec);
  document.getElementById("target-800").textContent = fmtMSS(sec);
  document.getElementById("km-pace").textContent = fmtMSS(sec / 0.8);
  if (lockState["rec"]) {
    document.getElementById("slider-rec").value = sec;
    document.getElementById("val-rec").textContent = fmtMSS(sec);
    document.getElementById("recovery-time").textContent = fmtMSS(sec);
  }
  buildRepList(sec);
});
document.getElementById("slider-rec").addEventListener("input", (e) => {
  const sec = parseInt(e.target.value);
  document.getElementById("val-rec").textContent = fmtMSS(sec);
  document.getElementById("recovery-time").textContent = fmtMSS(sec);
  const repSec = getRepSec(),
    sessionSec = 25 * 60 + goalReps * repSec + (goalReps - 1) * sec;
  document.getElementById("session-dur").textContent = "~" + Math.round(sessionSec / 60) + " min";
});
updateYasso(110);

/* ── PACE CALC ── */
function calcPace() {
  const h = parseInt(document.getElementById("pace-h").value) || 0,
    m = parseInt(document.getElementById("pace-m").value) || 0,
    s = parseInt(document.getElementById("pace-s").value) || 0,
    dist = parseFloat(document.getElementById("pace-dist").value),
    totalSec = h * 3600 + m * 60 + s;
  if (!totalSec || !dist) return;
  const paceKm = totalSec / dist,
    paceMile = paceKm * 1.60934,
    split5k = paceKm * 5;
  document.getElementById("pace-result").textContent = fmtMSS(paceKm);
  document.getElementById("pace-mile").textContent = fmtMSS(paceMile);
  document.getElementById("pace-5k-split").textContent = fmtMSS(split5k);
}
["pace-h", "pace-m", "pace-s"].forEach((id) => document.getElementById(id).addEventListener("input", calcPace));
document.getElementById("pace-dist").addEventListener("change", calcPace);
calcPace();

/* ── HR ZONES ── */
const zones = [
  { name: "Z1 Recovery", pct: [50, 60], color: "#4dd9c0" },
  { name: "Z2 Aerobic", pct: [60, 70], color: "#4da6ff" },
  { name: "Z3 Tempo", pct: [70, 80], color: "#7b8eff" },
  { name: "Z4 Threshold", pct: [80, 90], color: "#f0a35a" },
  { name: "Z5 VO2 max", pct: [90, 100], color: "#f07a5a" },
];
function calcZones() {
  const maxHR = parseInt(document.getElementById("hr-slider").value);
  document.getElementById("hr-display").textContent = maxHR + " bpm";
  const list = document.getElementById("zone-list");
  list.innerHTML = "";
  zones.forEach((z) => {
    const lo = Math.round((maxHR * z.pct[0]) / 100),
      hi = Math.round((maxHR * z.pct[1]) / 100),
      barW = (z.pct[1] - z.pct[0]) * 2,
      barOff = (z.pct[0] - 50) * 2;
    const row = document.createElement("div");
    row.className = "zone-row";
    row.innerHTML = `<span class="zone-name">${z.name}</span><div class="zone-bar-outer"><div class="zone-bar-inner" style="width:${barW}%;margin-left:${barOff}%;background:${z.color}"></div></div><span class="zone-range" style="color:${z.color}">${lo}–${hi} bpm</span>`;
    list.appendChild(row);
  });
}
document.getElementById("hr-slider").addEventListener("input", calcZones);
calcZones();

/* ── 10K TRAINING PLAN (via plan-engine.js) ── */
let planTarget = 50,
  planCurrent = 59,
  planWeeks = 19;

const badgeMap = {
  easy: { cls: "tp-badge-easy", label: "Easy" },
  long: { cls: "tp-badge-long", label: "Long" },
  intervals: { cls: "tp-badge-intervals", label: "Intervals" },
  tempo: { cls: "tp-badge-tempo", label: "Threshold" },
  strength: { cls: "tp-badge-strength", label: "Strength" },
  race: { cls: "tp-badge-race", label: "Race" },
  rest: { cls: "tp-badge-rest", label: "Rest" },
};

function renderWeeks(weeks, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  weeks.forEach((w, wi) => {
    const wId = containerId + "-w" + wi,
      dId = containerId + "-d" + wi,
      cId = containerId + "-c" + wi;
    const div = document.createElement("div");
    div.className = "tp-week-row";
    const daysHtml = w.days
      .map((day) => {
        const bm = badgeMap[day.t] || badgeMap.rest;
        return `<div class="tp-day-row"><div class="tp-day-name">${day.d}</div><span class="tp-day-badge ${bm.cls}">${bm.label}</span><div class="tp-day-work${day.t === "rest" ? " is-rest" : ""}">${day.w}</div></div>`;
      })
      .join("");
    div.innerHTML = `<div class="tp-week-header" id="${wId}"><span class="tp-week-num">Week ${w.week}</span><span class="tp-week-focus">${w.focus}</span><span class="tp-week-km">${w.km}</span><span class="tp-week-chevron" id="${cId}">▶</span></div><div class="tp-week-detail" id="${dId}"><div class="tp-day-grid">${daysHtml}</div></div>`;
    container.appendChild(div);
    document.getElementById(wId).addEventListener("click", () => {
      const detail = document.getElementById(dId),
        chev = document.getElementById(cId);
      const open = detail.classList.toggle("open");
      chev.classList.toggle("open", open);
    });
  });
}

function generatePlan() {
  const plan = computeTrainingPlan(planTarget * 60, 10, planCurrent * 60, planWeeks);
  const { paces, phaseInfo, weeks, tabLabels } = plan;

  document.getElementById("pm-race").textContent = fmtMSS(paces.race);
  document.getElementById("pm-int").textContent = fmtMSS(paces.intC);
  document.getElementById("pm-thresh").textContent = fmtMSS(paces.thresh);
  document.getElementById("pm-easy").textContent = fmtMSS(paces.easy);

  document.getElementById("ph0-easy").textContent = paceRange(...phaseInfo.base.easy);
  document.getElementById("ph0-thresh").textContent = paceRange(...phaseInfo.base.thresh);
  document.getElementById("ph0-int").textContent = paceRange(...phaseInfo.base.int);
  document.getElementById("ph0-vol").textContent = phaseInfo.base.vol;

  document.getElementById("ph1-easy").textContent = paceRange(...phaseInfo.build.easy);
  document.getElementById("ph1-thresh").textContent = paceRange(...phaseInfo.build.thresh);
  document.getElementById("ph1-int").textContent = paceRange(...phaseInfo.build.int);
  document.getElementById("ph1-vol").textContent = phaseInfo.build.vol;

  document.getElementById("ph2-easy").textContent = paceRange(...phaseInfo.sharp.easy);
  document.getElementById("ph2-thresh").textContent = paceRange(...phaseInfo.sharp.thresh);
  document.getElementById("ph2-int").textContent = paceRange(...phaseInfo.sharp.int);
  document.getElementById("ph2-vol").textContent = phaseInfo.sharp.vol;

  document.getElementById("ph3-easy").textContent = paceRange(...phaseInfo.taper.easy);
  document.getElementById("ph3-strides").textContent = "~" + fmtMSS(phaseInfo.taper.strides);
  document.getElementById("ph3-race").textContent = fmtMSS(phaseInfo.taper.race);
  document.getElementById("ph3-vol").textContent = phaseInfo.taper.vol;

  renderWeeks(weeks.base, "tp-phase0-weeks");
  renderWeeks(weeks.build, "tp-phase1-weeks");
  renderWeeks(weeks.sharp, "tp-phase2-weeks");
  renderWeeks(weeks.taper, "tp-phase3-weeks");

  const allLabels = [...tabLabels, "Strength", "Injury rules"];
  document.querySelectorAll(".tp-phase-btn").forEach((btn, i) => {
    if (allLabels[i]) btn.textContent = allLabels[i];
  });
}

document.getElementById("sl-target").addEventListener("input", (e) => {
  planTarget = parseInt(e.target.value);
  document.getElementById("sv-target").textContent = planTarget + ":00";
  generatePlan();
});
document.getElementById("sl-current").addEventListener("input", (e) => {
  planCurrent = parseInt(e.target.value);
  document.getElementById("sv-current").textContent = planCurrent + ":00";
  generatePlan();
});
document.getElementById("sl-weeks").addEventListener("input", (e) => {
  planWeeks = parseInt(e.target.value);
  document.getElementById("sv-weeks").textContent = planWeeks + " wks";
  generatePlan();
});

generatePlan();

document.getElementById("tpPhaseTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tp-phase-btn");
  if (!btn) return;
  const target = btn.dataset.tp;
  document.querySelectorAll(".tp-phase-btn").forEach((b) => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".tp-panel").forEach((p) => p.classList.toggle("active", p.id === target));
});

document.getElementById("strengthSubTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tp-sub-btn");
  if (!btn) return;
  const target = btn.dataset.st;
  document.querySelectorAll(".tp-sub-btn").forEach((b) => b.classList.toggle("active", b === btn));
  ["stA", "stB", "stC"].forEach((id) => {
    document.getElementById(id).style.display = id === target ? "grid" : "none";
  });
});

/* ── SUBNAV ── */
document.querySelectorAll(".tools-subnav a").forEach((a) => {
  a.addEventListener("click", function () {
    document.querySelectorAll(".tools-subnav a").forEach((x) => x.classList.remove("active"));
    this.classList.add("active");
  });
});
