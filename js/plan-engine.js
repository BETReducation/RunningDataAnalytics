/* ══════════════════════════════════════════════
   PLAN ENGINE — pure, DOM-free training plan math.
   Shared by tools.js (10k calculator page) and
   progress.js (goal-based plan generation).
   ══════════════════════════════════════════════ */

/* ── FORMATTING UTILS ── */
export function fmtMSS(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}
export function fmtHMS(min) {
  const h = Math.floor(min / 60),
    m = Math.round(min % 60);
  return h + ":" + (m < 10 ? "0" : "") + m + ":00";
}
export function paceStr(secPerKm) {
  return fmtMSS(secPerKm) + "/km";
}
export function paceRange(lo, hi) {
  return fmtMSS(lo) + "–" + fmtMSS(hi);
}
export function rp(s) {
  return Math.round(s / 5) * 5;
}
export function roundKm(x) {
  return Math.round(x);
}
export function kmStr(x) {
  return roundKm(x) + " km";
}

/* ── PACE DERIVATION ──
   Generalized to any race distance: raceSecPerKm = targetTimeSec / distanceKm.
   (The original tool hard-coded a 10k denominator.) */
export function derivePaces(targetTimeSec, distanceKm) {
  const raceSec = targetTimeSec / distanceKm;
  return {
    race: raceSec,
    intA: raceSec * 0.97,
    intB: raceSec * 0.94,
    intC: raceSec * 0.91,
    thresh: raceSec * 1.06,
    easy: raceSec * 1.32,
    long: raceSec * 1.38,
    strides: raceSec * 0.88,
  };
}

/* ── VOLUME DERIVATION ──
   Tuned around 10k-scale weekly mileage (20-55 km/week). Works as a structurally
   reasonable approximation for other distances too, but is most accurate for
   5k-half marathon goals. targetMin/currentMin are in *minutes*. */
export function deriveVolumes(targetMin, currentMin, weeks) {
  const gap = currentMin - targetMin;
  const baseStart = Math.round(20 + Math.min(gap * 0.3, 10));
  const basePeak = Math.round(30 + Math.min(gap * 0.4, 16) + weeks * 0.5);
  const clampedPeak = Math.min(basePeak, 55);
  return { start: baseStart, peak: clampedPeak };
}

/* ── PHASE STRUCTURE ── */
export function buildPhaseWeeks(totalWeeks) {
  const taper = Math.max(2, Math.round(totalWeeks * 0.1));
  const remain = totalWeeks - taper;
  const base = Math.round(remain * 0.3);
  const build = Math.round(remain * 0.36);
  const sharp = remain - base - build;
  return { base, build, sharp, taper };
}

function weekVol(i, totalWeeks, volStart, volPeak) {
  const t = i / Math.max(totalWeeks - 1, 1);
  return Math.round(volStart + (volPeak - volStart) * (3 * t * t - 2 * t * t * t));
}
function deloadVol(v) {
  return Math.round(v * 0.65);
}
function isDeload(weekIndex, phaseLen) {
  return (weekIndex + 1) % 4 === 0 && phaseLen >= 4;
}
function makeWeek(weekNum, focus, vol, days) {
  return { week: weekNum, focus, km: kmStr(vol), days };
}

/**
 * Builds a full phased training plan.
 * @param {number} targetTimeSec  goal finish time, seconds
 * @param {number} distanceKm     goal race distance, km
 * @param {number} currentTimeSec current/estimated finish time at that distance, seconds
 * @param {number} weeks          weeks available until race day
 */
export function computeTrainingPlan(targetTimeSec, distanceKm, currentTimeSec, weeks) {
  const targetMin = targetTimeSec / 60;
  const currentMin = currentTimeSec / 60;

  const p = derivePaces(targetTimeSec, distanceKm);
  const vols = deriveVolumes(targetMin, currentMin, weeks);
  const phases = buildPhaseWeeks(weeks);

  const raceP = rp(p.race),
    intAP = rp(p.intA),
    intBP = rp(p.intB),
    intCP = rp(p.intC),
    thP = rp(p.thresh),
    easyP = rp(p.easy),
    longP = rp(p.long),
    stridesP = rp(p.strides);

  const loEasyB = rp(easyP + 15),
    hiEasyB = rp(easyP + 40);
  const loEasyM = rp(easyP + 5),
    hiEasyM = rp(easyP + 25);
  const loEasyS = rp(easyP - 5),
    hiEasyS = rp(easyP + 15);

  const ph0vol = vols.start + " – " + Math.round(vols.start * 1.2) + " km";
  const ph1vol = Math.round(vols.start * 1.2) + " – " + vols.peak + " km";
  const ph2vol = Math.round(vols.peak * 0.92) + " – " + vols.peak + " km";

  const phaseInfo = {
    base: { easy: [loEasyB, hiEasyB], thresh: [rp(thP + 10), rp(thP + 25)], int: [intAP, rp(intAP + 15)], vol: ph0vol },
    build: { easy: [loEasyM, hiEasyM], thresh: [rp(thP + 5), rp(thP + 15)], int: [intBP, rp(intBP + 10)], vol: ph1vol },
    sharp: { easy: [loEasyS, hiEasyS], thresh: [thP, rp(thP + 10)], int: [intCP, rp(intCP + 10)], vol: ph2vol },
    taper: {
      easy: [rp(easyP - 10), rp(easyP + 10)],
      strides: stridesP,
      race: raceP,
      vol: roundKm(vols.peak * 0.5) + " / " + roundKm(vols.peak * 0.28) + " km",
    },
  };

  let weekCounter = 1;
  const phase0Weeks = [],
    phase1Weeks = [],
    phase2Weeks = [],
    phase3Weeks = [];

  // PHASE 1: BASE
  const baseLen = phases.base;
  const baseVolStart = vols.start;
  const baseVolEnd = Math.round(vols.start * 1.18);
  for (let i = 0; i < baseLen; i++) {
    const dl = isDeload(i, baseLen);
    const rawVol = weekVol(i, baseLen, baseVolStart, baseVolEnd);
    const vol = dl ? deloadVol(rawVol) : rawVol;
    const longKm = dl ? roundKm(vol * 0.36) : Math.max(roundKm(vol * 0.38), 8);
    const easyKm = dl ? roundKm(vol * 0.22) : roundKm(vol * 0.24);
    const intKm = dl ? roundKm(vol * 0.17) : roundKm(vol * 0.19);
    const tempoKm = vol - longKm - easyKm - intKm;
    const intReps = dl ? 4 : i < 2 ? 6 : 5;
    const intDist = i < 2 ? "400 m" : "600 m";
    const intPace = i < 2 ? fmtMSS(intAP) : fmtMSS(rp(intAP + 5));
    const focus = dl ? "Deload — recovery week" : i === 0 ? "Establish routine" : i < 2 ? "Gentle progression" : i < baseLen - 1 ? "Building rhythm" : "Aerobic confidence";

    phase0Weeks.push(
      makeWeek(weekCounter++, focus, vol, [
        { d: "Mon", t: "intervals", w: `${intReps}×${intDist} @ ${intPace}/km · ${intKm} km total` },
        { d: "Tue", t: "rest", w: "Rest" },
        { d: "Wed", t: "easy", w: `Easy run ${easyKm} km @ ${fmtMSS(easyP)}/km` },
        { d: "Thu", t: "tempo", w: `${dl ? "15" : "20–22"} min tempo @ ${fmtMSS(rp(thP + 15))}/km · ${tempoKm} km total` },
        { d: "Fri", t: "strength", w: dl ? "Rest or gentle walk" : `Session ${["A", "B", "C"][i % 3]} — ${["glute & hip", "core & stability", "mobility"][i % 3]} (or rest)` },
        { d: "Sat", t: "long", w: `Long run ${longKm} km @ ${fmtMSS(longP)}/km${dl ? " — very easy" : ""}` },
        { d: "Sun", t: "rest", w: "Rest" },
      ])
    );
  }

  // PHASE 2: BUILD
  const buildLen = phases.build;
  const buildVolStart = baseVolEnd;
  const buildVolEnd = vols.peak;
  for (let i = 0; i < buildLen; i++) {
    const dl = isDeload(i, buildLen);
    const rawVol = weekVol(i, buildLen, buildVolStart, buildVolEnd);
    const vol = dl ? deloadVol(rawVol) : rawVol;
    const longKm = dl ? roundKm(vol * 0.35) : Math.min(roundKm(vol * 0.37), 16);
    const easyKm = roundKm(vol * 0.23);
    const intKm = dl ? roundKm(vol * 0.17) : Math.round(vol * 0.22);
    const tempoKm = vol - longKm - easyKm - intKm;
    const tempoMin = dl ? 20 : Math.min(Math.round((tempoKm * thP) / 60), 30);
    const intReps = dl ? 4 : i < buildLen - 2 ? 5 : 6;
    const focus = dl ? "Deload — recovery week" : i === 0 ? "Introduce 1 km reps" : i < 2 ? "Volume building" : i === buildLen - 1 ? "Volume peak + race feel" : "Stronger base";

    phase1Weeks.push(
      makeWeek(weekCounter++, focus, vol, [
        { d: "Mon", t: "intervals", w: `${intReps}×1 km @ ${fmtMSS(intBP)}/km with 90 s jog · ${intKm} km total` },
        { d: "Tue", t: "rest", w: "Rest" },
        { d: "Wed", t: "easy", w: `Easy run ${easyKm} km @ ${fmtMSS(easyP)}/km` },
        { d: "Thu", t: "tempo", w: `${tempoMin} min @ ${fmtMSS(thP)}/km · ${tempoKm} km total` },
        { d: "Fri", t: "strength", w: dl ? "Session C — mobility only" : `Session ${["A", "B", "C"][i % 3]} (or rest)` },
        { d: "Sat", t: "long", w: `Long run ${longKm} km @ ${fmtMSS(longP)}/km${i === buildLen - 1 ? " — last 2 km @ " + fmtMSS(raceP) + "/km (race feel)" : ""}` },
        { d: "Sun", t: "rest", w: "Rest" },
      ])
    );
  }

  // PHASE 3: SHARPEN
  const sharpLen = phases.sharp;
  const sharpVolStart = vols.peak;
  const sharpVolEnd = Math.round(vols.peak * 0.85);
  const tuneUpIdx = Math.round(sharpLen / 2) - 1;
  for (let i = 0; i < sharpLen; i++) {
    const dl = isDeload(i, sharpLen) && i !== tuneUpIdx;
    const tuneUp = i === tuneUpIdx;
    const rawVol = weekVol(i, sharpLen, sharpVolStart, sharpVolEnd);
    const vol = dl ? deloadVol(rawVol) : tuneUp ? Math.round(rawVol * 0.9) : rawVol;
    const longKm = dl ? roundKm(vol * 0.33) : Math.min(roundKm(vol * 0.35), 14);
    const easyKm = roundKm(vol * 0.22);
    const intKm = dl ? roundKm(vol * 0.16) : roundKm(vol * 0.24);
    const tempoKm = vol - longKm - easyKm - intKm;
    const tempoMin = dl ? 20 : Math.min(Math.round((tempoKm * thP) / 60), 30);
    const intReps = dl ? 4 : i < sharpLen - 2 ? 8 : 6;
    const focus = tuneUp ? "Tune-up race — 5k" : dl ? "Deload — recovery week" : i === 0 ? "Race-specific intensity" : i === sharpLen - 1 ? "Sharpener — final peak" : "Back to quality";

    phase2Weeks.push(
      makeWeek(
        weekCounter++,
        focus,
        vol,
        tuneUp
          ? [
              { d: "Mon", t: "intervals", w: `5×1 km @ ${fmtMSS(intBP)}/km · ${intKm} km total` },
              { d: "Tue", t: "rest", w: "Rest" },
              { d: "Wed", t: "easy", w: `Easy run ${easyKm} km — legs fresh` },
              { d: "Thu", t: "tempo", w: `22 min @ ${fmtMSS(thP)}/km · ${tempoKm} km total` },
              { d: "Fri", t: "rest", w: "Rest" },
              { d: "Sat", t: "race", w: "Parkrun 5k or time trial — go for it!" },
              { d: "Sun", t: "long", w: `Long run ${Math.round(longKm * 0.85)} km easy @ ${fmtMSS(longP)}/km` },
            ]
          : [
              { d: "Mon", t: "intervals", w: `${intReps}×800 m @ ${fmtMSS(intCP)}/km · ${intKm} km total` },
              { d: "Tue", t: "rest", w: "Rest" },
              { d: "Wed", t: "easy", w: `Easy run ${easyKm} km @ ${fmtMSS(easyP)}/km` },
              { d: "Thu", t: "tempo", w: `${tempoMin} min @ ${fmtMSS(thP)}/km · ${tempoKm} km total` },
              { d: "Fri", t: "strength", w: dl ? "Rest" : `Session ${["A", "B", "C"][i % 3]} (or rest)` },
              { d: "Sat", t: "long", w: `Long run ${longKm} km @ ${fmtMSS(longP)}/km${i === sharpLen - 1 ? "" : " with last 3 km @ " + fmtMSS(raceP) + "/km"}` },
              { d: "Sun", t: "rest", w: "Rest" },
            ]
      )
    );
  }

  // PHASE 4: TAPER
  const taperLen = phases.taper;
  const tVol1 = Math.round(vols.peak * 0.55);
  const tVol2 = Math.round(vols.peak * 0.28);
  for (let i = 0; i < taperLen; i++) {
    const lastWeek = i === taperLen - 1;
    const vol = lastWeek ? tVol2 : tVol1;
    phase3Weeks.push(
      makeWeek(
        weekCounter++,
        lastWeek ? "Race week" : "Taper — keep sharp",
        vol,
        lastWeek
          ? [
              { d: "Mon", t: "rest", w: "Rest or 20 min easy walk" },
              { d: "Tue", t: "easy", w: "20 min easy jog + 4×100 m strides" },
              { d: "Wed", t: "rest", w: "Rest" },
              { d: "Thu", t: "easy", w: "15 min easy jog — shake the legs" },
              { d: "Fri", t: "rest", w: "Rest. Prepare kit, plan travel to start, sleep early." },
              { d: "Sat", t: "rest", w: "Rest. Light walk. Eat well but not heavily." },
              { d: "Sun", t: "race", w: `Race day — target ${fmtMSS(targetTimeSec)}. Go out at ${fmtMSS(raceP)}/km and hold it.` },
            ]
          : [
              { d: "Mon", t: "intervals", w: `4×400 m @ ${fmtMSS(intCP)}/km + 4×100 m strides · ${Math.round(vol * 0.22)} km total` },
              { d: "Tue", t: "rest", w: "Rest" },
              { d: "Wed", t: "easy", w: `Easy run ${Math.round(vol * 0.25)} km @ ${fmtMSS(easyP)}/km` },
              { d: "Thu", t: "tempo", w: `12 min @ ${fmtMSS(thP)}/km + cool down · ${Math.round(vol * 0.18)} km total` },
              { d: "Fri", t: "strength", w: "Session C — mobility only" },
              { d: "Sat", t: "easy", w: `Easy run ${Math.round(vol * 0.35)} km @ ${fmtMSS(easyP)}/km — feel the freshness` },
              { d: "Sun", t: "rest", w: "Rest" },
            ]
      )
    );
  }

  let w = 1;
  const tabLabels = [
    `Phase 1 — Base (Wks ${w}–${(w = w + phases.base - 1)})`,
    `Phase 2 — Build (Wks ${++w}–${(w = w + phases.build - 1)})`,
    `Phase 3 — Sharpen (Wks ${++w}–${(w = w + phases.sharp - 1)})`,
    `Phase 4 — Taper (Wks ${++w}–${w + phases.taper - 1})`,
  ];

  return {
    paces: { race: raceP, intA: intAP, intB: intBP, intC: intCP, thresh: thP, easy: easyP, long: longP, strides: stridesP },
    volumes: vols,
    phases,
    phaseInfo,
    weeks: { base: phase0Weeks, build: phase1Weeks, sharp: phase2Weeks, taper: phase3Weeks },
    tabLabels,
    totalWeeks: weeks,
  };
}
