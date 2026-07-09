const html = document.documentElement;

export function applyTheme(t) {
  html.setAttribute("data-theme", t);
  localStorage.setItem("rda-theme", t);
  document.querySelectorAll("[data-theme-icon]").forEach((btn) => {
    const sun = btn.querySelector(".icon-sun");
    const moon = btn.querySelector(".icon-moon");
    if (sun) sun.style.display = t === "dark" ? "" : "none";
    if (moon) moon.style.display = t === "light" ? "" : "none";
  });
}

export function currentTheme() {
  return html.getAttribute("data-theme") || "dark";
}

export function toggleTheme() {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
}

export function initTheme() {
  const saved = localStorage.getItem("rda-theme");
  if (saved) applyTheme(saved);
  else if (window.matchMedia("(prefers-color-scheme:light)").matches) applyTheme("light");
  else applyTheme("dark");
}
