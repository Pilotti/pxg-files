import { useCallback, useEffect, useMemo, useState } from "react"
import useStableScroll from "../hooks/use-stable-scroll.js"
import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import ConfirmActionModal from "../components/confirm-action-modal.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { useI18n } from "../context/i18n-context.jsx"
import { apiRequest } from "../services/api.js"
import { readAppPreferences } from "../services/app-preferences.js"
import "../styles/quests-page.css"

function formatContinent(value, t) {
  return t(`continents.${value || "all"}`) || value
}

function formatCity(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (!raw) return ""

  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function Toast({ feedback, onClose, t }) {
  if (!feedback) return null

  return (
    <div
      className={
        feedback.type === "success"
          ? "quests-toast quests-toast--success"
          : "quests-toast quests-toast--error"
      }
    >
      <div className="quests-toast__content">
        <strong className="quests-toast__title">
          {feedback.type === "success" ? t("common.success") : t("common.error")}
        </strong>
        <span className="quests-toast__message">{feedback.message}</span>
      </div>

      <button
        type="button"
        className="quests-toast__close"
        onClick={onClose}
        aria-label={t("common.close")}
      >
        ✕
      </button>
    </div>
  )
}

function QuestCardSkeleton() {
  return (
    <div className="quests-page__card quests-page__card--skeleton">
      <div className="quests-page__skeleton quests-page__skeleton--title" />
      <div className="quests-page__skeleton quests-page__skeleton--text" />
      <div className="quests-page__skeleton quests-page__skeleton--text-short" />
      <div className="quests-page__skeleton-row">
        <div className="quests-page__skeleton quests-page__skeleton--chip" />
        <div className="quests-page__skeleton quests-page__skeleton--chip" />
      </div>
      <div className="quests-page__skeleton quests-page__skeleton--button" />
      <div className="quests-page__skeleton quests-page__skeleton--button" />
    </div>
  )
}

export default function QuestsPage() {
  const { activeCharacter } = useCharacter()
  const { t, locale } = useI18n()
  const preferences = useMemo(() => readAppPreferences(), [])

  const continents = useMemo(() => ([
    { value: "", label: t("continents.all") },
    { value: "kanto", label: t("continents.kanto") },
    { value: "johto", label: t("continents.johto") },
    { value: "orange_islands", label: t("continents.orange_islands") },
    { value: "outland", label: t("continents.outland") },
    { value: "nightmare_world", label: t("continents.nightmare_world") },
    { value: "orre", label: t("continents.orre") },
  ]), [t])

  const [quests, setQuests] = useState([])
  const [catalog, setCatalog] = useState([])
  const [isLoadingQuests, setIsLoadingQuests] = useState(true)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [processingTemplateId, setProcessingTemplateId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const preserveScroll = useStableScroll()

  const [catalogFilters, setCatalogFilters] = useState({
    search: "",
    continent: "",
    city: "",
    min_level: "",
    max_level: "",
  })

  const [listFilters, setListFilters] = useState({
    search: "",
    status: "",
    continent: "",
    city: "",
  })

  const cityOptions = useMemo(() => {
    const filteredByContinent = listFilters.continent
      ? quests.filter((quest) => quest.continent === listFilters.continent)
      : quests

    const citySet = new Set(
      filteredByContinent
        .map((quest) => String(quest.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, locale))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [quests, listFilters.continent, locale])

  const catalogCityOptions = useMemo(() => {
    const filteredByContinent = catalogFilters.continent
      ? catalog.filter((quest) => quest.continent === catalogFilters.continent)
      : catalog

    const citySet = new Set(
      filteredByContinent
        .map((quest) => String(quest.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, locale))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [catalog, catalogFilters.continent, locale])

  const debouncedCatalogFilters = useDebouncedValue(catalogFilters, 250)
  const debouncedListFilters = useDebouncedValue(listFilters, 150)

  useEffect(() => {
    if (!feedback) return

    const timer = setTimeout(() => {
      setFeedback(null)
    }, 3200)

    return () => clearTimeout(timer)
  }, [feedback])

  const loadQuests = useCallback(async () => {
    if (!activeCharacter?.id) return

    setIsLoadingQuests(true)

    try {
      const data = await apiRequest(`/quests?character_id=${activeCharacter.id}`)
      setQuests(data)
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("quests.loadError"),
      })
    } finally {
      setIsLoadingQuests(false)
    }
  }, [activeCharacter?.id, t])

  const buildCatalogQuery = useCallback((nextFilters) => {
    const params = new URLSearchParams()
    params.append("character_id", String(activeCharacter.id))

    if (nextFilters.continent) params.append("continent", nextFilters.continent)
    if (nextFilters.city) params.append("city", nextFilters.city)
    if (nextFilters.min_level) params.append("min_level", String(nextFilters.min_level))
    if (nextFilters.max_level) params.append("max_level", String(nextFilters.max_level))

    return params.toString()
  }, [activeCharacter?.id])

  const loadCatalog = useCallback(async (nextFilters = debouncedCatalogFilters) => {
    if (!activeCharacter?.id) return

    setIsLoadingCatalog(true)

    try {
      const query = buildCatalogQuery(nextFilters)
      const data = await apiRequest(`/quests/catalog?${query}`)

      const normalizedSearch = nextFilters.search.trim().toLowerCase()

      const filteredData = normalizedSearch
        ? data.filter((item) => item.name.toLowerCase().includes(normalizedSearch))
        : data

      setCatalog(filteredData)
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("quests.catalogLoadError"),
      })
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [activeCharacter?.id, buildCatalogQuery, debouncedCatalogFilters, t])

  useEffect(() => {
    if (!activeCharacter?.id) {
      setQuests([])
      setIsLoadingQuests(false)
      return
    }

    loadQuests()
  }, [activeCharacter?.id, loadQuests])

  useEffect(() => {
    if (!isCatalogOpen || !activeCharacter?.id) return
    loadCatalog(debouncedCatalogFilters)
  }, [isCatalogOpen, debouncedCatalogFilters, activeCharacter?.id, loadCatalog])

  function openCatalog() {
    preserveScroll()
    setIsCatalogOpen(true)
  }

  function closeCatalog() {
    if (processingTemplateId) return
    preserveScroll()
    setIsCatalogOpen(false)
  }

    async function handleUncompleteQuest(templateId) {
      if (!activeCharacter?.id) return

      try {
        setProcessingTemplateId(templateId)

        await apiRequest(`/quests/${templateId}/uncomplete?character_id=${activeCharacter.id}`, {
          method: "PATCH",
        })

        setFeedback({
          type: "success",
          message: t("quests.uncompleteSuccess"),
        })

        await Promise.all([
          loadQuests(),
          isCatalogOpen ? loadCatalog(debouncedCatalogFilters) : Promise.resolve(),
        ])
      } catch (err) {
        setFeedback({
          type: "error",
          message: err.message || t("quests.uncompleteError"),
        })
      } finally {
        setProcessingTemplateId(null)
      }
    }
  async function handleActivateQuest(templateId) {
    if (!activeCharacter?.id) return

    preserveScroll()

    try {
      setProcessingTemplateId(templateId)

      await apiRequest(`/quests/${templateId}/activate?character_id=${activeCharacter.id}`, {
        method: "POST",
      })

      setFeedback({
        type: "success",
        message: t("quests.activateSuccess"),
      })

      await Promise.all([loadQuests(), loadCatalog(debouncedCatalogFilters)])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("quests.activateError"),
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  async function handleCompleteQuest(templateId) {
    if (!activeCharacter?.id) return

    preserveScroll()

    try {
      setProcessingTemplateId(templateId)

      await apiRequest(`/quests/${templateId}/complete?character_id=${activeCharacter.id}`, {
        method: "PATCH",
      })

      setFeedback({
        type: "success",
        message: t("quests.completeSuccess"),
      })

      await Promise.all([
        loadQuests(),
        isCatalogOpen ? loadCatalog(debouncedCatalogFilters) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("quests.completeError"),
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  async function handleRemoveQuest(templateId) {
    if (!activeCharacter?.id) return

    preserveScroll()

    try {
      setProcessingTemplateId(templateId)

      await apiRequest(`/quests/${templateId}?character_id=${activeCharacter.id}`, {
        method: "DELETE",
      })

      setFeedback({
        type: "success",
        message: t("quests.removeSuccess"),
      })
      setRemoveConfirm(null)

      await Promise.all([
        loadQuests(),
        isCatalogOpen ? loadCatalog(debouncedCatalogFilters) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("quests.removeError"),
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  function requestRemoveQuest(quest) {
    if (!quest) return

    preserveScroll()

    if (preferences.confirmBeforeRemoving) {
      setRemoveConfirm({
        templateId: quest.template_id,
        name: quest.name,
      })
      return
    }

    handleRemoveQuest(quest.template_id)
  }

  const sortedQuests = useMemo(() => {
    return [...quests].sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      if (a.min_level !== b.min_level) return a.min_level - b.min_level
      return a.name.localeCompare(b.name, locale)
    })
  }, [quests, locale])

  const filteredQuests = useMemo(() => {
    const search = debouncedListFilters.search.trim().toLowerCase()

    return sortedQuests.filter((quest) => {
      if (search && !quest.name.toLowerCase().includes(search)) return false

      if (debouncedListFilters.status === "pending" && quest.is_completed) return false
      if (debouncedListFilters.status === "completed" && !quest.is_completed) return false

      if (debouncedListFilters.continent && quest.continent !== debouncedListFilters.continent) {
        return false
      }

      if (
        debouncedListFilters.city
        && String(quest.city || "").trim().toLowerCase() !== debouncedListFilters.city
      ) {
        return false
      }

      return true
    })
  }, [sortedQuests, debouncedListFilters])

  const stats = useMemo(() => {
    const total = quests.length
    const completed = quests.filter((quest) => quest.is_completed).length
    const pending = total - completed

    return { total, pending, completed }
  }, [quests])

  const isConfirmingRemove = Boolean(removeConfirm)

  return (
    <AppShell>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} t={t} />

      <ConfirmActionModal
        open={isConfirmingRemove}
        title={t("quests.modal.removeTitle")}
        description={
          removeConfirm
            ? t("quests.modal.removeDescription", { name: removeConfirm.name })
            : ""
        }
        confirmLabel={t("quests.modal.removeConfirm")}
        cancelLabel={t("common.cancel")}
        confirmTone="danger"
        isLoading={processingTemplateId === removeConfirm?.templateId}
        onCancel={() => {
          if (processingTemplateId === removeConfirm?.templateId) return
          setRemoveConfirm(null)
        }}
        onConfirm={() => {
          if (!removeConfirm) return
          handleRemoveQuest(removeConfirm.templateId)
        }}
      />

      <Topbar />

      <section className="quests-page">
        <div className="quests-page__header">
          <div>
            <h2 className="quests-page__title">{t("quests.title")}</h2>
          </div>

          <button
            type="button"
            className="quests-page__primary-button"
            onClick={openCatalog}
            disabled={!activeCharacter}
          >
            {t("quests.newQuest")}
          </button>
        </div>

        <div className="quests-page__stats">
          <div className="quests-page__stat-card">
            <span className="quests-page__stat-label">{t("quests.total")}</span>
            <strong className="quests-page__stat-value">{stats.total}</strong>
          </div>

          <div className="quests-page__stat-card">
            <span className="quests-page__stat-label">{t("quests.pending")}</span>
            <strong className="quests-page__stat-value">{stats.pending}</strong>
          </div>

          <div className="quests-page__stat-card quests-page__stat-card--success">
            <span className="quests-page__stat-label">{t("quests.completed")}</span>
            <strong className="quests-page__stat-value">{stats.completed}</strong>
          </div>
        </div>

        <div className="quests-page__filters-card">
          <div className="quests-page__filters-grid">
            <input
              className="quests-page__input"
              placeholder={t("quests.searchActive")}
              value={listFilters.search}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />

            <select
              className="quests-page__input"
              value={listFilters.status}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              <option value="">{t("quests.allStatus")}</option>
              <option value="pending">{t("quests.pending")}</option>
              <option value="completed">{t("quests.status.completed")}</option>
            </select>

            <select
              className="quests-page__input"
              value={listFilters.continent}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, continent: e.target.value, city: "" }))
              }
            >
              {continents.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="quests-page__input"
              value={listFilters.city}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, city: e.target.value }))
              }
            >
              <option value="">{t("quests.allCities")}</option>
              {cityOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="quests-page__cards-grid">
          {isLoadingQuests ? (
            <>
              <QuestCardSkeleton />
              <QuestCardSkeleton />
              <QuestCardSkeleton />
            </>
          ) : !filteredQuests.length ? (
            <div className="quests-page__empty quests-page__empty--full">
              {t("quests.noneFound")}
            </div>
          ) : (
            filteredQuests.map((quest) => {
              const isProcessing = processingTemplateId === quest.template_id

              return (
                <article
                  key={quest.id}
                  className={
                    quest.is_completed && preferences.highlightCompleted
                      ? "quests-page__card quests-page__card--completed"
                      : "quests-page__card"
                  }
                >
                  <div className="quests-page__card-main">
                    <div className="quests-page__card-top">
                      <strong className="quests-page__card-title">{quest.name}</strong>

                      <span
                        className={
                          quest.is_completed
                            ? "quests-page__status quests-page__status--completed"
                            : "quests-page__status quests-page__status--pending"
                        }
                      >
                        {quest.is_completed ? t("quests.status.completedShort") : t("quests.status.pendingShort")}
                      </span>
                    </div>

                    <p className="quests-page__card-description">
                      {quest.description || t("quests.descriptionFallback")}
                    </p>

                    <div className="quests-page__meta">
                      <span>{t("quests.continent")}: {formatContinent(quest.continent, t)}</span>
                      <span>{t("quests.city")}: {formatCity(quest.city) || t("quests.cityFallback")}</span>
                      <span>{t("quests.minLevel")}: {quest.min_level}</span>
                      {quest.continent === "nightmare_world" && quest.nw_level !== null && quest.nw_level !== undefined ? <span>{t("quests.nightmareLevel")}: {quest.nw_level}</span> : null}
                    </div>

                    <div className="quests-page__reward">
                      {t("quests.reward")}: {quest.reward_text || t("quests.rewardFallback")}
                    </div>
                  </div>

                  <div className="quests-page__card-actions">
                    {!quest.is_completed ? (
                      <>
                        <button
                          type="button"
                          className="quests-page__ghost-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleCompleteQuest(quest.template_id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? t("tasks.saving") : t("quests.complete")}
                        </button>

                        <button
                          type="button"
                          className="quests-page__danger-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => requestRemoveQuest(quest)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? t("tasks.saving") : t("quests.removeQuest")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="quests-page__ghost-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleUncompleteQuest(quest.template_id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? t("tasks.saving") : t("quests.uncomplete")}
                        </button>

                        <div className="quests-page__completed-note">
                        {t("quests.completedNote")}
                        </div>
                      </>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      {isCatalogOpen && (
        <div className="quests-catalog-modal__backdrop">
          <div className="quests-catalog-modal">
            <div className="quests-catalog-modal__header">
              <div>
                <h2 className="quests-catalog-modal__title">{t("quests.catalog.title")}</h2>
                <p className="quests-catalog-modal__subtitle">
                  {t("quests.catalog.subtitle")}
                </p>
              </div>

              <button
                type="button"
                className="quests-catalog-modal__close"
                onClick={closeCatalog}
                disabled={Boolean(processingTemplateId)}
              >
                ✕
              </button>
            </div>

            <div className="quests-catalog-modal__filters">
              <input
                className="quests-page__input"
                placeholder={t("quests.catalog.searchByName")}
                value={catalogFilters.search}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, search: e.target.value }))
                }
              />

              <select
                className="quests-page__input"
                value={catalogFilters.continent}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, continent: e.target.value, city: "" }))
                }
              >
                {continents.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                className="quests-page__input"
                value={catalogFilters.city}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, city: e.target.value }))
                }
              >
                <option value="">{t("quests.allCities")}</option>
                {catalogCityOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <input
                className="quests-page__input"
                type="number"
                placeholder={t("quests.catalog.minLevel")}
                value={catalogFilters.min_level}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, min_level: e.target.value }))
                }
              />

              <input
                className="quests-page__input"
                type="number"
                placeholder={t("quests.catalog.maxLevel")}
                value={catalogFilters.max_level}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, max_level: e.target.value }))
                }
              />
            </div>

            <div className="quests-catalog-modal__content">
              <div className="quests-page__cards-grid">
                {isLoadingCatalog ? (
                  <>
                    <QuestCardSkeleton />
                    <QuestCardSkeleton />
                    <QuestCardSkeleton />
                  </>
                ) : !catalog.length ? (
                  <div className="quests-page__empty quests-page__empty--full">
                    {t("quests.noneFound")}
                  </div>
                ) : (
                  catalog.map((quest) => {
                    const isProcessing = processingTemplateId === quest.id

                    return (
                      <article
                        key={quest.id}
                        className={
                          quest.status === "completed"
                            ? "quests-page__card quests-page__card--completed"
                            : "quests-page__card"
                        }
                      >
                        <div className="quests-page__card-main">
                          <div className="quests-page__card-top">
                            <strong className="quests-page__card-title">
                              {quest.name}
                            </strong>

                            <span
                              className={
                                quest.status === "completed"
                                  ? "quests-page__status quests-page__status--completed"
                                  : quest.status === "active"
                                    ? "quests-page__status quests-page__status--active"
                                    : "quests-page__status quests-page__status--available"
                              }
                            >
                              {quest.status === "completed"
                                ? t("quests.status.completedShort")
                                : quest.status === "active"
                                  ? t("quests.status.activeShort")
                                  : t("quests.status.availableShort")}
                            </span>
                          </div>

                          <p className="quests-page__card-description">
                            {quest.description || t("quests.descriptionFallback")}
                          </p>

                          <div className="quests-page__meta">
                            <span>{t("quests.continent")}: {formatContinent(quest.continent, t)}</span>
                            <span>{t("quests.city")}: {formatCity(quest.city) || t("quests.cityFallback")}</span>
                            <span>{t("quests.minLevel")}: {quest.min_level}</span>
                            {quest.continent === "nightmare_world" && quest.nw_level !== null && quest.nw_level !== undefined ? <span>{t("quests.nightmareLevel")}: {quest.nw_level}</span> : null}
                          </div>

                          <div className="quests-page__reward">
                            {t("quests.reward")}: {quest.reward_text || t("quests.rewardFallback")}
                          </div>
                        </div>

                        <div className="quests-page__card-actions">
                          {quest.status === "available" ? (
                            <button
                              type="button"
                              className="quests-page__primary-button quests-page__primary-button--full"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleActivateQuest(quest.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? t("quests.catalog.activating") : t("quests.catalog.activate")}
                            </button>
                          ) : quest.status === "active" ? (
                            <div className="quests-page__active-note">
                              {t("quests.catalog.alreadyActive")}
                            </div>
                          ) : (
                            <div className="quests-page__completed-note">
                              {t("quests.catalog.alreadyCompleted")}
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
