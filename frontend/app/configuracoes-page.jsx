import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "@/lib/react-router-compat"
import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import AccountCharactersSection from "../components/account-characters-section.jsx"
import { useAuth } from "../context/auth-context.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { useI18n } from "../context/i18n-context.jsx"
import {
  APP_ACCENT_OPTIONS,
  DEFAULT_APP_PREFERENCES,
  readAppPreferences,
  resetAppPreferences,
  saveAppPreferences,
} from "../services/app-preferences.js"
import "../styles/configuracoes-page.css"

function getActiveTab(search) {
  const params = new URLSearchParams(search)
  const rawTab = params.get("aba")
  const legacyMap = {
    conta: "personagens",
    sessao: "preferencias",
  }
  const aba = legacyMap[rawTab] || rawTab
  return ["personagens", "aparencia", "preferencias"].includes(aba) ? aba : "personagens"
}

function buildExportFile(preferences) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      preferences,
    },
    null,
    2,
  )
}

export default function ConfiguracoesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { activeCharacter } = useCharacter()
  const { t } = useI18n()

  const [preferences, setPreferences] = useState(DEFAULT_APP_PREFERENCES)
  const [saveState, setSaveState] = useState("idle")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isPreferencesHydrated, setIsPreferencesHydrated] = useState(false)

  const tabs = useMemo(
    () => [
      { key: "personagens", label: t("settings.tabs.characters") },
      { key: "aparencia", label: t("settings.tabs.appearance") },
      { key: "preferencias", label: t("settings.tabs.preferences") },
    ],
    [t],
  )

  const startupOptions = useMemo(
    () => [
      { value: "/inicio", label: t("settings.startup.home") },
      { value: "/tasks", label: t("settings.startup.tasks") },
      { value: "/quests", label: t("settings.startup.quests") },
      { value: "/configuracoes?aba=personagens", label: t("settings.startup.settings") },
    ],
    [t],
  )

  const saveStateMessage = useMemo(() => {
    if (saveState === "idle") return ""
    return t(`settings.saveState.${saveState}`)
  }, [saveState, t])

  const activeTab = useMemo(() => getActiveTab(location.search), [location.search])
  const selectedAccent = isPreferencesHydrated ? preferences.accent : null

  useLayoutEffect(() => {
    setPreferences(readAppPreferences())
    setIsPreferencesHydrated(true)
  }, [])

  useEffect(() => {
    if (saveState === "idle") return undefined

    const timeoutId = window.setTimeout(() => {
      setSaveState("idle")
    }, 1800)

    return () => window.clearTimeout(timeoutId)
  }, [saveState])

  function handleTabChange(tabKey) {
    navigate(`/configuracoes?aba=${tabKey}`, { replace: true })
  }

  function updatePreference(key, value) {
    const next = saveAppPreferences({
      ...preferences,
      [key]: value,
    })

    setPreferences(next)
    setSaveState("saved")
  }

  function handleResetPreferences() {
    const next = resetAppPreferences()
    setPreferences(next)
    setSaveState("reset")
  }

  function handleExportPreferences() {
    const blob = new Blob([buildExportFile(preferences)], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "pxg-files-preferencias.json"
    anchor.click()
    window.URL.revokeObjectURL(url)
    setSaveState("exported")
  }

  function handleImportPreferences(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"))
        const imported = saveAppPreferences(parsed.preferences || parsed)
        setPreferences(imported)
        setSaveState("imported")
      } catch {
        setSaveState("error")
      } finally {
        event.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await logout()
      navigate("/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <AppShell>
      <Topbar />

      <section className="settings-page">
        <div className="settings-page__header">
          <div className="settings-page__headline">
            <h2 className="settings-page__title">{t("settings.title")}</h2>
            {saveStateMessage ? (
              <span
                className={
                  saveState === "error"
                    ? "settings-page__save-state settings-page__save-state--error"
                    : "settings-page__save-state"
                }
                role="status"
                aria-live="polite"
              >
                {saveStateMessage}
              </span>
            ) : null}
          </div>

          <div
            className="settings-page__header-actions settings-page__tabs"
            role="tablist"
            aria-label={t("settings.title")}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={
                  activeTab === tab.key
                    ? "settings-page__tab settings-page__tab--active"
                    : "settings-page__tab"
                }
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-page__content">
          {activeTab === "personagens" && (
            <div className="settings-pane">
              <AccountCharactersSection />
            </div>
          )}

          {activeTab === "aparencia" && (
            <div className="settings-pane">
              <section className="settings-panel">
                <header className="settings-panel__header">
                  <div>
                    <span className="settings-panel__eyebrow">{t("settings.appearanceEyebrow")}</span>
                    <h2 id="settings-accent-title" className="settings-panel__title">
                      {t("settings.colorPalette")}
                    </h2>
                    <p className="settings-panel__description">
                      {t("settings.colorPaletteDescription")}
                    </p>
                  </div>
                </header>

                <div
                  className="settings-accent-grid"
                  role="radiogroup"
                  aria-labelledby="settings-accent-title"
                  aria-busy={!isPreferencesHydrated}
                >
                  {APP_ACCENT_OPTIONS.map((option) => {
                    const isActive = selectedAccent === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={
                          isActive
                            ? "settings-accent-card settings-accent-card--active"
                            : "settings-accent-card"
                        }
                        style={{
                          "--accent-card-primary": option.primary,
                          "--accent-card-strong": option.strong,
                          "--accent-card-ring": option.ring,
                        }}
                        onClick={() => updatePreference("accent", option.value)}
                      >
                        <span className="settings-accent-card__preview">
                          <span
                            className={`settings-accent-card__swatch settings-accent-card__swatch--${option.value}`}
                          />
                          {isActive ? (
                            <span className="settings-accent-card__selected">
                              {t("common.themeCurrent")}
                            </span>
                          ) : null}
                        </span>
                        <strong>{option.label}</strong>
                        <small>{option.hint}</small>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          )}

          {activeTab === "preferencias" && (
            <div className="settings-pane">
              <section className="settings-panel">
                <header className="settings-panel__header">
                  <div>
                    <span className="settings-panel__eyebrow">{t("settings.accountEyebrow")}</span>
                    <h2 className="settings-panel__title">{t("settings.accountOverview")}</h2>
                    <p className="settings-panel__description">
                      {t("settings.accountOverviewDescription")}
                    </p>
                  </div>
                </header>

                <div className="settings-account-overview">
                  <div className="settings-account-overview__item">
                    <span className="settings-account-overview__label">{t("settings.user")}</span>
                    <strong>{user?.display_name || user?.displayName || "-"}</strong>
                  </div>
                  <div className="settings-account-overview__item">
                    <span className="settings-account-overview__label">{t("settings.email")}</span>
                    <strong>{user?.email || "-"}</strong>
                  </div>
                  <div className="settings-account-overview__item">
                    <span className="settings-account-overview__label">{t("settings.activeCharacter")}</span>
                    <strong>{activeCharacter?.nome || activeCharacter?.name || t("common.none")}</strong>
                  </div>
                </div>
              </section>

              <section className="settings-panel">
                <header className="settings-panel__header">
                  <div>
                    <span className="settings-panel__eyebrow">{t("settings.preferencesEyebrow")}</span>
                    <h2 className="settings-panel__title">{t("settings.appBehavior")}</h2>
                    <p className="settings-panel__description">
                      {t("settings.appBehaviorDescription")}
                    </p>
                  </div>
                </header>

                <div className="settings-field-grid">
                  <label className="settings-field settings-field--full">
                    <span className="settings-field__label">{t("settings.startupPage")}</span>
                    <select
                      className="settings-select"
                      value={preferences.startupPage}
                      onChange={(event) => updatePreference("startupPage", event.target.value)}
                    >
                      {startupOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="settings-toggle-card">
                    <div>
                      <strong>{t("settings.confirmBeforeRemoving")}</strong>
                      <p>{t("settings.confirmBeforeRemovingHint")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.confirmBeforeRemoving}
                      onChange={(event) =>
                        updatePreference("confirmBeforeRemoving", event.target.checked)
                      }
                    />
                  </label>

                  <label className="settings-toggle-card">
                    <div>
                      <strong>{t("settings.highlightCompleted")}</strong>
                      <p>{t("settings.highlightCompletedHint")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.highlightCompleted}
                      onChange={(event) =>
                        updatePreference("highlightCompleted", event.target.checked)
                      }
                    />
                  </label>

                  <label className="settings-toggle-card settings-toggle-card--full">
                    <div>
                      <strong>{t("settings.returnHomeAfterSwitch")}</strong>
                      <p>{t("settings.returnHomeAfterSwitchHint")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.openHomeAfterCharacterSwitch}
                      onChange={(event) =>
                        updatePreference("openHomeAfterCharacterSwitch", event.target.checked)
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="settings-panel">
                <header className="settings-panel__header settings-panel__header--split">
                  <div>
                    <span className="settings-panel__eyebrow">{t("settings.sessionEyebrow")}</span>
                    <h2 className="settings-panel__title">{t("settings.sessionSecurity")}</h2>
                    <p className="settings-panel__description">
                      {t("settings.sessionSecurityDescription")}
                    </p>
                  </div>
                </header>

                <div className="settings-session-grid">
                  <article className="settings-session-card">
                    <span className="settings-session-card__label">{t("settings.activeAccount")}</span>
                    <strong>{user?.email || "-"}</strong>
                    <p>{t("settings.accountHint")}</p>
                  </article>
                  <article className="settings-session-card">
                    <span className="settings-session-card__label">{t("settings.focusedCharacter")}</span>
                    <strong>{activeCharacter?.nome || activeCharacter?.name || t("common.none")}</strong>
                    <p>{t("settings.characterHint")}</p>
                  </article>
                  <article className="settings-session-card">
                    <span className="settings-session-card__label">{t("settings.preferencesStorage")}</span>
                    <strong>{t("settings.localStorage")}</strong>
                    <p>{t("settings.localStorageHint")}</p>
                  </article>
                </div>

                <div className="settings-actions-row">
                  <button
                    type="button"
                    className="settings-action-button"
                    onClick={handleExportPreferences}
                  >
                    {t("settings.exportPreferences")}
                  </button>

                  <label className="settings-action-button settings-action-button--file">
                    {t("settings.importPreferences")}
                    <input
                      type="file"
                      accept="application/json"
                      onChange={handleImportPreferences}
                      hidden
                    />
                  </label>

                  <button
                    type="button"
                    className="settings-action-button"
                    onClick={handleResetPreferences}
                  >
                    {t("settings.resetDefault")}
                  </button>

                  <button
                    type="button"
                    className="settings-action-button settings-action-button--danger"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? t("settings.endingSession") : t("settings.endSession")}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  )
}
