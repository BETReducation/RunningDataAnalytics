import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase-init.js";

const listeners = [];
let currentUser = undefined; // undefined = not yet resolved, null = signed out

if (isFirebaseConfigured) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    listeners.forEach((cb) => cb(user));
  });
}

export function onAuthChange(cb) {
  listeners.push(cb);
  if (currentUser !== undefined) cb(currentUser);
}

export function getCurrentUser() {
  return currentUser || null;
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  await signOut(auth);
  location.reload();
}

const GOOGLE_ICON = `<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.6 0-14.1 4.3-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.5-4.6 2.4-7.7 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.8 39.6 16.4 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>`;

function buildOverlay({ title, tag, showButton, errorText }) {
  let overlay = document.getElementById("auth-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "auth-overlay";
    overlay.className = "auth-overlay";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">RDA</div>
      <div class="auth-tag">${tag}</div>
      ${
        showButton
          ? `<button class="google-btn" id="google-signin-btn">${GOOGLE_ICON}Sign in with Google</button>`
          : ""
      }
      ${errorText ? `<div class="auth-error">${errorText}</div>` : ""}
    </div>
  `;
  overlay.style.display = "flex";
  if (showButton) {
    document.getElementById("google-signin-btn").addEventListener("click", async () => {
      try {
        await signInWithGoogle();
      } catch (err) {
        buildOverlay({
          title,
          tag,
          showButton: true,
          errorText: err.message || "Sign-in failed. Please try again.",
        });
      }
    });
  }
  return overlay;
}

function hideOverlay() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) overlay.style.display = "none";
}

/**
 * Blocks page content behind a sign-in gate. Resolves with the signed-in user once
 * authenticated. If Firebase hasn't been configured yet (see js/firebase-config.js),
 * shows setup instructions instead and never resolves.
 */
export function requireAuth() {
  return new Promise((resolve) => {
    if (!isFirebaseConfigured) {
      buildOverlay({
        tag: "Firebase isn't configured yet. Paste your project config into js/firebase-config.js — see README.md for the setup steps.",
        showButton: false,
      });
      return;
    }
    onAuthChange((user) => {
      if (user) {
        hideOverlay();
        resolve(user);
      } else {
        buildOverlay({
          tag: "Sign in to track your runs, analyze your training, and follow your race goals — synced across every device.",
          showButton: true,
        });
      }
    });
  });
}
