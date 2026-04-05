const STORAGE_KEY = "pxg_app_preferences";

export const DEFAULT_APP_PREFERENCES = {
  accent: "malefic",
  density: "comfortable",
  reducedMotion: false,
  startupPage: "/inicio",
  confirmBeforeRemoving: true,
  highlightCompleted: true,
  openHomeAfterCharacterSwitch: true,
};

const ACCENT_MAP = {
  volcanic: {
    primary: "#ef4444",
    strong: "#b91c1c",
    ring: "rgba(239, 68, 68, 0.28)",
    tint: "rgba(239, 68, 68, 0.22)",
    surface: "rgba(80, 22, 24, 0.38)",
  },
  raibolt: {
    primary: "#facc15",
    strong: "#ca8a04",
    ring: "rgba(250, 204, 21, 0.28)",
    tint: "rgba(250, 204, 21, 0.2)",
    surface: "rgba(76, 58, 14, 0.36)",
  },
  orebound: {
    primary: "#111827",
    strong: "#030712",
    ring: "rgba(148, 163, 184, 0.28)",
    tint: "rgba(148, 163, 184, 0.16)",
    surface: "rgba(10, 14, 20, 0.52)",
  },
  naturia: {
    primary: "#22c55e",
    strong: "#15803d",
    ring: "rgba(34, 197, 94, 0.28)",
    tint: "rgba(34, 197, 94, 0.2)",
    surface: "rgba(18, 64, 36, 0.36)",
  },
  gardestrike: {
    primary: "#92400e",
    strong: "#78350f",
    ring: "rgba(180, 83, 9, 0.28)",
    tint: "rgba(180, 83, 9, 0.2)",
    surface: "rgba(66, 40, 20, 0.4)",
  },
  ironhard: {
    primary: "#6b7280",
    strong: "#4b5563",
    ring: "rgba(107, 114, 128, 0.3)",
    tint: "rgba(107, 114, 128, 0.18)",
    surface: "rgba(46, 54, 66, 0.38)",
  },
  wingeon: {
    primary: "#e5e7eb",
    strong: "#cbd5e1",
    ring: "rgba(229, 231, 235, 0.3)",
    tint: "rgba(229, 231, 235, 0.16)",
    surface: "rgba(90, 101, 121, 0.34)",
  },
  psycraft: {
    primary: "#ec4899",
    strong: "#be185d",
    ring: "rgba(236, 72, 153, 0.3)",
    tint: "rgba(236, 72, 153, 0.2)",
    surface: "rgba(93, 34, 74, 0.38)",
  },
  seavell: {
    primary: "#3b82f6",
    strong: "#1d4ed8",
    ring: "rgba(59, 130, 246, 0.28)",
    tint: "rgba(59, 130, 246, 0.2)",
    surface: "rgba(26, 54, 102, 0.36)",
  },
  malefic: {
    primary: "#8b5cf6",
    strong: "#6d28d9",
    ring: "rgba(139, 92, 246, 0.3)",
    tint: "rgba(139, 92, 246, 0.2)",
    surface: "rgba(55, 34, 94, 0.38)",
  },
};

const LEGACY_ACCENT_MAP = {
  violet: "malefic",
  blue: "seavell",
  emerald: "naturia",
  amber: "raibolt",
  rose: "psycraft",
  cyan: "seavell",
  indigo: "malefic",
  lime: "naturia",
};

const DENSITY_MAP = {
  comfortable: {
    control: "44px",
    contentGap: "18px",
    cardPadding: "22px",
    sectionPadding: "24px",
    radius: "22px",
  },
  compact: {
    control: "38px",
    contentGap: "12px",
    cardPadding: "16px",
    sectionPadding: "18px",
    radius: "18px",
  },
};

function hexToRgb(hex) {
  const value = String(hex || "").trim().replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((chunk) => `${chunk}${chunk}`).join("")
    : value;

  if (normalized.length !== 6) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 16);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function getRelativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }

  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function buildThemeTokens(accent) {
  const isLightAccent = getRelativeLuminance(accent.primary) >= 0.58;

  if (isLightAccent) {
    return {
      onPrimary: "#0f172a",
      primarySoftText: "#0f172a",
      primarySoftBackground: `color-mix(in srgb, ${accent.primary} 18%, rgba(255, 255, 255, 0.88))`,
      primarySoftBackgroundAlt: `color-mix(in srgb, ${accent.primary} 10%, rgba(248, 250, 252, 0.76))`,
      primarySoftBorder: `color-mix(in srgb, ${accent.primary} 36%, rgba(15, 23, 42, 0.14))`,
      primaryShadow: `color-mix(in srgb, ${accent.primary} 22%, transparent)`,
      menuText: "#0f172a",
      menuTextSoft: "rgba(15, 23, 42, 0.72)",
      menuSurface: `color-mix(in srgb, ${accent.primary} 18%, rgba(248, 250, 252, 0.9))`,
      menuSurfaceStrong: `color-mix(in srgb, ${accent.primary} 24%, rgba(255, 255, 255, 0.96))`,
      menuBorder: `color-mix(in srgb, ${accent.primary} 40%, rgba(15, 23, 42, 0.16))`,
      menuHover: `color-mix(in srgb, ${accent.primary} 14%, rgba(15, 23, 42, 0.08))`,
      menuActive: `color-mix(in srgb, ${accent.primary} 30%, rgba(255, 255, 255, 0.62))`,
      brandSurface: `linear-gradient(135deg, color-mix(in srgb, ${accent.primary} 28%, rgba(255, 255, 255, 0.94)), color-mix(in srgb, ${accent.strong} 12%, rgba(248, 250, 252, 0.9)))`,
      brandBorder: `color-mix(in srgb, ${accent.primary} 50%, rgba(15, 23, 42, 0.18))`,
    };
  }

  return {
    onPrimary: "#f8fafc",
    primarySoftText: "#dbe8ff",
    primarySoftBackground: `color-mix(in srgb, ${accent.primary} 16%, rgba(8, 18, 38, 0.56))`,
    primarySoftBackgroundAlt: `color-mix(in srgb, ${accent.primary} 6%, rgba(8, 18, 38, 0.12))`,
    primarySoftBorder: `color-mix(in srgb, ${accent.primary} 30%, rgba(255, 255, 255, 0.12))`,
    primaryShadow: `color-mix(in srgb, ${accent.primary} 30%, transparent)`,
    menuText: "#eef4ff",
    menuTextSoft: "rgba(216, 226, 255, 0.74)",
    menuSurface: `color-mix(in srgb, ${accent.primary} 14%, rgba(8, 18, 38, 0.95))`,
    menuSurfaceStrong: `color-mix(in srgb, ${accent.strong} 18%, rgba(7, 16, 33, 0.98))`,
    menuBorder: `color-mix(in srgb, ${accent.primary} 34%, rgba(255, 255, 255, 0.08))`,
    menuHover: `color-mix(in srgb, ${accent.primary} 18%, rgba(255, 255, 255, 0.06))`,
    menuActive: `color-mix(in srgb, ${accent.primary} 26%, rgba(255, 255, 255, 0.1))`,
    brandSurface: `linear-gradient(135deg, color-mix(in srgb, ${accent.primary} 18%, rgba(13, 23, 43, 0.92)), color-mix(in srgb, ${accent.strong} 18%, rgba(8, 18, 38, 0.94)))`,
    brandBorder: `color-mix(in srgb, ${accent.primary} 36%, rgba(255, 255, 255, 0.14))`,
  };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizePreferences(prefs = {}) {
  const merged = {
    ...DEFAULT_APP_PREFERENCES,
    ...(prefs || {}),
  };

  const normalizedAccent = LEGACY_ACCENT_MAP[merged.accent] || merged.accent;
  merged.accent = ACCENT_MAP[normalizedAccent] ? normalizedAccent : DEFAULT_APP_PREFERENCES.accent;

  return {
    ...merged,
  };
}

export function readAppPreferences() {
  if (!isBrowser()) {
    return { ...DEFAULT_APP_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_APP_PREFERENCES };
    }

    return normalizePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export function getAppPreferences() {
  return readAppPreferences();
}

export function applyAppPreferences(prefs = {}) {
  if (typeof document === "undefined") return;

  const safePrefs = normalizePreferences(prefs);
  const root = document.documentElement;
  const accent = ACCENT_MAP[safePrefs.accent] || ACCENT_MAP.malefic;
  const density = DENSITY_MAP[safePrefs.density] || DENSITY_MAP.comfortable;
  const themeTokens = buildThemeTokens(accent);

  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--primary-strong", accent.strong);
  root.style.setProperty("--focus-ring", accent.ring);
  root.style.setProperty("--theme-tint", accent.tint);
  root.style.setProperty("--theme-surface", accent.surface);
  root.style.setProperty("--theme-on-primary", themeTokens.onPrimary);
  root.style.setProperty("--theme-primary-soft-text", themeTokens.primarySoftText);
  root.style.setProperty("--theme-primary-soft-bg", themeTokens.primarySoftBackground);
  root.style.setProperty("--theme-primary-soft-bg-alt", themeTokens.primarySoftBackgroundAlt);
  root.style.setProperty("--theme-primary-soft-border", themeTokens.primarySoftBorder);
  root.style.setProperty("--theme-primary-shadow", themeTokens.primaryShadow);
  root.style.setProperty("--theme-menu-text", themeTokens.menuText);
  root.style.setProperty("--theme-menu-text-soft", themeTokens.menuTextSoft);
  root.style.setProperty("--theme-menu-surface", themeTokens.menuSurface);
  root.style.setProperty("--theme-menu-surface-strong", themeTokens.menuSurfaceStrong);
  root.style.setProperty("--theme-menu-border", themeTokens.menuBorder);
  root.style.setProperty("--theme-menu-hover", themeTokens.menuHover);
  root.style.setProperty("--theme-menu-active", themeTokens.menuActive);
  root.style.setProperty("--theme-brand-surface", themeTokens.brandSurface);
  root.style.setProperty("--theme-brand-border", themeTokens.brandBorder);
  root.style.setProperty("--ui-control-height", density.control);
  root.style.setProperty("--ui-gap", density.contentGap);
  root.style.setProperty("--ui-card-padding", density.cardPadding);
  root.style.setProperty("--ui-section-padding", density.sectionPadding);
  root.style.setProperty("--ui-radius", density.radius);

  root.dataset.density = safePrefs.density;
  root.dataset.reducedMotion = safePrefs.reducedMotion ? "true" : "false";
}

export function initializeAppPreferences() {
  const prefs = readAppPreferences();
  applyAppPreferences(prefs);
  return prefs;
}

export function saveAppPreferences(nextPreferences = {}) {
  const normalized = normalizePreferences(nextPreferences);

  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  applyAppPreferences(normalized);
  return normalized;
}

export function updateAppPreferences(patch = {}) {
  const current = readAppPreferences();
  return saveAppPreferences({
    ...current,
    ...(patch || {}),
  });
}

export function resetAppPreferences() {
  if (isBrowser()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  applyAppPreferences(DEFAULT_APP_PREFERENCES);
  return { ...DEFAULT_APP_PREFERENCES };
}

export function getStartupPagePreference() {
  return readAppPreferences().startupPage || "/inicio";
}

export function getConfirmBeforeRemovingPreference() {
  return Boolean(readAppPreferences().confirmBeforeRemoving);
}

export function getHighlightCompletedPreference() {
  return Boolean(readAppPreferences().highlightCompleted);
}

export function shouldOpenHomeAfterCharacterSwitch() {
  return Boolean(readAppPreferences().openHomeAfterCharacterSwitch);
}

/* aliases de compatibilidade */
export function getConfirmBeforeRemoving() {
  return getConfirmBeforeRemovingPreference();
}

export function getHighlightCompleted() {
  return getHighlightCompletedPreference();
}

export function getOpenHomeAfterCharacterSwitch() {
  return shouldOpenHomeAfterCharacterSwitch();
}

export function shouldGoHomeAfterCharacterSwitch() {
  return shouldOpenHomeAfterCharacterSwitch();
}

export function exportAppPreferences() {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      preferences: readAppPreferences(),
    },
    null,
    2,
  );
}

export function importAppPreferences(jsonText) {
  const parsed = JSON.parse(jsonText);
  return saveAppPreferences(parsed.preferences || parsed);
}
