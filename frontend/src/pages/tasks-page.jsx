import { useEffect, useMemo, useRef, useState } from "react"
import useStableScroll from "../hooks/use-stable-scroll.js"
import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import ConfirmActionModal from "../components/confirm-action-modal.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { apiRequest } from "../services/api.js"
import { readAppPreferences } from "../services/app-preferences.js"
import "../styles/tasks-page.css"

const taskTypes = [
  { value: "", label: "Todos os tipos" },
  { value: "item_delivery", label: "Entrega de itens" },
  { value: "defeat", label: "Derrotar" },
  { value: "capture", label: "Capturar" },
  { value: "outro", label: "Outro" },
]

const continents = [
  { value: "", label: "Todos os continentes" },
  { value: "kanto", label: "Kanto" },
  { value: "johto", label: "Johto" },
  { value: "orange_islands", label: "Ilhas Laranjas" },
  { value: "outland", label: "Outland" },
  { value: "nightmare_world", label: "Nightmare World" },
  { value: "orre", label: "Orre" },
]

function formatTaskType(value) {
  const map = {
    item_delivery: "Entrega de itens",
    defeat: "Derrotar",
    capture: "Capturar",
    outro: "Outro",
  }

  if (Array.isArray(value)) {
    return value.map((v) => map[v] || v).join(", ")
  }

  return map[value] || value
}

function getTaskTypeMeta(value) {
  if (value === "defeat") {
    return {
      label: "Derrotar",
      icon: "☠",
      className: "tasks-page__type-chip tasks-page__type-chip--defeat",
    }
  }

  if (value === "item_delivery") {
    return {
      label: "Entrega",
      icon: "✦",
      className: "tasks-page__type-chip tasks-page__type-chip--delivery",
    }
  }

  if (value === "capture") {
    return {
      label: "Captura",
      icon: "◓",
      className: "tasks-page__type-chip tasks-page__type-chip--capture",
    }
  }

  if (value === "outro") {
    return {
      label: "Outro",
      icon: "▪",
      className: "tasks-page__type-chip tasks-page__type-chip--outro",
    }
  }

  return {
    label: formatTaskType(value),
    icon: "•",
    className: "tasks-page__type-chip",
  }
}

function formatContinent(value) {
  const map = {
    kanto: "Kanto",
    johto: "Johto",
    orange_islands: "Ilhas Laranjas",
    outland: "Outland",
    nightmare_world: "Nightmare World",
    orre: "Orre",
  }

  return map[value] || value
}

function formatCity(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (!raw) return ""

  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function safeText(value, fallback = "Nao informado") {
  const content = String(value || "").trim()
  return content || fallback
}

function getTaskCardName(task) {
  return safeText(task?.npc_name || task?.name)
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

function RewardDisplay({ rewardText }) {
  const reward = parseRewardText(rewardText)
  if (!reward) {
    return <strong>{safeText(rewardText)}</strong>
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

function Toast({ feedback, onClose }) {
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
          {feedback.type === "success" ? "Sucesso" : "Erro"}
        </strong>
        <span className="tasks-toast__message">{feedback.message}</span>
      </div>

      <button
        type="button"
        className="tasks-toast__close"
        onClick={onClose}
        aria-label="Fechar aviso"
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
  const { activeCharacter } = useCharacter()
  const preferences = useMemo(() => readAppPreferences(), [])

  const [tasks, setTasks] = useState([])
  const [catalog, setCatalog] = useState([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [showUnavailableCatalogTasks, setShowUnavailableCatalogTasks] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [processingTemplateId, setProcessingTemplateId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const preserveScroll = useStableScroll()
  const isFirstCatalogOpenRef = useRef(true)

  const [catalogFilters, setCatalogFilters] = useState({
    search: "",
    task_type: "",
    continent: "kanto",
    city: "",
    min_level: "",
    max_level: "",
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

  // Usa city SEM debounce para carregar o catálogo rápido
  const catalogFiltersForLoading = useMemo(() => ({
    ...debouncedCatalogFilters,
    city: catalogFilters.city,
  }), [debouncedCatalogFilters, catalogFilters.city])

  async function handleCopyCoordinate(rawCoordinate) {
    const coordinate = String(rawCoordinate || "").trim()
    if (!coordinate) return
    try {
      await navigator.clipboard.writeText(coordinate)
      setFeedback({ type: "success", message: `Coordenada copiada: ${coordinate}` })
    } catch {
      setFeedback({ type: "error", message: "Nao foi possivel copiar a coordenada." })
    }
  }

  useEffect(() => {
    if (!feedback) return

    const timer = setTimeout(() => {
      setFeedback(null)
    }, 3200)

    return () => clearTimeout(timer)
  }, [feedback])

  useEffect(() => {
    if (!activeCharacter?.id) {
      setTasks([])
      setIsLoadingTasks(false)
      return
    }

    loadTasks()
  }, [activeCharacter?.id])

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      if (a.min_level !== b.min_level) return a.min_level - b.min_level
      return a.name.localeCompare(b.name, "pt-BR")
    })
  }, [tasks])

  const activeCitiesOptions = useMemo(() => {
    const pendingTasks = sortedTasks.filter((task) => !task.is_completed)
    const citySet = new Set(
      pendingTasks
        .map((task) => String(task.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [sortedTasks])

  useEffect(() => {
    setListFilters((prev) => {
      const hasSelectedCity = activeCitiesOptions.some((city) => city.value === prev.city)

      if (prev.city && hasSelectedCity) return prev

      if (activeCitiesOptions.length) {
        return { ...prev, city: activeCitiesOptions[0].value }
      }

      if (prev.city) {
        return { ...prev, city: "" }
      }

      return prev
    })
  }, [activeCitiesOptions])

  useEffect(() => {
    if (!isCatalogOpen || !activeCharacter?.id) return
    if (!isFirstCatalogOpenRef.current) return

    isFirstCatalogOpenRef.current = false
    setIsLoadingCatalog(true)

    const loadInitialCatalog = async () => {
      try {
        const query = buildCatalogQuery(catalogFilters)
        const data = await apiRequest(`/tasks/catalog?${query}`)
        setCatalog(data)
        
        const citySet = new Set(
          data
            .map((task) => String(task.city || "").trim())
            .filter(Boolean)
            .map((city) => city.toLowerCase())
        )
        
        const sortedCities = Array.from(citySet)
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
        
        if (sortedCities.length) {
          setCatalogFilters((prev) => ({
            ...prev,
            city: sortedCities[0],
          }))
        }
        
        setIsLoadingCatalog(false)
      } catch (err) {
        setFeedback({
          type: "error",
          message: err.message || "Não foi possível carregar o catálogo de tasks.",
        })
        setIsLoadingCatalog(false)
      }
    }

    loadInitialCatalog()
  }, [isCatalogOpen, activeCharacter?.id])

  const catalogCityOptions = useMemo(() => {
    const citySet = new Set(
      catalog
        .map((task) => String(task.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [catalog])

  useEffect(() => {
    if (!isCatalogOpen) {
      isFirstCatalogOpenRef.current = true
    }
  }, [isCatalogOpen])

  const catalogBySearchAndCity = useMemo(() => {
    const normalizedSearch = debouncedCatalogFilters.search.trim().toLowerCase()

    return catalog.filter((item) => {
      const cityMatch =
        !debouncedCatalogFilters.city
        || String(item.city || "").trim().toLowerCase() === debouncedCatalogFilters.city

      if (!cityMatch) return false

      if (!normalizedSearch) return true
      return String(item.name || "").toLowerCase().includes(normalizedSearch)
    })
  }, [catalog, debouncedCatalogFilters.search, debouncedCatalogFilters.city])

  const hiddenCatalogCount = useMemo(() => {
    return catalogBySearchAndCity.filter((item) => item.status !== "available").length
  }, [catalogBySearchAndCity])

  const filteredCatalog = useMemo(() => {
    const scoped = showUnavailableCatalogTasks
      ? catalogBySearchAndCity
      : catalogBySearchAndCity.filter((item) => item.status === "available")

    if (!showUnavailableCatalogTasks) {
      return scoped
    }

    const rank = { available: 0, active: 1, completed: 2 }

    return [...scoped].sort((a, b) => {
      const statusDiff = (rank[a.status] ?? 99) - (rank[b.status] ?? 99)
      if (statusDiff !== 0) return statusDiff

      const levelDiff = (a.min_level || 0) - (b.min_level || 0)
      if (levelDiff !== 0) return levelDiff

      return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")
    })
  }, [catalogBySearchAndCity, showUnavailableCatalogTasks])

  async function loadTasks() {
    if (!activeCharacter?.id) return

    setIsLoadingTasks(true)

    try {
      const data = await apiRequest(`/tasks?character_id=${activeCharacter.id}`)
      setTasks(data)
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível carregar as tasks.",
      })
    } finally {
      setIsLoadingTasks(false)
    }
  }

  function buildCatalogQuery(nextFilters) {
    const params = new URLSearchParams()
    params.append("character_id", String(activeCharacter.id))

    if (nextFilters.task_type) params.append("task_type", nextFilters.task_type)
    if (nextFilters.continent) params.append("continent", nextFilters.continent)
    if (nextFilters.min_level) params.append("min_level", String(nextFilters.min_level))
    if (nextFilters.max_level) params.append("max_level", String(nextFilters.max_level))
    if (nextFilters.nw_level) params.append("nw_level", String(nextFilters.nw_level))

    return params.toString()
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
        message: "Task voltou para pendente.",
      })

      await Promise.all([
        loadTasks(),
        isCatalogOpen ? loadCatalog(catalogFiltersForLoading) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível desconcluir a task.",
      })
    } finally {
      setProcessingTemplateId(null)
    }
  }

  async function loadCatalog(nextFilters = catalogFilters) {
    if (!activeCharacter?.id) return

    setIsLoadingCatalog(true)

    try {
      const query = buildCatalogQuery(nextFilters)
      const data = await apiRequest(`/tasks/catalog?${query}`)
      setCatalog(data)
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível carregar o catálogo de tasks.",
      })
    } finally {
      setIsLoadingCatalog(false)
    }
  }

  function openCatalog() {
    preserveScroll()
    setShowUnavailableCatalogTasks(false)
    setIsLoadingCatalog(true)
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
        message: "Task ativada com sucesso.",
      })

      await Promise.all([loadTasks(), loadCatalog(catalogFiltersForLoading)])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível ativar a task.",
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
        message: "Task concluída com sucesso.",
      })

      await Promise.all([
        loadTasks(),
        isCatalogOpen ? loadCatalog(catalogFiltersForLoading) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível concluir a task.",
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
        message: "Task removida da lista ativa.",
      })
      setRemoveConfirm(null)

      await Promise.all([
        loadTasks(),
        isCatalogOpen ? loadCatalog(catalogFiltersForLoading) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível remover a task.",
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
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />

      <ConfirmActionModal
        open={isConfirmingRemove}
        title="Remover task ativa?"
        description={
          removeConfirm
            ? `A task "${removeConfirm.name}" será removida da lista ativa deste personagem. Você poderá ativá-la novamente depois.`
            : ""
        }
        confirmLabel="Remover task"
        cancelLabel="Cancelar"
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
            <h2 className="tasks-page__title">Tasks ativas</h2>
          </div>

          <button
            type="button"
            className="tasks-page__primary-button"
            onClick={openCatalog}
            disabled={!activeCharacter}
          >
            Nova Task
          </button>
        </div>

        <div className="tasks-page__stats">
          <div className="tasks-page__stat-card">
            <span className="tasks-page__stat-label">Total</span>
            <strong className="tasks-page__stat-value">{stats.total}</strong>
          </div>

          <div className="tasks-page__stat-card">
            <span className="tasks-page__stat-label">Pendentes</span>
            <strong className="tasks-page__stat-value">{stats.pending}</strong>
          </div>

          <div className="tasks-page__stat-card tasks-page__stat-card--success">
            <span className="tasks-page__stat-label">Concluídas</span>
            <strong className="tasks-page__stat-value">{stats.completed}</strong>
          </div>
        </div>

        <div className="tasks-page__filters-card">
          <div className="tasks-page__filters-grid">
            <input
              className="tasks-page__input"
              placeholder="Buscar task ativa"
              value={listFilters.search}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />

            <select
              className="tasks-page__input"
              value={listFilters.status}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              <option value="">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="completed">Concluídas</option>
            </select>

            <select
              className="tasks-page__input"
              value={listFilters.task_type}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, task_type: e.target.value }))
              }
            >
              {taskTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="tasks-page__input"
              value={listFilters.continent}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, continent: e.target.value }))
              }
            >
              {continents.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="tasks-page__input"
              value={listFilters.city}
              onChange={(e) =>
                setListFilters((prev) => ({ ...prev, city: e.target.value }))
              }
            >
              <option value="">Todas as cidades</option>
              {activeCitiesOptions.map((city) => (
                <option key={city.value} value={city.value}>
                  {city.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!listFilters.status && hiddenCompletedCount > 0 && (
          <div className="tasks-page__filters-summary">
            <span className="tasks-page__filters-result">
              {showCompletedTasks
                ? `${hiddenCompletedCount} tasks concluídas visíveis no fim da lista.`
                : `${hiddenCompletedCount} tasks concluídas ocultas.`}
            </span>
            <button
              type="button"
              className="tasks-page__ghost-button"
              onClick={() => setShowCompletedTasks((prev) => !prev)}
            >
              {showCompletedTasks ? "Ocultar concluídas" : "Desocultar concluídas"}
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
              Nenhuma task encontrada para os filtros atuais.
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
                      <strong className="tasks-page__card-title">{getTaskCardName(task)}</strong>

                      <span
                        className={
                          task.is_completed
                            ? "tasks-page__status tasks-page__status--completed"
                            : "tasks-page__status tasks-page__status--pending"
                        }
                      >
                        {task.is_completed ? "Concluída" : "Pendente"}
                      </span>
                    </div>

                    <div className="tasks-page__task-location">
                      <button
                        type="button"
                        className="tasks-page__coord-button"
                        onClick={() => handleCopyCoordinate(task.coordinate)}
                        disabled={!String(task.coordinate || "").trim()}
                        title={String(task.coordinate || "").trim() ? "Clique para copiar" : "Sem coordenada"}
                      >
                        <strong>{safeText(task.coordinate)}</strong>
                      </button>
                      <span className="tasks-page__task-location-item">
                        <span className="tasks-page__task-location-stack">
                          <strong>{safeText(task.city)}</strong>
                          <span className="tasks-page__task-location-secondary">{formatContinent(task.continent)}</span>
                        </span>
                      </span>
                    </div>

                    <div className="tasks-page__task-details">
                      {task.description ? <p className="tasks-page__card-description">{task.description}</p> : null}
                      <span>
                        Tipo:
                        <strong>
                          <span className="tasks-page__types-group">
                            {typeArray.map((type) => {
                              const typeMeta = getTaskTypeMeta(type)
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
                      <span>Nivel minimo: <strong>{task.min_level}</strong></span>
                      {task.continent === "nightmare_world" && task.nw_level !== null && task.nw_level !== undefined ? <span>NW Level: <strong>{task.nw_level}</strong></span> : null}
                      <span>Recompensa: <RewardDisplay rewardText={task.reward_text} /></span>
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
                          {isProcessing ? "Salvando..." : "Concluir"}
                        </button>

                        <button
                          type="button"
                          className="tasks-page__danger-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => requestRemoveTask(task)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? "Salvando..." : "Remover"}
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
                          {isProcessing ? "Salvando..." : "Desconcluir"}
                        </button>

                        <div className="tasks-page__completed-note">
                          Task concluída.
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
              <p style={{ color: "#fff", fontSize: "18px" }}>Carregando tasks...</p>
            </div>
          ) : (
          <div className="tasks-catalog-modal">
            <div className="tasks-catalog-modal__header">
              <div>
                <h2 className="tasks-catalog-modal__title">Nova Task</h2>
                <p className="tasks-catalog-modal__subtitle">
                  Ative novas tasks para o personagem atual.
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
                placeholder="Buscar por nome"
                value={catalogFilters.search}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, search: e.target.value }))
                }
              />

              <select
                className="tasks-page__input"
                value={catalogFilters.task_type}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, task_type: e.target.value }))
                }
              >
                {taskTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                className="tasks-page__input"
                value={catalogFilters.continent}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, continent: e.target.value, city: "" }))
                }
              >
                {continents.filter((item) => item.value).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                className="tasks-page__input"
                value={catalogFilters.city}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, city: e.target.value }))
                }
              >
                {catalogCityOptions.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>

              <input
                className="tasks-page__input"
                type="number"
                placeholder="Nível mín."
                value={catalogFilters.min_level}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, min_level: e.target.value }))
                }
              />

              <input
                className="tasks-page__input"
                type="number"
                placeholder="Nível máx."
                value={catalogFilters.max_level}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, max_level: e.target.value }))
                }
              />

              {catalogFilters.continent === "nightmare_world" && (
                <input
                  className="tasks-page__input"
                  type="number"
                  placeholder="NW Level"
                  min="1"
                  max="999"
                  value={catalogFilters.nw_level}
                  onChange={(e) =>
                    setCatalogFilters((prev) => ({ ...prev, nw_level: e.target.value }))
                  }
                />
              )}
            </div>

            <div className="tasks-catalog-modal__summary">
              <span className="tasks-page__filters-result">
                {showUnavailableCatalogTasks
                  ? `${hiddenCatalogCount} tasks já ativas/concluídas visíveis no fim da lista.`
                  : `${hiddenCatalogCount} tasks já ativas/concluídas ocultas.`}
              </span>
              <button
                type="button"
                className="tasks-page__ghost-button"
                onClick={() => setShowUnavailableCatalogTasks((prev) => !prev)}
              >
                {showUnavailableCatalogTasks
                  ? "Ocultar já ativadas/concluídas"
                  : "Desocultar já ativadas/concluídas"}
              </button>
            </div>

            <div className="tasks-catalog-modal__content">
              <div className="tasks-page__cards-grid">
                {isLoadingCatalog ? (
                  <>
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                  </>
                ) : !filteredCatalog.length ? (
                  <div className="tasks-page__empty tasks-page__empty--full">
                    Nenhuma task encontrada para os filtros atuais.
                  </div>
                ) : (
                  filteredCatalog.map((task) => {
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
                              {getTaskCardName(task)}
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
                                ? "Concluída"
                                : task.status === "active"
                                  ? "Ativa"
                                  : "Disponível"}
                            </span>
                          </div>

                          <div className="tasks-page__task-location">
                            <button
                              type="button"
                              className="tasks-page__coord-button"
                              onClick={() => handleCopyCoordinate(task.coordinate)}
                              disabled={!String(task.coordinate || "").trim()}
                              title={String(task.coordinate || "").trim() ? "Clique para copiar" : "Sem coordenada"}
                            >
                              <strong>{safeText(task.coordinate)}</strong>
                            </button>
                            <span className="tasks-page__task-location-item">
                              <span className="tasks-page__task-location-stack">
                                <strong>{safeText(task.city)}</strong>
                                <span className="tasks-page__task-location-secondary">{formatContinent(task.continent)}</span>
                              </span>
                            </span>
                          </div>

                          <div className="tasks-page__task-details">
                            {task.description ? <p className="tasks-page__card-description">{task.description}</p> : null}
                            <span>
                              Tipo:
                              <strong>
                                <span className="tasks-page__types-group">
                                  {typeArray.map((type) => {
                                    const typeMeta = getTaskTypeMeta(type)
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
                            <span>Nivel minimo: <strong>{task.min_level}</strong></span>
                            {task.continent === "nightmare_world" && task.nw_level !== null && task.nw_level !== undefined ? <span>NW Level: <strong>{task.nw_level}</strong></span> : null}
                            <span>Recompensa: <RewardDisplay rewardText={task.reward_text} /></span>
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
                              {isProcessing ? "Ativando..." : "Ativar"}
                            </button>
                          ) : task.status === "active" ? (
                            <div className="tasks-page__active-note">
                              Essa task já está ativa.
                            </div>
                          ) : (
                            <div className="tasks-page__completed-note">
                              Essa task já foi concluída por este personagem.
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