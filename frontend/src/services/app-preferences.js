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

  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--primary-strong", accent.strong);
  root.style.setProperty("--focus-ring", accent.ring);
  root.style.setProperty("--theme-tint", accent.tint);
  root.style.setProperty("--theme-surface", accent.surface);
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
