import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "@/lib/react-router-compat"
import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import AccountCharactersSection from "../components/account-characters-section.jsx"
import { useAuth } from "../context/auth-context.jsx"
import { useCharacter } from "../context/character-context.jsx"
import {
  DEFAULT_APP_PREFERENCES,
  readAppPreferences,
  resetAppPreferences,
  saveAppPreferences,
} from "../services/app-preferences.js"
import "../styles/configuracoes-page.css"

const tabs = [
  { key: "personagens", label: "Personagens" },
  { key: "aparencia", label: "Aparência" },
  { key: "preferencias", label: "Preferências" },
]

const accentOptions = [
  { value: "volcanic", label: "Volcanic", hint: "Vermelho", primary: "#ef4444", strong: "#b91c1c", ring: "rgba(239, 68, 68, 0.3)" },
  { value: "raibolt", label: "Raibolt", hint: "Amarelo", primary: "#d4a411", strong: "#976b00", ring: "rgba(212, 164, 17, 0.28)" },
  { value: "orebound", label: "Orebound", hint: "Preto", primary: "#111827", strong: "#030712", ring: "rgba(148, 163, 184, 0.26)" },
  { value: "naturia", label: "Naturia", hint: "Verde", primary: "#22c55e", strong: "#15803d", ring: "rgba(34, 197, 94, 0.28)" },
  { value: "gardestrike", label: "Gardestrike", hint: "Marrom", primary: "#92400e", strong: "#78350f", ring: "rgba(180, 83, 9, 0.28)" },
  { value: "ironhard", label: "Ironhard", hint: "Cinza", primary: "#6b7280", strong: "#4b5563", ring: "rgba(107, 114, 128, 0.28)" },
  { value: "wingeon", label: "Wingeon", hint: "Branco", primary: "#b8c2d1", strong: "#8290a7", ring: "rgba(184, 194, 209, 0.28)" },
  { value: "psycraft", label: "Psycraft", hint: "Rosa", primary: "#ec4899", strong: "#be185d", ring: "rgba(236, 72, 153, 0.28)" },
  { value: "seavell", label: "Seavell", hint: "Azul", primary: "#3b82f6", strong: "#1d4ed8", ring: "rgba(59, 130, 246, 0.28)" },
  { value: "malefic", label: "Malefic", hint: "Roxo", primary: "#8b5cf6", strong: "#6d28d9", ring: "rgba(139, 92, 246, 0.3)" },
]

const startupOptions = [
  { value: "/inicio", label: "Início" },
  { value: "/tasks", label: "Tasks" },
  { value: "/quests", label: "Quests" },
  { value: "/configuracoes?aba=personagens", label: "Configurações" },
]

const saveStateLabels = {
  saved: "Tema salvo",
  reset: "Preferências restauradas",
  imported: "Preferências importadas",
  exported: "Backup exportado",
  error: "Falha ao importar arquivo",
}

function getActiveTab(search) {
  const params = new URLSearchParams(search)
  const rawTab = params.get("aba")
  const legacyMap = {
    conta: "personagens",
    sessao: "preferencias",
  }
  const aba = legacyMap[rawTab] || rawTab
  return tabs.some((tab) => tab.key === aba) ? aba : "personagens"
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

function getSaveStateMessage(saveState) {
  return saveStateLabels[saveState] || ""
}

export default function ConfiguracoesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { activeCharacter } = useCharacter()

  const [preferences, setPreferences] = useState(DEFAULT_APP_PREFERENCES)
  const [saveState, setSaveState] = useState("idle")
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const activeTab = useMemo(() => getActiveTab(location.search), [location.search])
  const activeAccent = useMemo(
    () => accentOptions.find((option) => option.value === preferences.accent) || accentOptions[accentOptions.length - 1],
    [preferences.accent],
  )
  const saveStateMessage = useMemo(() => getSaveStateMessage(saveState), [saveState])

  useLayoutEffect(() => {
    setPreferences(readAppPreferences())
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
            <h2 className="settings-page__title">Configurações</h2>
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
            aria-label="Abas das configurações"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? "settings-page__tab settings-page__tab--active" : "settings-page__tab"}
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
                    <span className="settings-panel__eyebrow">Aparência</span>
                    <h2 id="settings-accent-title" className="settings-panel__title">Paleta de cores</h2>
                    <p className="settings-panel__description">
                      Escolha o tom principal da interface.
                    </p>
                  </div>

                  <div
                    className="settings-accent-summary"
                    style={{
                      "--accent-summary-primary": activeAccent.primary,
                      "--accent-summary-strong": activeAccent.strong,
                      "--accent-summary-ring": activeAccent.ring,
                    }}
                  >
                    <span className="settings-accent-summary__label">Tema atual</span>
                    <strong className="settings-accent-summary__value">{activeAccent.label}</strong>
                    <small className="settings-accent-summary__hint">{activeAccent.hint}</small>
                  </div>
                </header>

                <div className="settings-accent-grid" role="radiogroup" aria-labelledby="settings-accent-title">
                  {accentOptions.map((option) => {
                    const isActive = preferences.accent === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={isActive ? "settings-accent-card settings-accent-card--active" : "settings-accent-card"}
                        style={{
                          "--accent-card-primary": option.primary,
                          "--accent-card-strong": option.strong,
                          "--accent-card-ring": option.ring,
                        }}
                        onClick={() => updatePreference("accent", option.value)}
                      >
                        <span className="settings-accent-card__preview">
                          <span className={`settings-accent-card__swatch settings-accent-card__swatch--${option.value}`} />
                          {isActive ? <span className="settings-accent-card__selected">Tema atual</span> : null}
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
                    <span className="settings-panel__eyebrow">Conta</span>
                    <h2 className="settings-panel__title">Visão geral da sua conta</h2>
                    <p className="settings-panel__description">
                      Informações rápidas da sessão atual e gerenciamento dos seus personagens vinculados.
                    </p>
                  </div>
                </header>

                <div className="settings-account-overview">
                  <div className="settings-account-overview__item">
                    <span className="settings-account-overview__label">Usuário</span>
                    <strong>{user?.display_name || user?.displayName || "-"}</strong>
                  </div>
                  <div className="settings-account-overview__item">
                    <span className="settings-account-overview__label">E-mail</span>
                    <strong>{user?.email || "-"}</strong>
                  </div>
                  <div className="settings-account-overview__item">
                    <span className="settings-account-overview__label">Personagem ativo</span>
                    <strong>{activeCharacter?.nome || activeCharacter?.name || "Nenhum"}</strong>
                  </div>
                </div>
              </section>

              <section className="settings-panel">
                <header className="settings-panel__header">
                  <div>
                    <span className="settings-panel__eyebrow">Preferências</span>
                    <h2 className="settings-panel__title">Comportamento do app</h2>
                    <p className="settings-panel__description">
                      Ajuste o que acontece ao entrar na conta, trocar personagem e executar ações sensíveis.
                    </p>
                  </div>
                </header>

                <div className="settings-field-grid">
                  <label className="settings-field settings-field--full">
                    <span className="settings-field__label">Página inicial após login</span>
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
                      <strong>Confirmar antes de remover</strong>
                      <p>Mantém confirmações extras em exclusões e remoções importantes.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.confirmBeforeRemoving}
                      onChange={(event) => updatePreference("confirmBeforeRemoving", event.target.checked)}
                    />
                  </label>

                  <label className="settings-toggle-card">
                    <div>
                      <strong>Destacar concluídas</strong>
                      <p>Preserva maior contraste visual para tasks e quests finalizadas.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.highlightCompleted}
                      onChange={(event) => updatePreference("highlightCompleted", event.target.checked)}
                    />
                  </label>

                  <label className="settings-toggle-card settings-toggle-card--full">
                    <div>
                      <strong>Voltar ao início após trocar personagem</strong>
                      <p>Quando desativado, a troca mantém a página atual, sem forçar retorno ao dashboard.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.openHomeAfterCharacterSwitch}
                      onChange={(event) => updatePreference("openHomeAfterCharacterSwitch", event.target.checked)}
                    />
                  </label>
                </div>
              </section>

              <section className="settings-panel">
                <header className="settings-panel__header settings-panel__header--split">
                  <div>
                    <span className="settings-panel__eyebrow">Sessão</span>
                    <h2 className="settings-panel__title">Persistência e segurança</h2>
                    <p className="settings-panel__description">
                      Faça backup das preferências locais, restaure o padrão e encerre a sessão atual.
                    </p>
                  </div>
                </header>

                <div className="settings-session-grid">
                  <article className="settings-session-card">
                    <span className="settings-session-card__label">Conta ativa</span>
                    <strong>{user?.email || "-"}</strong>
                    <p>Seus tokens e preferências locais ficam vinculados a este navegador.</p>
                  </article>
                  <article className="settings-session-card">
                    <span className="settings-session-card__label">Personagem em foco</span>
                    <strong>{activeCharacter?.nome || activeCharacter?.name || "Nenhum"}</strong>
                    <p>O último personagem escolhido fica salvo localmente para restauração automática.</p>
                  </article>
                  <article className="settings-session-card">
                    <span className="settings-session-card__label">Preferências</span>
                    <strong>Locais</strong>
                    <p>As preferências desta página ficam salvas neste dispositivo.</p>
                  </article>
                </div>

                <div className="settings-actions-row">
                  <button type="button" className="settings-action-button" onClick={handleExportPreferences}>
                    Exportar preferências
                  </button>

                  <label className="settings-action-button settings-action-button--file">
                    Importar preferências
                    <input type="file" accept="application/json" onChange={handleImportPreferences} hidden />
                  </label>

                  <button type="button" className="settings-action-button" onClick={handleResetPreferences}>
                    Restaurar padrão
                  </button>

                  <button
                    type="button"
                    className="settings-action-button settings-action-button--danger"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? "Encerrando..." : "Encerrar sessão"}
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
