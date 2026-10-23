export type Theme = "light" | "dark";

const STORAGE_KEY = "mars-theme";

export function getInitialTheme(): Theme {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("theme");
  if (requested === "light" || requested === "dark") {
    return requested;
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}
