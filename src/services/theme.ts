export interface ThemeDefinition {
  label: string;
  description?: string;
  variables: Record<string, string>;
}

type ThemeModule = ThemeDefinition;

const rawThemes = import.meta.glob<ThemeModule>("../themes/*.json", {
  eager: true,
  import: "default",
});

const themeRegistry: Record<string, ThemeDefinition> = {};

Object.entries(rawThemes).forEach(([path, theme]) => {
  if (path.endsWith(".example")) {
    return;
  }
  const id = extractThemeId(path);
  if (!id || !theme) {
    return;
  }
  themeRegistry[id] = theme;
});

const FALLBACK_THEME = "monokai-pro";
export const DEFAULT_THEME =
  themeRegistry[FALLBACK_THEME] ? FALLBACK_THEME : Object.keys(themeRegistry)[0] ?? FALLBACK_THEME;

export function applyTheme(name: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolvedId = themeRegistry[name] ? name : DEFAULT_THEME;
  const theme = themeRegistry[resolvedId];
  if (!theme) return;
  root.setAttribute("data-theme", resolvedId);
  Object.entries(theme.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function availableThemes() {
  return Object.entries(themeRegistry)
    .map(([id, theme]) => ({
      id,
      label: theme.label ?? id,
      description: theme.description,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function extractThemeId(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const fileName = normalized.substring(normalized.lastIndexOf("/") + 1);
  if (!fileName.endsWith(".json")) {
    return undefined;
  }
  return fileName.replace(/\.json$/, "");
}
