import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { initTheme } from "./theme.js";
import { fmtMSS } from "./plan-engine.js";
import { listRuns } from "./db.js";

initTheme();
renderNav("analytics");
const user = await requireAuth();
document.getElementById("app-content").hidden = false;

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const TYPE_COLORS = {
  easy: () => cssVar("--teal"),
  long: () => cssVar("--accent"),
  tempo: () => "#f0a35a",
  interval: () => cssVar("--coral"),
  race: () => "#f05a5a",
  recovery: () => "#7b8eff",
  other: () => cssVar("--muted"),
};

const BUCKETS = [
  { name: "5K", km: 5 },
  { name: "10K", km: 10 },
  { name: "Half marathon", km: 21.0975 },
  { name: "Marathon", km: 42.195 },
];

let allRuns = [];
let periodWeeks = 8;
let typeChart = null;
let hrChart = null;

function parseLocalDate(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoOf(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function runsInPeriod() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodWeeks * 7);
  return allRuns.filter((r) => parseLocalDate(r.dateISO) >= cutoff);
}

/* ── STAT STRIP ── */
function renderStats() {
  const runs = runsInPeriod();
  const totalDistance = runs.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalDuration = runs.reduce((s, r) => s + (r.durationSec || 0), 0);
  const avgPace = totalDistance > 0 ? totalDuration / totalDistance : null;
  const hours = Math.floor(totalDuration / 3600);
  const mins = Math.round((totalDuration % 3600) / 60);

  document.getElementById("stat-strip").innerHTML = `
    <div class="metric-card"><div class="metric-label">Total distance</div><div class="metric-value">${totalDistance.toFixed(1)}</div><div class="metric-sub">km</div></div>
    <div class="metric-card"><div class="metric-label">Runs</div><div class="metric-value">${runs.length}</div><div class="metric-sub">logged</div></div>
    <div class="metric-card"><div class="metric-label">Avg pace</div><div class="metric-value">${avgPace ? fmtMSS(avgPace) : "—"}</div><div class="metric-sub">min/km</div></div>
    <div class="metric-card"><div class="metric-label">Total time</div><div class="metric-value">${hours}h ${mins}m</div><div class="metric-sub">moving</div></div>
  `;
}

/* ── RUN TYPE PER DAY CHART ── */
function renderTypeChart() {
  const runs = runsInPeriod();
  const days = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodWeeks * 7);
  for (let d = new Date(cutoff); d <= new Date(); d.setDate(d.getDate() + 1)) {
    days.push(isoOf(d));
  }
  const typesPresent = [...new Set(runs.map((r) => r.type || "other"))];
  const types = typesPresent.length ? typesPresent : ["easy"];

  const datasets = types.map((type) => ({
    label: type.charAt(0).toUpperCase() + type.slice(1),
    data: days.map((day) => runs.filter((r) => r.dateISO === day && (r.type || "other") === type).reduce((s, r) => s + (r.distanceKm || 0), 0)),
    backgroundColor: TYPE_COLORS[type] ? TYPE_COLORS[type]() : cssVar("--muted"),
    borderRadius: 2,
  }));

  if (typeChart) typeChart.destroy();
  typeChart = new Chart(document.getElementById("chart-type-day"), {
    type: "bar",
    data: { labels: days.map((d) => d.slice(5)), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: cssVar("--muted"), maxRotation: 90, autoSkip: true, font: { size: 10 } }, grid: { display: false } },
        y: { stacked: true, ticks: { color: cssVar("--muted") }, grid: { color: cssVar("--border") }, title: { display: true, text: "km", color: cssVar("--muted") } },
      },
      plugins: { legend: { labels: { color: cssVar("--text") } } },
    },
  });
}

/* ── DISTANCE BUCKETS ── */
function renderBuckets() {
  const runs = allRuns;
  const rows = BUCKETS.map((b) => {
    const matches = runs.filter((r) => r.distanceKm >= b.km * 0.9 && r.distanceKm <= b.km * 1.1);
    if (!matches.length) return { ...b, count: 0 };
    const avgSec = matches.reduce((s, r) => s + r.durationSec, 0) / matches.length;
    const avgPace = matches.reduce((s, r) => s + r.paceSecPerKm, 0) / matches.length;
    return { ...b, count: matches.length, avgSec, avgPace };
  });

  document.getElementById("bucket-list").innerHTML = rows
    .map(
      (r) => `
    <div class="bucket-row">
      <span class="bucket-name">${r.name}</span>
      <span class="bucket-count">${r.count} run${r.count === 1 ? "" : "s"}</span>
      <span class="bucket-time">${r.count ? fmtDuration(r.avgSec) : "—"}</span>
      <span class="bucket-pace">${r.count ? fmtMSS(r.avgPace) + "/km" : ""}</span>
    </div>`
    )
    .join("");
}
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = Math.floor(sec % 60);
  return (h > 0 ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

/* ── HR TREND CHART ── */
function renderHrChart() {
  const runs = runsInPeriod()
    .slice()
    .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));

  if (hrChart) hrChart.destroy();
  hrChart = new Chart(document.getElementById("chart-hr"), {
    type: "line",
    data: {
      labels: runs.map((r) => r.dateISO.slice(5)),
      datasets: [
        { label: "Max", data: runs.map((r) => r.hrMax ?? null), borderColor: cssVar("--coral"), backgroundColor: "transparent", spanGaps: false, tension: 0.3 },
        { label: "Avg", data: runs.map((r) => r.hrAvg ?? null), borderColor: cssVar("--accent"), backgroundColor: "transparent", spanGaps: false, tension: 0.3 },
        { label: "Min", data: runs.map((r) => r.hrMin ?? null), borderColor: cssVar("--teal"), backgroundColor: "transparent", spanGaps: false, tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: cssVar("--muted"), maxRotation: 90, autoSkip: true, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: cssVar("--muted") }, grid: { color: cssVar("--border") }, title: { display: true, text: "bpm", color: cssVar("--muted") } },
      },
      plugins: { legend: { labels: { color: cssVar("--text") } } },
    },
  });
}

function renderAll() {
  renderStats();
  renderTypeChart();
  renderBuckets();
  renderHrChart();
}

document.getElementById("period-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".period-tab");
  if (!btn) return;
  periodWeeks = parseInt(btn.dataset.weeks);
  document.querySelectorAll(".period-tab").forEach((b) => b.classList.toggle("active", b === btn));
  renderAll();
});

allRuns = await listRuns(user.uid);
renderAll();
