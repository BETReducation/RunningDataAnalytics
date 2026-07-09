import { toggleTheme, applyTheme, currentTheme } from "./theme.js";
import { onAuthChange, signOutUser } from "./auth.js";

const ICONS = {
  activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" stroke="none"/><path d="M17 21l-4-6-3 2-3-5"/><path d="M3 21l4-7 3 2 3-4 4 3 4-2"/></svg>`,
  analytics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>`,
  progress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
  tools: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 10-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.8 2.8-2-2z"/></svg>`,
  sun: `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon: `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`,
  signout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

const PAGES = [
  { id: "activity", href: "index.html", label: "Activity", tab: true },
  { id: "analytics", href: "analytics.html", label: "Analytics", tab: true },
  { id: "progress", href: "progress.html", label: "Progress", tab: true },
  { id: "tools", href: "tools.html", label: "Tools", tab: false },
];

export function renderNav(activePage) {
  const container = document.getElementById("app-nav");
  if (!container) return;

  const topLinks = PAGES.map(
    (p) => `<a href="${p.href}" class="${p.id === activePage ? "active" : ""}">${p.label}</a>`
  ).join("");

  container.innerHTML = `
    <nav class="top-nav">
      <a href="index.html" class="nav-logo">RDA<span>Runner Data Analytics</span></a>
      <div class="nav-links">
        ${topLinks}
        <button class="theme-toggle" id="theme-btn" data-theme-icon aria-label="Toggle theme">${ICONS.sun}${ICONS.moon}</button>
        <button class="icon-btn" id="signout-btn" aria-label="Sign out">${ICONS.signout}</button>
        <img class="nav-avatar" id="nav-avatar" style="display:none" alt="">
      </div>
    </nav>
    <div class="bottom-tabs">
      <div class="bottom-tabs-inner">
        ${PAGES.filter((p) => p.tab)
          .map(
            (p) => `<a href="${p.href}" class="bottom-tab ${p.id === activePage ? "active" : ""}">${ICONS[p.id]}<span>${p.label}</span></a>`
          )
          .join("")}
      </div>
    </div>
  `;

  applyTheme(currentTheme());
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  document.getElementById("signout-btn").addEventListener("click", () => signOutUser());
  onAuthChange((user) => {
    const avatar = document.getElementById("nav-avatar");
    if (user && user.photoURL && avatar) {
      avatar.src = user.photoURL;
      avatar.alt = user.displayName || "";
      avatar.style.display = "";
    }
  });
}
