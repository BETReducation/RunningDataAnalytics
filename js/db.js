import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

function runsCol(uid) {
  return collection(db, "users", uid, "runs");
}
function goalsCol(uid) {
  return collection(db, "users", uid, "goals");
}

export function computePaceSecPerKm(distanceKm, durationSec) {
  if (!distanceKm || !durationSec) return null;
  return durationSec / distanceKm;
}

/* ── RUNS ── */

export async function listRuns(uid) {
  const snap = await getDocs(query(runsCol(uid), orderBy("dateISO", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addRun(uid, run) {
  const ref = await addDoc(runsCol(uid), {
    ...run,
    paceSecPerKm: computePaceSecPerKm(run.distanceKm, run.durationSec),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRun(uid, runId, updates) {
  await updateDoc(doc(db, "users", uid, "runs", runId), {
    ...updates,
    paceSecPerKm: computePaceSecPerKm(updates.distanceKm, updates.durationSec),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRun(uid, runId) {
  await deleteDoc(doc(db, "users", uid, "runs", runId));
}

/* ── GOALS ── */

export async function listGoals(uid) {
  const snap = await getDocs(query(goalsCol(uid), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addGoal(uid, goal) {
  const ref = await addDoc(goalsCol(uid), {
    ...goal,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGoal(uid, goalId, updates) {
  await updateDoc(doc(db, "users", uid, "goals", goalId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGoal(uid, goalId) {
  await deleteDoc(doc(db, "users", uid, "goals", goalId));
}
