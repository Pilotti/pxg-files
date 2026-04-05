const STORAGE_KEY = "pxg_app_preferences";

export const DEFAULT_APP_PREFERENCES = {
  accent: "violet",
  density: "comfortable",
  reducedMotion: false,
  startupPage: "/inicio",
  confirmBeforeRemoving: true,
  highlightCompleted: true,
  openHomeAfterCharacterSwitch: true,
};

const ACCENT_MAP = {
  violet: {
    primary: "#8b5cf6",
    strong: "#7c3aed",
    ring: "rgba(139, 92, 246, 0.24)",
  },
  blue: {
    primary: "#3b82f6",
    strong: "#2563eb",
    ring: "rgba(59, 130, 246, 0.24)",
  },
  emerald: {
    primary: "#10b981",
    strong: "#059669",
    ring: "rgba(16, 185, 129, 0.24)",
  },
  amber: {
    primary: "#f59e0b",
    strong: "#d97706",
    ring: "rgba(245, 158, 11, 0.24)",
  },
  rose: {
    primary: "#f43f5e",
    strong: "#e11d48",
    ring: "rgba(244, 63, 94, 0.24)",
  },
  cyan: {
    primary: "#06b6d4",
    strong: "#0891b2",
    ring: "rgba(6, 182, 212, 0.24)",
  },
  indigo: {
    primary: "#6366f1",
    strong: "#4f46e5",
    ring: "rgba(99, 102, 241, 0.24)",
  },
  lime: {
    primary: "#84cc16",
    strong: "#65a30d",
    ring: "rgba(132, 204, 22, 0.24)",
  },
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
  return {
    ...DEFAULT_APP_PREFERENCES,
    ...(prefs || {}),
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
  const accent = ACCENT_MAP[safePrefs.accent] || ACCENT_MAP.violet;
  const density = DENSITY_MAP[safePrefs.density] || DENSITY_MAP.comfortable;

  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--primary-strong", accent.strong);
  root.style.setProperty("--focus-ring", accent.ring);
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
