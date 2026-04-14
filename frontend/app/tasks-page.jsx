import { useCallback, useEffect, useMemo, useState } from "react"
import useStableScroll from "../hooks/use-stable-scroll.js"
import AppShell from "../components/app-shell.jsx"
import AppSelect from "../components/app-select.jsx"
import Topbar from "../components/topbar.jsx"
import ConfirmActionModal from "../components/confirm-action-modal.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { useI18n } from "../context/i18n-context.jsx"
import { apiRequest } from "../services/api.js"
import { readAppPreferences } from "../services/app-preferences.js"
import "../styles/tasks-page.css"

function formatTaskType(value, t) {
  const map = {
    item_delivery: t("tasks.type.itemDelivery"),
    defeat: t("tasks.type.defeat"),
    capture: t("tasks.type.capture"),
    outro: t("tasks.type.other"),
  }

  if (Array.isArray(value)) {
    return value.map((v) => map[v] || v).join(", ")
  }

  return map[value] || value
}

function getTaskTypeMeta(value, t) {
  if (value === "defeat") {
    return {
      label: t("tasks.type.defeat"),
      icon: "☠",
      className: "tasks-page__type-chip tasks-page__type-chip--defeat",
    }
  }

  if (value === "item_delivery") {
    return {
      label: t("tasks.type.deliveryShort"),
      icon: "✦",
      className: "tasks-page__type-chip tasks-page__type-chip--delivery",
    }
  }

  if (value === "capture") {
    return {
      label: t("tasks.type.captureShort"),
      icon: "◓",
      className: "tasks-page__type-chip tasks-page__type-chip--capture",
    }
  }

  if (value === "outro") {
    return {
      label: t("tasks.type.otherShort"),
      icon: "▪",
      className: "tasks-page__type-chip tasks-page__type-chip--outro",
    }
  }

  return {
    label: formatTaskType(value, t),
    icon: "•",
    className: "tasks-page__type-chip",
  }
}

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

function safeText(value, fallback = "") {
  const content = String(value || "").trim()
  return content || fallback
}

function getTaskCardName(task, fallback) {
  return safeText(task?.npc_name || task?.name, fallback)
}

function parseRewardText(rewardText) {
  if (!rewardText) return null

  const text = String(rewardText).trim()
  if (!text) return null

  const result = { exp: null, gold: null, rawText: text }

  const expMatch = text.match(/(\d+)\s*(?:EXP|exp|Exp)/i)
  if (expMatch) {
    result.exp = parseInt(expMatch[1])
  }

  const goldMatch = text.match(/(\d+)\s*(?:\$|dl|DL|Dl)/i)
  if (goldMatch) {
    result.gold = parseInt(goldMatch[1])
  }

  if (!result.exp && !result.gold) {
    return null
  }

  return result
}

function RewardDisplay({ rewardText, t }) {
  const reward = parseRewardText(rewardText)
  if (!reward) {
    return <strong>{safeText(rewardText, t("common.notProvided"))}</strong>
  }

  return (
    <span className="tasks-page__reward-group">
      {reward.exp !== null && (
        <span className="tasks-page__reward-item tasks-page__reward-item--exp">
          <strong>{reward.exp}</strong>
          <span>EXP</span>
        </span>
      )}
      {reward.gold !== null && (
        <span className="tasks-page__reward-item tasks-page__reward-item--gold">
          <strong>{reward.gold}</strong>
          <span>dl</span>
        </span>
      )}
    </span>
  )
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
          ? "tasks-toast tasks-toast--success"
          : "tasks-toast tasks-toast--error"
      }
    >
      <div className="tasks-toast__content">
        <strong className="tasks-toast__title">
          {feedback.type === "success" ? t("common.success") : t("common.error")}
        </strong>
        <span className="tasks-toast__message">{feedback.message}</span>
      </div>

      <button
        type="button"
        className="tasks-toast__close"
        onClick={onClose}
        aria-label={t("common.close")}
      >
        ✕
      </button>
    </div>
  )
}

function TaskCardSkeleton() {
  return (
    <div className="tasks-page__card tasks-page__card--skeleton">
      <div className="tasks-page__skeleton tasks-page__skeleton--title" />
      <div className="tasks-page__skeleton tasks-page__skeleton--text" />
      <div className="tasks-page__skeleton tasks-page__skeleton--text-short" />
      <div className="tasks-page__skeleton-row">
        <div className="tasks-page__skeleton tasks-page__skeleton--chip" />
        <div className="tasks-page__skeleton tasks-page__skeleton--chip" />
      </div>
      <div className="tasks-page__skeleton tasks-page__skeleton--button" />
      <div className="tasks-page__skeleton tasks-page__skeleton--button" />
    </div>
  )
}

export default function TasksPage() {
  const CATALOG_PAGE_SIZE = 24
  const { activeCharacter } = useCharacter()
  const { t, locale } = useI18n()
  const preferences = useMemo(() => readAppPreferences(), [])

  const taskTypes = useMemo(() => ([
    { value: "", label: t("tasks.type.all") },
    { value: "item_delivery", label: t("tasks.type.itemDelivery") },
    { value: "defeat", label: t("tasks.type.defeat") },
    { value: "capture", label: t("tasks.type.capture") },
    { value: "outro", label: t("tasks.type.other") },
  ]), [t])

  const continents = useMemo(() => ([
    { value: "", label: t("continents.all") },
    { value: "kanto", label: t("continents.kanto") },
    { value: "johto", label: t("continents.johto") },
    { value: "orange_islands", label: t("continents.orange_islands") },
    { value: "outland", label: t("continents.outland") },
    { value: "nightmare_world", label: t("continents.nightmare_world") },
    { value: "orre", label: t("continents.orre") },
  ]), [t])

  const [tasks, setTasks] = useState([])
  const [catalog, setCatalog] = useState([])
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogTotalPages, setCatalogTotalPages] = useState(1)
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [showUnavailableCatalogTasks, setShowUnavailableCatalogTasks] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [processingTemplateId, setProcessingTemplateId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const preserveScroll = useStableScroll()

  const [catalogFilters, setCatalogFilters] = useState({
    search: "",
    task_type: "",
    continent: "",
    city: "",
    min_level: "",
    nw_level: "",
  })

  const [listFilters, setListFilters] = useState({
    search: "",
    status: "",
    task_type: "",
    continent: "",
    city: "",
  })

  const debouncedCatalogFilters = useDebouncedValue(catalogFilters, 250)
  const debouncedListFilters = useDebouncedValue(listFilters, 150)

  const catalogFiltersForLoading = useMemo(() => ({
    ...debouncedCatalogFilters,
    city: catalogFilters.city,
  }), [debouncedCatalogFilters, catalogFilters.city])

  const handleCopyCoordinate = useCallback(async (rawCoordinate) => {
    const coordinate = String(rawCoordinate || "").trim()
    if (!coordinate) return
    try {
      await navigator.clipboard.writeText(coordinate)
      setFeedback({ type: "success", message: t("tasks.coordCopied", { coordinate }) })
    } catch {
      setFeedback({ type: "error", message: t("tasks.coordCopyError") })
    }
  }, [t])

  useEffect(() => {
    if (!feedback) return

    const timer = setTimeout(() => {
      setFeedback(null)
    }, 3200)

    return () => clearTimeout(timer)
  }, [feedback])

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      if (a.min_level !== b.min_level) return a.min_level - b.min_level
      return a.name.localeCompare(b.name, locale)
    })
  }, [tasks, locale])

  const activeCitiesOptions = useMemo(() => {
    const pendingTasks = sortedTasks.filter((task) => !task.is_completed)
    const citySet = new Set(
      pendingTasks
        .map((task) => String(task.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, locale))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [sortedTasks, locale])

  useEffect(() => {
    setListFilters((prev) => {
      if (!prev.city) return prev

      const hasSelectedCity = activeCitiesOptions.some((city) => city.value === prev.city)
      if (hasSelectedCity) return prev

      return { ...prev, city: "" }
    })
  }, [activeCitiesOptions])

  const catalogCityOptions = useMemo(() => {
    const citySet = new Set(
      catalog
        .map((task) => String(task.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, locale))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [catalog, locale])

  useEffect(() => {
    if (!isCatalogOpen) {
      setCatalogPage(1)
      setCatalogTotal(0)
      setCatalogTotalPages(1)
    }
  }, [isCatalogOpen])

  const displayedCatalog = useMemo(() => {
    if (!showUnavailableCatalogTasks) {
      return catalog
    }

    const rank = { available: 0, active: 1, completed: 2 }
    return [...catalog].sort((a, b) => {
      const statusDiff = (rank[a.status] ?? 99) - (rank[b.status] ?? 99)
      if (statusDiff !== 0) return statusDiff

      const levelDiff = (a.min_level || 0) - (b.min_level || 0)
      if (levelDiff !== 0) return levelDiff

      return String(a.name || "").localeCompare(String(b.name || ""), locale)
    })
  }, [catalog, showUnavailableCatalogTasks, locale])

  const loadTasks = useCallback(async () => {
    if (!activeCharacter?.id) return

    setIsLoadingTasks(true)

    try {
      const data = await apiRequest(`/tasks?character_id=${activeCharacter.id}`)
      setTasks(data)
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("tasks.loadError"),
      })
    } finally {
      setIsLoadingTasks(false)
    }
  }, [activeCharacter?.id, t])

  const buildCatalogQuery = useCallback((nextFilters, nextPage = catalogPage) => {
    const params = new URLSearchParams()
    params.append("character_id", String(activeCharacter.id))

    if (nextFilters.search) params.append("search", nextFilters.search)
    if (nextFilters.task_type) params.append("task_type", nextFilters.task_type)
    if (nextFilters.continent) params.append("continent", nextFilters.continent)
    if (nextFilters.city) params.append("city", nextFilters.city)
    if (nextFilters.min_level) params.append("min_level", String(nextFilters.min_level))
    if (nextFilters.nw_level) params.append("nw_level", String(nextFilters.nw_level))
    params.append("include_unavailable", String(showUnavailableCatalogTasks))
    params.append("page", String(nextPage))
    params.append("page_size", String(CATALOG_PAGE_SIZE))

    return params.toString()
  }, [activeCharacter?.id, catalogPage, showUnavailableCatalogTasks])

  function updateCatalogFilters(updater) {
    setCatalogPage(1)
    setCatalogFilters((prev) => {
      if (typeof updater === "function") {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
  }

  async function handleUncompleteTask(templateId) {
    if (!activeCharacter?.id) return

    preserveScroll()

    try {
      setProcessingTemplateId(templateId)

      await apiRequest(`/tasks/${templateId}/uncomplete?character_id=${activeCharacter.id}`, {
        method: "PATCH",
      })

      setFeedback({
        type: "success",
        message: t("tasks.uncompleteSuccess"),
      })

      await Promise.all([
        loadTasks(),
        isCatalogOpen ? loadCatalog(catalogFiltersForLoading) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("tasks.uncompleteError"),
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  const loadCatalog = useCallback(async (nextFilters = catalogFiltersForLoading, nextPage = catalogPage) => {
    if (!activeCharacter?.id) return

    setIsLoadingCatalog(true)

    try {
      const query = buildCatalogQuery({ ...nextFilters }, nextPage)
      const data = await apiRequest(`/tasks/catalog?${query}`)
      const items = Array.isArray(data?.items) ? data.items : []
      const total = Number(data?.total ?? items.length)
      const totalPages = Math.max(1, Number(data?.total_pages ?? 1))

      setCatalog(items)
      setCatalogTotal(total)
      setCatalogTotalPages(totalPages)

      if (nextPage > totalPages) {
        setCatalogPage(totalPages)
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("tasks.catalogLoadError"),
      })
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [activeCharacter?.id, buildCatalogQuery, catalogFiltersForLoading, catalogPage, t])

  useEffect(() => {
    if (!activeCharacter?.id) {
      setTasks([])
      setIsLoadingTasks(false)
      return
    }

    loadTasks()
  }, [activeCharacter?.id, loadTasks])

  useEffect(() => {
    if (!isCatalogOpen || !activeCharacter?.id) return
    loadCatalog(catalogFiltersForLoading, catalogPage)
  }, [isCatalogOpen, activeCharacter?.id, catalogFiltersForLoading, catalogPage, loadCatalog])

  function openCatalog() {
    preserveScroll()
    setShowUnavailableCatalogTasks(false)
    setCatalogPage(1)
    setIsCatalogOpen(true)
  }

  function closeCatalog() {
    if (processingTemplateId) return
    preserveScroll()
    setIsCatalogOpen(false)
  }

  async function handleActivateTask(templateId) {
    if (!activeCharacter?.id) return

    preserveScroll()

    try {
      setProcessingTemplateId(templateId)

      await apiRequest(`/tasks/${templateId}/activate?character_id=${activeCharacter.id}`, {
        method: "POST",
      })

      setFeedback({
        type: "success",
        message: t("tasks.activateSuccess"),
      })

      await Promise.all([loadTasks(), loadCatalog(catalogFiltersForLoading)])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("tasks.activateError"),
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  async function handleCompleteTask(templateId) {
    if (!activeCharacter?.id) return

    preserveScroll()

    try {
      setProcessingTemplateId(templateId)

      await apiRequest(`/tasks/${templateId}/complete?character_id=${activeCharacter.id}`, {
        method: "PATCH",
      })

      setFeedback({
        type: "success",
        message: t("tasks.completeSuccess"),
      })

      await Promise.all([
        loadTasks(),
        isCatalogOpen ? loadCatalog(catalogFiltersForLoading) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("tasks.completeError"),
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  async function handleRemoveTask(templateId) {
    if (!activeCharacter?.id) return

    preserveScroll()

    try {
      setProcessingTemplateId(templateId)

      await apiRequest(`/tasks/${templateId}?character_id=${activeCharacter.id}`, {
        method: "DELETE",
      })

      setFeedback({
        type: "success",
        message: t("tasks.removeSuccess"),
      })
      setRemoveConfirm(null)

      await Promise.all([
        loadTasks(),
        isCatalogOpen ? loadCatalog(catalogFiltersForLoading) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || t("tasks.removeError"),
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  function requestRemoveTask(task) {
    if (!task) return

    preserveScroll()

    if (preferences.confirmBeforeRemoving) {
      setRemoveConfirm({
        templateId: task.template_id,
        name: task.name,
      })
      return
    }

    handleRemoveTask(task.template_id)
  }

  const hiddenCompletedCount = useMemo(() => {
    if (debouncedListFilters.status) return 0
    return sortedTasks.filter((task) => task.is_completed).length
  }, [sortedTasks, debouncedListFilters.status])

  const filteredTasks = useMemo(() => {
    const search = debouncedListFilters.search.trim().toLowerCase()

    const scoped = sortedTasks.filter((task) => {
      const searchableName = String(task.npc_name || task.name || "").toLowerCase()
      if (search && !searchableName.includes(search)) return false

      if (debouncedListFilters.status === "pending" && task.is_completed) return false
      if (debouncedListFilters.status === "completed" && !task.is_completed) return false

      if (debouncedListFilters.task_type) {
        const typeArray = Array.isArray(task.task_type) ? task.task_type : [task.task_type]
        if (!typeArray.includes(debouncedListFilters.task_type)) {
          return false
        }
      }

      if (debouncedListFilters.continent && task.continent !== debouncedListFilters.continent) {
        return false
      }

      if (debouncedListFilters.city) {
        const taskCity = String(task.city || "").trim().toLowerCase()
        if (taskCity !== debouncedListFilters.city) {
          return false
        }
      }

      return true
    })

    if (debouncedListFilters.status || showCompletedTasks) {
      return scoped
    }

    return scoped.filter((task) => !task.is_completed)
  }, [sortedTasks, debouncedListFilters, showCompletedTasks])

  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((task) => task.is_completed).length
    const pending = total - completed

    return { total, pending, completed }
  }, [tasks])

  const isConfirmingRemove = Boolean(removeConfirm)

  return (
    <AppShell>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} t={t} />

      <ConfirmActionModal
        open={isConfirmingRemove}
        title={t("tasks.modal.removeTitle")}
        description={
          removeConfirm
            ? t("tasks.modal.removeDescription", { name: removeConfirm.name })
            : ""
        }
        confirmLabel={t("tasks.modal.removeConfirm")}
        cancelLabel={t("common.cancel")}
        confirmTone="danger"
        isLoading={processingTemplateId === removeConfirm?.templateId}
        onCancel={() => {
          if (processingTemplateId === removeConfirm?.templateId) return
          setRemoveConfirm(null)
        }}
        onConfirm={() => {
          if (!removeConfirm) return
          handleRemoveTask(removeConfirm.templateId)
        }}
      />

      <Topbar />

      <section className="tasks-page">
        <div className="tasks-page__header">
          <div>
            <h2 className="tasks-page__title">{t("tasks.title")}</h2>
          </div>

          <button
            type="button"
            className="tasks-page__primary-button"
            onClick={openCatalog}
            disabled={!activeCharacter}
          >
            {t("tasks.newTask")}
          </button>
        </div>

        <div className="tasks-page__stats">
          <div className="tasks-page__stat-card">
            <span className="tasks-page__stat-label">{t("tasks.total")}</span>
            <strong className="tasks-page__stat-value">{stats.total}</strong>
          </div>

          <div className="tasks-page__stat-card">
            <span className="tasks-page__stat-label">{t("tasks.pending")}</span>
            <strong className="tasks-page__stat-value">{stats.pending}</strong>
          </div>

          <div className="tasks-page__stat-card tasks-page__stat-card--success">
            <span className="tasks-page__stat-label">{t("tasks.completed")}</span>
            <strong className="tasks-page__stat-value">{stats.completed}</strong>
          </div>
        </div>

        <div className="tasks-page__filters-card">
          <div className="tasks-page__filters-grid">
            <input
              className="tasks-page__input"
              placeholder={t("tasks.searchActive")}
              value={listFilters.search}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />

            <AppSelect
              className="tasks-page__select"
              value={listFilters.status}
              options={[
                { value: "", label: t("tasks.allStatus") },
                { value: "pending", label: t("tasks.status.pending") },
                { value: "completed", label: t("tasks.status.completed") },
              ]}
              onChange={(value) =>
                setListFilters((prev) => ({ ...prev, status: value }))
              }
            />

            <AppSelect
              className="tasks-page__select"
              value={listFilters.task_type}
              options={taskTypes}
              onChange={(value) =>
                setListFilters((prev) => ({ ...prev, task_type: value }))
              }
            />

            <AppSelect
              className="tasks-page__select"
              value={listFilters.continent}
              options={continents}
              onChange={(value) =>
                setListFilters((prev) => ({ ...prev, continent: value }))
              }
            />

            <AppSelect
              className="tasks-page__select"
              value={listFilters.city}
              options={[
                { value: "", label: t("tasks.allCities") },
                ...activeCitiesOptions,
              ]}
              onChange={(value) =>
                setListFilters((prev) => ({ ...prev, city: value }))
              }
            />
          </div>
        </div>

        {!listFilters.status && hiddenCompletedCount > 0 && (
          <div className="tasks-page__filters-summary">
            <span className="tasks-page__filters-result">
              {showCompletedTasks
                ? t("tasks.visibleCompleted", { count: hiddenCompletedCount })
                : t("tasks.hiddenCompleted", { count: hiddenCompletedCount })}
            </span>
            <button
              type="button"
              className="tasks-page__ghost-button"
              onClick={() => setShowCompletedTasks((prev) => !prev)}
            >
              {showCompletedTasks ? t("tasks.hideCompleted") : t("tasks.showCompleted")}
            </button>
          </div>
        )}

        <div className="tasks-page__cards-grid">
          {isLoadingTasks ? (
            <>
              <TaskCardSkeleton />
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </>
          ) : !filteredTasks.length ? (
            <div className="tasks-page__empty tasks-page__empty--full">
              {t("tasks.noneFound")}
            </div>
          ) : (
            filteredTasks.map((task, index) => {
              const isProcessing = processingTemplateId === task.template_id
              const typeArray = Array.isArray(task.task_type) ? task.task_type : [task.task_type]

              return (
                <article
                  key={task.id}
                  className={
                    task.is_completed && preferences.highlightCompleted
                      ? "tasks-page__card tasks-page__card--completed"
                      : "tasks-page__card"
                  }
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <div className="tasks-page__card-main">
                    <div className="tasks-page__card-top">
                      <strong className="tasks-page__card-title">{getTaskCardName(task, t("common.notProvided"))}</strong>

                      <span
                        className={
                          task.is_completed
                            ? "tasks-page__status tasks-page__status--completed"
                            : "tasks-page__status tasks-page__status--pending"
                        }
                      >
                        {task.is_completed ? t("tasks.status.completedShort") : t("tasks.status.pendingShort")}
                      </span>
                    </div>

                    <div className="tasks-page__task-location">
                      <button
                        type="button"
                        className="tasks-page__coord-button"
                        onClick={() => handleCopyCoordinate(task.coordinate)}
                        disabled={!String(task.coordinate || "").trim()}
                        title={String(task.coordinate || "").trim() ? t("tasks.clickToCopy") : t("tasks.noCoordinate")}
                      >
                        <strong>{safeText(task.coordinate, t("common.notProvided"))}</strong>
                      </button>
                      <span className="tasks-page__task-location-item">
                        <span className="tasks-page__task-location-stack">
                          <strong>{safeText(task.city, t("common.notProvided"))}</strong>
                          <span className="tasks-page__task-location-secondary">{formatContinent(task.continent, t)}</span>
                        </span>
                      </span>
                    </div>

                    <div className="tasks-page__task-details">
                      {task.description ? <p className="tasks-page__card-description">{task.description}</p> : null}
                      <span>
                        {t("dashboard.type")}:
                        <strong>
                          <span className="tasks-page__types-group">
                            {typeArray.map((type) => {
                              const typeMeta = getTaskTypeMeta(type, t)
                              return (
                                <span key={type} className={typeMeta.className}>
                                  <span aria-hidden="true" className="tasks-page__type-icon">{typeMeta.icon}</span>
                                  {typeMeta.label}
                                </span>
                              )
                            })}
                          </span>
                        </strong>
                      </span>
                      <span>{t("tasks.minLevel")}: <strong>{task.min_level}</strong></span>
                      {task.continent === "nightmare_world" && task.nw_level !== null && task.nw_level !== undefined ? <span>{t("tasks.nightmareLevel")}: <strong>{task.nw_level}</strong></span> : null}
                      <span>{t("tasks.reward")}: <RewardDisplay rewardText={task.reward_text} t={t} /></span>
                    </div>
                  </div>

                  <div className="tasks-page__card-actions">
                    {!task.is_completed ? (
                      <>
                        <button
                          type="button"
                          className="tasks-page__ghost-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleCompleteTask(task.template_id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? t("tasks.saving") : t("tasks.complete")}
                        </button>

                        <button
                          type="button"
                          className="tasks-page__danger-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => requestRemoveTask(task)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? t("tasks.saving") : t("tasks.removeTask")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="tasks-page__ghost-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleUncompleteTask(task.template_id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? t("tasks.saving") : t("tasks.uncomplete")}
                        </button>

                        <div className="tasks-page__completed-note">
                          {t("tasks.completedNote")}
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
        <div className="tasks-catalog-modal__backdrop">
          {isLoadingCatalog ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              flexDirection: "column",
              gap: "20px",
            }}>
              <div style={{
                width: "50px",
                height: "50px",
                border: "4px solid rgba(168, 85, 247, 0.2)",
                borderTop: "4px solid rgb(168, 85, 247)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }} />
              <p style={{ color: "#fff", fontSize: "18px" }}>{t("tasks.catalog.loading")}</p>
            </div>
          ) : (
          <div className="tasks-catalog-modal">
            <div className="tasks-catalog-modal__header">
              <div>
                <h2 className="tasks-catalog-modal__title">{t("tasks.catalog.title")}</h2>
                <p className="tasks-catalog-modal__subtitle">
                  {t("tasks.catalog.subtitle")}
                </p>
              </div>

              <button
                type="button"
                className="tasks-catalog-modal__close"
                onClick={closeCatalog}
                disabled={Boolean(processingTemplateId)}
              >
                ✕
              </button>
            </div>

            <div className="tasks-catalog-modal__filters">
              <input
                className="tasks-page__input"
                placeholder={t("tasks.catalog.searchByName")}
                value={catalogFilters.search}
                onChange={(e) =>
                  updateCatalogFilters({ search: e.target.value })
                }
              />

              <AppSelect
                className="tasks-page__select"
                value={catalogFilters.task_type}
                options={taskTypes}
                onChange={(value) =>
                  updateCatalogFilters({ task_type: value })
                }
              />

              <AppSelect
                className="tasks-page__select"
                value={catalogFilters.continent}
                options={continents}
                onChange={(value) =>
                  updateCatalogFilters((prev) => ({ ...prev, continent: value, city: "" }))
                }
              />

              <AppSelect
                className="tasks-page__select"
                value={catalogFilters.city}
                options={[
                  { value: "", label: t("tasks.allCities") },
                  ...catalogCityOptions,
                ]}
                onChange={(value) =>
                  updateCatalogFilters({ city: value })
                }
              />

              <input
                className="tasks-page__input"
                type="number"
                placeholder={t("tasks.catalog.minLevel")}
                value={catalogFilters.min_level}
                onChange={(e) =>
                  updateCatalogFilters({ min_level: e.target.value })
                }
              />

              {catalogFilters.continent === "nightmare_world" && (
                <input
                  className="tasks-page__input"
                  type="number"
                  placeholder={t("tasks.nightmareLevel")}
                  min="1"
                  max="999"
                  value={catalogFilters.nw_level}
                  onChange={(e) =>
                    updateCatalogFilters({ nw_level: e.target.value })
                  }
                />
              )}
            </div>

            <div className="tasks-catalog-modal__summary">
              <span className="tasks-page__filters-result">
                {showUnavailableCatalogTasks
                  ? t("tasks.catalog.allVisible", { total: catalogTotal })
                  : t("tasks.catalog.onlyAvailable", { total: catalogTotal })}
              </span>
              <button
                type="button"
                className="tasks-page__ghost-button"
                onClick={() => {
                  setCatalogPage(1)
                  setShowUnavailableCatalogTasks((prev) => !prev)
                }}
              >
                {showUnavailableCatalogTasks
                  ? t("tasks.catalog.hideUnavailable")
                  : t("tasks.catalog.showUnavailable")}
              </button>
            </div>

            <div className="tasks-page__filters-summary">
              <span className="tasks-page__filters-result">
                {t("tasks.catalog.pageStatus", {
                  page: catalogPage,
                  totalPages: catalogTotalPages,
                  count: displayedCatalog.length,
                })}
              </span>
              <div className="tasks-page__filters-summary-actions">
                <button type="button" className="tasks-page__ghost-button" onClick={() => setCatalogPage((prev) => Math.max(1, prev - 1))} disabled={isLoadingCatalog || catalogPage <= 1}>{t("tasks.catalog.previous")}</button>
                <button type="button" className="tasks-page__ghost-button" onClick={() => setCatalogPage((prev) => Math.min(catalogTotalPages, prev + 1))} disabled={isLoadingCatalog || catalogPage >= catalogTotalPages}>{t("tasks.catalog.next")}</button>
              </div>
            </div>

            <div className="tasks-catalog-modal__content">
              <div className="tasks-page__cards-grid">
                {isLoadingCatalog ? (
                  <>
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                  </>
                ) : !displayedCatalog.length ? (
                  <div className="tasks-page__empty tasks-page__empty--full">
                    {t("tasks.noneFound")}
                  </div>
                ) : (
                  displayedCatalog.map((task) => {
                    const isProcessing = processingTemplateId === task.id
                    const typeArray = Array.isArray(task.task_type) ? task.task_type : [task.task_type]

                    return (
                      <article
                        key={task.id}
                        className={
                          task.status === "completed"
                            ? "tasks-page__card tasks-page__card--completed"
                            : "tasks-page__card"
                        }
                      >
                        <div className="tasks-page__card-main">
                          <div className="tasks-page__card-top">
                            <strong className="tasks-page__card-title">
                              {getTaskCardName(task, t("common.notProvided"))}
                            </strong>

                            <span
                              className={
                                task.status === "completed"
                                  ? "tasks-page__status tasks-page__status--completed"
                                  : task.status === "active"
                                    ? "tasks-page__status tasks-page__status--active"
                                    : "tasks-page__status tasks-page__status--available"
                              }
                            >
                              {task.status === "completed"
                                ? t("tasks.status.completedShort")
                                : task.status === "active"
                                  ? t("tasks.status.activeShort")
                                  : t("tasks.status.availableShort")}
                            </span>
                          </div>

                          <div className="tasks-page__task-location">
                            <button
                              type="button"
                              className="tasks-page__coord-button"
                              onClick={() => handleCopyCoordinate(task.coordinate)}
                              disabled={!String(task.coordinate || "").trim()}
                              title={String(task.coordinate || "").trim() ? t("tasks.clickToCopy") : t("tasks.noCoordinate")}
                            >
                              <strong>{safeText(task.coordinate, t("common.notProvided"))}</strong>
                            </button>
                            <span className="tasks-page__task-location-item">
                              <span className="tasks-page__task-location-stack">
                                <strong>{safeText(task.city, t("common.notProvided"))}</strong>
                                <span className="tasks-page__task-location-secondary">{formatContinent(task.continent, t)}</span>
                              </span>
                            </span>
                          </div>

                          <div className="tasks-page__task-details">
                            {task.description ? <p className="tasks-page__card-description">{task.description}</p> : null}
                            <span>
                              {t("dashboard.type")}:
                              <strong>
                                <span className="tasks-page__types-group">
                                  {typeArray.map((type) => {
                                    const typeMeta = getTaskTypeMeta(type, t)
                                    return (
                                      <span key={type} className={typeMeta.className}>
                                        <span aria-hidden="true" className="tasks-page__type-icon">{typeMeta.icon}</span>
                                        {typeMeta.label}
                                      </span>
                                    )
                                  })}
                                </span>
                              </strong>
                            </span>
                            <span>{t("tasks.minLevel")}: <strong>{task.min_level}</strong></span>
                            {task.continent === "nightmare_world" && task.nw_level !== null && task.nw_level !== undefined ? <span>{t("tasks.nightmareLevel")}: <strong>{task.nw_level}</strong></span> : null}
                            <span>{t("tasks.reward")}: <RewardDisplay rewardText={task.reward_text} t={t} /></span>
                          </div>
                        </div>

                        <div className="tasks-page__card-actions">
                          {task.status === "available" ? (
                            <button
                              type="button"
                              className="tasks-page__primary-button tasks-page__primary-button--full"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleActivateTask(task.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? t("tasks.catalog.activating") : t("tasks.catalog.activate")}
                            </button>
                          ) : task.status === "active" ? (
                            <div className="tasks-page__active-note">
                              {t("tasks.catalog.alreadyActive")}
                            </div>
                          ) : (
                            <div className="tasks-page__completed-note">
                              {t("tasks.catalog.alreadyCompleted")}
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
          )}
        </div>
      )}
    </AppShell>
  )
}
