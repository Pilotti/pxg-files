import Providers from '@/components/providers'
import '@/styles/global.css'
import '@/styles/dashboard-page.css'
import '@/styles/auth-page.css'
import '@/styles/configuracoes-page.css'
import '@/styles/account-characters-section.css'
import '@/styles/character-modal.css'
import '@/styles/admin-page.css'
import '@/styles/admin-login-page.css'
import '@/styles/quests-page.css'
import '@/styles/tasks-page.css'
import '@/styles/app-toast.css'
import '@/styles/status-overlay.css'
import '@/styles/error-boundary.css'

const APP_PREFERENCES_BOOTSTRAP_SCRIPT = `
(() => {
  const storageKeys = ["pxgfiles.app_preferences", "pxg_app_preferences"];
  const defaultPreferences = {
    accent: "malefic",
    density: "comfortable",
    reducedMotion: false,
  };
  const legacyAccentMap = {
    violet: "malefic",
    blue: "seavell",
    emerald: "naturia",
    amber: "raibolt",
    rose: "psycraft",
    cyan: "seavell",
    indigo: "malefic",
    lime: "naturia",
  };
  const accentMap = {
    volcanic: { primary: "#ef4444", strong: "#b91c1c", ring: "rgba(239, 68, 68, 0.28)", tint: "rgba(239, 68, 68, 0.22)", surface: "rgba(80, 22, 24, 0.38)" },
    raibolt: { primary: "#d4a411", strong: "#976b00", ring: "rgba(212, 164, 17, 0.28)", tint: "rgba(212, 164, 17, 0.18)", surface: "rgba(64, 45, 8, 0.44)" },
    orebound: { primary: "#111827", strong: "#030712", ring: "rgba(148, 163, 184, 0.28)", tint: "rgba(148, 163, 184, 0.16)", surface: "rgba(10, 14, 20, 0.52)" },
    naturia: { primary: "#22c55e", strong: "#15803d", ring: "rgba(34, 197, 94, 0.28)", tint: "rgba(34, 197, 94, 0.2)", surface: "rgba(18, 64, 36, 0.36)" },
    gardestrike: { primary: "#92400e", strong: "#78350f", ring: "rgba(180, 83, 9, 0.28)", tint: "rgba(180, 83, 9, 0.2)", surface: "rgba(66, 40, 20, 0.4)" },
    ironhard: { primary: "#6b7280", strong: "#4b5563", ring: "rgba(107, 114, 128, 0.3)", tint: "rgba(107, 114, 128, 0.18)", surface: "rgba(46, 54, 66, 0.38)" },
    wingeon: { primary: "#b8c2d1", strong: "#8290a7", ring: "rgba(184, 194, 209, 0.28)", tint: "rgba(184, 194, 209, 0.12)", surface: "rgba(49, 59, 79, 0.48)" },
    psycraft: { primary: "#ec4899", strong: "#be185d", ring: "rgba(236, 72, 153, 0.3)", tint: "rgba(236, 72, 153, 0.2)", surface: "rgba(93, 34, 74, 0.38)" },
    seavell: { primary: "#3b82f6", strong: "#1d4ed8", ring: "rgba(59, 130, 246, 0.28)", tint: "rgba(59, 130, 246, 0.2)", surface: "rgba(26, 54, 102, 0.36)" },
    malefic: { primary: "#8b5cf6", strong: "#6d28d9", ring: "rgba(139, 92, 246, 0.3)", tint: "rgba(139, 92, 246, 0.2)", surface: "rgba(55, 34, 94, 0.38)" },
  };
  const densityMap = {
    comfortable: { control: "44px", contentGap: "18px", cardPadding: "22px", sectionPadding: "24px", radius: "22px" },
    compact: { control: "38px", contentGap: "12px", cardPadding: "16px", sectionPadding: "18px", radius: "18px" },
  };

  function hexToRgb(hex) {
    const value = String(hex || "").trim().replace("#", "");
    const normalized = value.length === 3
      ? value.split("").map((chunk) => \`\${chunk}\${chunk}\`).join("")
      : value;

    if (normalized.length !== 6) return null;

    const parsed = Number.parseInt(normalized, 16);
    if (Number.isNaN(parsed)) return null;

    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    };
  }

  function getRelativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;

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
        primarySoftBackground: \`color-mix(in srgb, \${accent.primary} 20%, rgba(194, 203, 218, 0.34))\`,
        primarySoftBackgroundAlt: \`color-mix(in srgb, \${accent.primary} 10%, rgba(148, 163, 184, 0.18))\`,
        primarySoftBorder: \`color-mix(in srgb, \${accent.primary} 34%, rgba(15, 23, 42, 0.2))\`,
        primaryShadow: \`color-mix(in srgb, \${accent.primary} 22%, transparent)\`,
        appBgTop: \`color-mix(in srgb, \${accent.primary} 14%, rgba(10, 15, 28, 0.96))\`,
        appBgBottom: \`color-mix(in srgb, \${accent.strong} 18%, rgba(7, 11, 21, 0.98))\`,
        panelSurface: \`color-mix(in srgb, \${accent.primary} 14%, rgba(13, 19, 34, 0.84))\`,
        panelSurfaceStrong: \`color-mix(in srgb, \${accent.strong} 18%, rgba(8, 13, 24, 0.94))\`,
        fieldSurface: \`color-mix(in srgb, \${accent.primary} 11%, rgba(15, 23, 42, 0.64))\`,
        fieldSurfaceHover: \`color-mix(in srgb, \${accent.primary} 16%, rgba(15, 23, 42, 0.74))\`,
        fieldBorder: \`color-mix(in srgb, \${accent.primary} 30%, rgba(148, 163, 184, 0.24))\`,
        menuText: "#0f172a",
        menuTextSoft: "rgba(15, 23, 42, 0.72)",
        menuSurface: \`color-mix(in srgb, \${accent.primary} 16%, rgba(19, 28, 48, 0.88))\`,
        menuSurfaceStrong: \`color-mix(in srgb, \${accent.primary} 22%, rgba(12, 18, 33, 0.96))\`,
        menuBorder: \`color-mix(in srgb, \${accent.primary} 32%, rgba(148, 163, 184, 0.18))\`,
        menuHover: \`color-mix(in srgb, \${accent.primary} 16%, rgba(255, 255, 255, 0.06))\`,
        menuActive: \`color-mix(in srgb, \${accent.primary} 24%, rgba(255, 255, 255, 0.12))\`,
        brandSurface: \`linear-gradient(135deg, color-mix(in srgb, \${accent.primary} 20%, rgba(20, 30, 51, 0.92)), color-mix(in srgb, \${accent.strong} 16%, rgba(13, 19, 34, 0.94)))\`,
        brandBorder: \`color-mix(in srgb, \${accent.primary} 38%, rgba(148, 163, 184, 0.18))\`,
      };
    }

    return {
      onPrimary: "#f8fafc",
      primarySoftText: "#dbe8ff",
      primarySoftBackground: \`color-mix(in srgb, \${accent.primary} 16%, rgba(8, 18, 38, 0.56))\`,
      primarySoftBackgroundAlt: \`color-mix(in srgb, \${accent.primary} 6%, rgba(8, 18, 38, 0.12))\`,
      primarySoftBorder: \`color-mix(in srgb, \${accent.primary} 30%, rgba(255, 255, 255, 0.12))\`,
      primaryShadow: \`color-mix(in srgb, \${accent.primary} 30%, transparent)\`,
      appBgTop: \`color-mix(in srgb, \${accent.primary} 16%, rgba(8, 13, 25, 0.98))\`,
      appBgBottom: \`color-mix(in srgb, \${accent.strong} 22%, rgba(4, 7, 15, 0.99))\`,
      panelSurface: \`color-mix(in srgb, \${accent.primary} 12%, rgba(9, 16, 31, 0.78))\`,
      panelSurfaceStrong: \`color-mix(in srgb, \${accent.strong} 18%, rgba(7, 14, 27, 0.92))\`,
      fieldSurface: \`color-mix(in srgb, \${accent.primary} 10%, rgba(255, 255, 255, 0.04))\`,
      fieldSurfaceHover: \`color-mix(in srgb, \${accent.primary} 14%, rgba(255, 255, 255, 0.06))\`,
      fieldBorder: \`color-mix(in srgb, \${accent.primary} 28%, rgba(255, 255, 255, 0.12))\`,
      menuText: "#eef4ff",
      menuTextSoft: "rgba(216, 226, 255, 0.74)",
      menuSurface: \`color-mix(in srgb, \${accent.primary} 14%, rgba(8, 18, 38, 0.95))\`,
      menuSurfaceStrong: \`color-mix(in srgb, \${accent.strong} 18%, rgba(7, 16, 33, 0.98))\`,
      menuBorder: \`color-mix(in srgb, \${accent.primary} 34%, rgba(255, 255, 255, 0.08))\`,
      menuHover: \`color-mix(in srgb, \${accent.primary} 18%, rgba(255, 255, 255, 0.06))\`,
      menuActive: \`color-mix(in srgb, \${accent.primary} 26%, rgba(255, 255, 255, 0.1))\`,
      brandSurface: \`linear-gradient(135deg, color-mix(in srgb, \${accent.primary} 18%, rgba(13, 23, 43, 0.92)), color-mix(in srgb, \${accent.strong} 18%, rgba(8, 18, 38, 0.94)))\`,
      brandBorder: \`color-mix(in srgb, \${accent.primary} 36%, rgba(255, 255, 255, 0.14))\`,
    };
  }

  function readPreferences() {
    for (const key of storageKeys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        return JSON.parse(raw);
      } catch {
        window.localStorage.removeItem(key);
      }
    }

    return null;
  }

  const stored = readPreferences();
  const accentKey = legacyAccentMap[stored?.accent] || stored?.accent || defaultPreferences.accent;
  const accent = accentMap[accentKey] || accentMap[defaultPreferences.accent];
  const density = densityMap[stored?.density] || densityMap[defaultPreferences.density];
  const themeTokens = buildThemeTokens(accent);
  const root = document.documentElement;

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
  root.style.setProperty("--theme-app-bg-top", themeTokens.appBgTop);
  root.style.setProperty("--theme-app-bg-bottom", themeTokens.appBgBottom);
  root.style.setProperty("--theme-panel-surface", themeTokens.panelSurface);
  root.style.setProperty("--theme-panel-surface-strong", themeTokens.panelSurfaceStrong);
  root.style.setProperty("--theme-field-surface", themeTokens.fieldSurface);
  root.style.setProperty("--theme-field-surface-hover", themeTokens.fieldSurfaceHover);
  root.style.setProperty("--theme-field-border", themeTokens.fieldBorder);
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
  root.dataset.density = stored?.density || defaultPreferences.density;
  root.dataset.reducedMotion = stored?.reducedMotion ? "true" : "false";
})();
`

export const metadata = {
  title: 'PXG Files',
  description: 'Game companion app',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <script dangerouslySetInnerHTML={{ __html: APP_PREFERENCES_BOOTSTRAP_SCRIPT }} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
