import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { adminRequest, clearAdminToken, getAdminToken } from "../services/admin-api.js"
import { API_URL } from "../services/session-manager.js"
import { readAppPreferences } from "../services/app-preferences.js"

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

const taskInitialForm = {
  name: "",
  description: "",
  task_type: ["defeat"],
  continent: "kanto",
  min_level: 5,
  nw_level: "",
  reward_text: "",
  coordinate: "",
  city: "",
  is_active: true,
}

const questInitialForm = {
  name: "",
  description: "",
  continent: "kanto",
  min_level: 5,
  nw_level: "",
  reward_text: "",
  is_active: true,
}

const npcPriceInitialForm = {
  previous_name: "",
  name: "",
  unit_price: "0",
}

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

function normalizeCoordinateInput(rawCoordinate) {
  const text = String(rawCoordinate || "").trim()
  if (!text) {
    return null
  }
  const parts = text.split(/[^0-9-]+/).filter(Boolean)
  if (parts.length !== 3) {
    throw new Error("Coordenada deve ter 3 valores inteiros: x,y,z (podem ser negativos)")
  }

  const numbers = parts.map((part) => Number(part))
  const invalid = numbers.some((num) => !Number.isInteger(num))
  if (invalid) {
    throw new Error("Cada valor da coordenada deve ser inteiro válido")
  }

  return `${numbers[0]},${numbers[1]},${numbers[2]}`
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function Toast({ toast, onClose }) {
  if (!toast) return null

  return (
    <div className={toast.type === "success" ? "admin-toast admin-toast--success" : "admin-toast admin-toast--error"}>
      <div className="admin-toast__content">
        <strong className="admin-toast__title">{toast.type === "success" ? "Sucesso" : "Erro"}</strong>
        <span className="admin-toast__message">{toast.message}</span>
      </div>

      <button type="button" className="admin-toast__close" onClick={onClose} aria-label="Fechar aviso">
        ✕
      </button>
    </div>
  )
}

export default function AdminPage() {
  const navigate = useNavigate()
  const preferences = useMemo(() => readAppPreferences(), [])

  const [activeTab, setActiveTab] = useState("tasks")
  const [adminName, setAdminName] = useState("")
  const [tasks, setTasks] = useState([])
  const [quests, setQuests] = useState([])
  const [aliases, setAliases] = useState([])
  const [npcPrices, setNpcPrices] = useState([])
  const [taskFilters, setTaskFilters] = useState({
    search: "",
    task_type: "",
    continent: "kanto",
    nw_level: "",
    city: "",
    min_level: "",
    max_level: "",
    is_active: "",
  })
  const [questFilters, setQuestFilters] = useState({
    search: "",
    continent: "kanto",
    nw_level: "",
    min_level: "",
    max_level: "",
    is_active: "",
  })
  const [aliasFilters, setAliasFilters] = useState({
    search: "",
    status: "pending",
  })
  const [npcPriceFilters, setNpcPriceFilters] = useState({
    search: "",
  })
  const [pokemon, setPokemon] = useState([])
  const [sidebarMenus, setSidebarMenus] = useState([])
  const [pokemonFilters, setPokemonFilters] = useState({ search: "" })
  const [pokemonModal, setPokemonModal] = useState(null)
  const [pokemonForm, setPokemonForm] = useState({ dex_id: "", name: "" })
  const [isLoadingPokemon, setIsLoadingPokemon] = useState(true)
  const [isLoadingSidebarMenus, setIsLoadingSidebarMenus] = useState(true)
  const [isSubmittingPokemon, setIsSubmittingPokemon] = useState(false)
  const [savingSidebarMenuMap, setSavingSidebarMenuMap] = useState({})
  const [isDeletingPokemon, setIsDeletingPokemon] = useState(false)
  const debouncedTaskFilters = useDebouncedValue(taskFilters, 250)
  const debouncedQuestFilters = useDebouncedValue(questFilters, 250)
  const debouncedAliasFilters = useDebouncedValue(aliasFilters, 250)
  const debouncedNpcPriceFilters = useDebouncedValue(npcPriceFilters, 250)
  const debouncedPokemonFilters = useDebouncedValue(pokemonFilters, 250)
  const [taskModal, setTaskModal] = useState(null)
  const [questModal, setQuestModal] = useState(null)
  const [npcPriceModal, setNpcPriceModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [taskForm, setTaskForm] = useState(taskInitialForm)
  const [questForm, setQuestForm] = useState(questInitialForm)
  const [npcPriceForm, setNpcPriceForm] = useState(npcPriceInitialForm)
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [isLoadingQuests, setIsLoadingQuests] = useState(true)
  const [isLoadingAliases, setIsLoadingAliases] = useState(true)
  const [isLoadingNpcPrices, setIsLoadingNpcPrices] = useState(true)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [isSubmittingQuest, setIsSubmittingQuest] = useState(false)
  const [isSubmittingNpcPrice, setIsSubmittingNpcPrice] = useState(false)
  const [isTogglingTaskId, setIsTogglingTaskId] = useState(null)
  const [isTogglingQuestId, setIsTogglingQuestId] = useState(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)
  const [ocrDebugEnabled, setOcrDebugEnabled] = useState(false)
  const [isLoadingOcrDebug, setIsLoadingOcrDebug] = useState(true)
  const [isSavingOcrDebug, setIsSavingOcrDebug] = useState(false)
  const [ocrDebugSessions, setOcrDebugSessions] = useState([])
  const [isLoadingOcrDebugSessions, setIsLoadingOcrDebugSessions] = useState(false)
  const [selectedOcrDebugSession, setSelectedOcrDebugSession] = useState("")
  const [ocrDebugFiles, setOcrDebugFiles] = useState([])
  const [isLoadingOcrDebugFiles, setIsLoadingOcrDebugFiles] = useState(false)
  const [ocrDebugTextPreview, setOcrDebugTextPreview] = useState("")
  const [ocrDebugPreviewTitle, setOcrDebugPreviewTitle] = useState("")
  const [aliasDrafts, setAliasDrafts] = useState({})
  const [aliasSavingMap, setAliasSavingMap] = useState({})
  const [toast, setToast] = useState(null)

  const taskCityOptions = useMemo(() => {
    const citySet = new Set(
      tasks
        .map((task) => String(task.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [tasks])

  const filteredTasks = useMemo(() => {
    // Se há busca, ignorar filtro de cidade e mostrar todas as tasks
    if (debouncedTaskFilters.search) {
      return tasks
    }

    // Se tem cidade selecionada, filtrar por ela
    if (taskFilters.city) {
      return tasks.filter(
        (task) => String(task.city || "").trim().toLowerCase() === taskFilters.city
      )
    }

    // Sem busca e sem cidade específica, mostrar todas as tasks
    return tasks
  }, [tasks, taskFilters.city, debouncedTaskFilters.search])

  const taskStats = useMemo(() => ({
    active: tasks.filter((t) => t.is_active).length,
    inactive: tasks.filter((t) => !t.is_active).length,
    city: taskFilters.city ? tasks.filter((t) => String(t.city || "").trim().toLowerCase() === taskFilters.city).length : null,
  }), [tasks, taskFilters.city])

  const questStats = useMemo(() => ({
    active: quests.filter((q) => q.is_active).length,
    inactive: quests.filter((q) => !q.is_active).length,
    continent: questFilters.continent ? quests.filter((q) => q.continent === questFilters.continent).length : null,
  }), [quests, questFilters.continent])

  useEffect(() => {
    if (!getAdminToken()) {
      navigate("/admin/login", { replace: true })
      return
    }

    loadAdminMe()
    loadOcrDebugSettings()
  }, [navigate])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "tasks") return
    loadTasks(debouncedTaskFilters)
  }, [activeTab, debouncedTaskFilters])

  useEffect(() => {
    if (activeTab !== "quests") return
    if (questFilters.continent) return

    setQuestFilters((prev) => ({ ...prev, continent: "kanto" }))
  }, [activeTab, questFilters.continent])

  useEffect(() => {
    if (activeTab !== "tasks") return
    if (taskFilters.continent) return

    setTaskFilters((prev) => ({ ...prev, continent: "kanto" }))
  }, [activeTab, taskFilters.continent])

  useEffect(() => {
    if (activeTab !== "tasks") return

    setTaskFilters((prev) => {
      const hasSelectedCity = taskCityOptions.some((city) => city.value === prev.city)

      if (prev.city && hasSelectedCity) {
        return prev
      }

      if (taskCityOptions.length) {
        return { ...prev, city: taskCityOptions[0].value }
      }

      if (prev.city) {
        return { ...prev, city: "" }
      }

      return prev
    })
  }, [activeTab, taskCityOptions])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "quests") return
    loadQuests(debouncedQuestFilters)
  }, [activeTab, debouncedQuestFilters])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "aliases") return
    loadAliases(debouncedAliasFilters)
  }, [activeTab, debouncedAliasFilters])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "npc-prices") return
    loadNpcPrices(debouncedNpcPriceFilters)
  }, [activeTab, debouncedNpcPriceFilters])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "ocr-debug") return
    loadOcrDebugSessions()
  }, [activeTab])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "pokemon") return
    loadPokemon(debouncedPokemonFilters)
  }, [activeTab, debouncedPokemonFilters])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "sidebar") return
    loadSidebarMenus()
  }, [activeTab])

  useEffect(() => {
    if (!toast) return

    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  function showSuccess(message) {
    setToast({ type: "success", message })
  }

  function showError(message) {
    setToast({ type: "error", message })
  }

  async function loadAdminMe() {
    try {
      const data = await adminRequest("/admin/me")
      setAdminName(data.username)
    } catch {
      clearAdminToken()
      navigate("/admin/login", { replace: true })
    }
  }

  async function loadOcrDebugSettings() {
    setIsLoadingOcrDebug(true)
    try {
      const data = await adminRequest("/admin/ocr-debug")
      setOcrDebugEnabled(Boolean(data?.debug_ocr_enabled))
    } catch (err) {
      showError(err.message || "Erro ao carregar configuração do OCR")
    } finally {
      setIsLoadingOcrDebug(false)
    }
  }

  async function toggleOcrDebug() {
    if (isSavingOcrDebug) return

    setIsSavingOcrDebug(true)
    try {
      const data = await adminRequest("/admin/ocr-debug", {
        method: "PUT",
        body: JSON.stringify({ debug_ocr_enabled: !ocrDebugEnabled }),
      })
      const enabled = Boolean(data?.debug_ocr_enabled)
      setOcrDebugEnabled(enabled)
      showSuccess(enabled ? "Debug OCR ativado." : "Debug OCR desativado.")
    } catch (err) {
      showError(err.message || "Erro ao atualizar debug OCR")
    } finally {
      setIsSavingOcrDebug(false)
    }
  }

  async function loadOcrDebugSessions() {
    setIsLoadingOcrDebugSessions(true)
    try {
      const sessions = await adminRequest("/admin/ocr-debug/sessions?limit=80")
      setOcrDebugSessions(sessions)
      if (sessions.length) {
        await loadOcrDebugFiles(sessions[0].session_id)
      } else {
        setSelectedOcrDebugSession("")
        setOcrDebugFiles([])
        setOcrDebugTextPreview("")
        setOcrDebugPreviewTitle("")
      }
    } catch (err) {
      showError(err.message || "Erro ao carregar sessões de debug OCR")
    } finally {
      setIsLoadingOcrDebugSessions(false)
    }
  }

  async function loadOcrDebugFiles(sessionId) {
    if (!sessionId) return

    setIsLoadingOcrDebugFiles(true)
    setSelectedOcrDebugSession(sessionId)
    setOcrDebugTextPreview("")
    setOcrDebugPreviewTitle("")
    try {
      const files = await adminRequest(`/admin/ocr-debug/sessions/${encodeURIComponent(sessionId)}/files`)
      setOcrDebugFiles(files)
    } catch (err) {
      showError(err.message || "Erro ao carregar arquivos do debug OCR")
    } finally {
      setIsLoadingOcrDebugFiles(false)
    }
  }

  async function openOcrDebugText(fileName) {
    if (!selectedOcrDebugSession || !fileName) return

    try {
      const data = await adminRequest(
        `/admin/ocr-debug/sessions/${encodeURIComponent(selectedOcrDebugSession)}/text/${encodeURIComponent(fileName)}`,
      )
      setOcrDebugPreviewTitle(fileName)
      setOcrDebugTextPreview(String(data?.content || ""))
    } catch (err) {
      showError(err.message || "Erro ao abrir preview de texto")
    }
  }

  async function openOcrDebugFile(fileName) {
    if (!selectedOcrDebugSession || !fileName) return

    const token = getAdminToken()
    if (!token) {
      showError("Sessão admin expirada.")
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/admin/ocr-debug/sessions/${encodeURIComponent(selectedOcrDebugSession)}/download/${encodeURIComponent(fileName)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Não foi possível abrir o arquivo de debug.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, "_blank", "noopener,noreferrer")
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
    } catch (err) {
      showError(err.message || "Erro ao abrir arquivo de debug")
    }
  }

  function buildQuery(filters) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        params.append(key, String(value))
      }
    })

    const query = params.toString()
    return query ? `?${query}` : ""
  }

  async function loadTasks(nextFilters = taskFilters) {
    setIsLoadingTasks(true)
    try {
      // Remove city da query (é apenas um filtro local)
      const { city, ...apiFilters } = nextFilters
      
      // Monta a query string
      const params = new URLSearchParams()
      Object.entries(apiFilters).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          params.append(key, String(value))
        }
      })
      
      const queryString = params.toString()
      const endpoint = `/admin/tasks${queryString ? `?${queryString}` : ""}`
      
      setTasks(await adminRequest(endpoint))
    } catch (err) {
      showError(err.message || "Erro ao carregar tasks")
    } finally {
      setIsLoadingTasks(false)
    }
  }

  async function loadQuests(nextFilters = questFilters) {
    setIsLoadingQuests(true)
    try {
      setQuests(await adminRequest(`/admin/quests${buildQuery(nextFilters)}`))
    } catch (err) {
      showError(err.message || "Erro ao carregar quests")
    } finally {
      setIsLoadingQuests(false)
    }
  }

  async function loadAliases(nextFilters = aliasFilters) {
    setIsLoadingAliases(true)
    try {
      const items = await adminRequest(`/admin/hunt-item-aliases${buildQuery(nextFilters)}`)
      setAliases(items)
      setAliasDrafts((prev) => {
        const next = { ...prev }
        for (const item of items) {
          if (next[item.id] === undefined) {
            next[item.id] = item.canonical_name || item.observed_name
          }
        }
        return next
      })
    } catch (err) {
      showError(err.message || "Erro ao carregar aliases de itens")
    } finally {
      setIsLoadingAliases(false)
    }
  }

  async function loadNpcPrices(nextFilters = npcPriceFilters) {
    setIsLoadingNpcPrices(true)
    try {
      setNpcPrices(await adminRequest(`/admin/hunt-npc-prices${buildQuery(nextFilters)}`))
    } catch (err) {
      showError(err.message || "Erro ao carregar preços NPC")
    } finally {
      setIsLoadingNpcPrices(false)
    }
  }

  async function loadSidebarMenus() {
    setIsLoadingSidebarMenus(true)
    try {
      setSidebarMenus(await adminRequest("/admin/sidebar-menus"))
    } catch (err) {
      showError(err.message || "Erro ao carregar configuração da sidebar")
    } finally {
      setIsLoadingSidebarMenus(false)
    }
  }

  async function updateSidebarMenu(menuKey, nextPatch) {
    if (!menuKey || savingSidebarMenuMap[menuKey]) return

    const current = sidebarMenus.find((menu) => menu.menu_key === menuKey)
    if (!current) return

    const payload = {
      is_enabled: nextPatch.is_enabled ?? current.is_enabled,
      is_beta: nextPatch.is_beta ?? current.is_beta,
    }

    setSavingSidebarMenuMap((prev) => ({ ...prev, [menuKey]: true }))
    try {
      const updated = await adminRequest(`/admin/sidebar-menus/${menuKey}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })

      setSidebarMenus((prev) => prev.map((menu) => (menu.menu_key === menuKey ? updated : menu)))
      showSuccess("Configuração do menu atualizada.")
    } catch (err) {
      showError(err.message || "Erro ao atualizar menu da sidebar")
    } finally {
      setSavingSidebarMenuMap((prev) => {
        const next = { ...prev }
        delete next[menuKey]
        return next
      })
    }
  }

    async function loadPokemon(nextFilters = pokemonFilters) {
      setIsLoadingPokemon(true)
      try {
        setPokemon(await adminRequest(`/admin/pokemon${buildQuery(nextFilters)}`))
      } catch (err) {
        showError(err.message || "Erro ao carregar Pokémon")
      } finally {
        setIsLoadingPokemon(false)
      }
    }

    function openCreatePokemon() {
      setPokemonForm({ dex_id: "", name: "" })
      setPokemonModal({ type: "create" })
    }

    function openEditPokemon(entry) {
      setPokemonForm({ dex_id: entry.dex_id, name: entry.name })
      setPokemonModal({ type: "edit", original_full_name: entry.full_name })
    }

    async function handleSubmitPokemon(event) {
      event.preventDefault()
      setIsSubmittingPokemon(true)
      try {
        if (pokemonModal.type === "create") {
          await adminRequest("/admin/pokemon", {
            method: "POST",
            body: JSON.stringify({ dex_id: pokemonForm.dex_id.trim(), name: pokemonForm.name.trim() }),
          })
          showSuccess("Pokémon adicionado com sucesso.")
        } else {
          await adminRequest("/admin/pokemon", {
            method: "PUT",
            body: JSON.stringify({
              original_full_name: pokemonModal.original_full_name,
              dex_id: pokemonForm.dex_id.trim(),
              name: pokemonForm.name.trim(),
            }),
          })
          showSuccess("Pokémon atualizado com sucesso.")
        }
        setPokemonModal(null)
        await loadPokemon(debouncedPokemonFilters)
      } catch (err) {
        showError(err.message || "Erro ao salvar Pokémon")
      } finally {
        setIsSubmittingPokemon(false)
      }
    }

    async function handleDeletePokemon(fullName) {
      if (isDeletingPokemon) return
      setIsDeletingPokemon(true)
      try {
        await adminRequest(`/admin/pokemon?full_name=${encodeURIComponent(fullName)}`, { method: "DELETE" })
        showSuccess("Pokémon removido.")
        await loadPokemon(debouncedPokemonFilters)
      } catch (err) {
        showError(err.message || "Erro ao remover Pokémon")
      } finally {
        setIsDeletingPokemon(false)
      }
    }

  async function saveAlias(alias, shouldApprove = true) {
    const rawCanonical = aliasDrafts[alias.id] ?? alias.canonical_name ?? alias.observed_name
    const canonicalName = String(rawCanonical || "").trim()

    if (!canonicalName) {
      showError("Informe um nome canônico antes de salvar o alias.")
      return
    }

    setAliasSavingMap((prev) => ({ ...prev, [alias.id]: true }))
    try {
      await adminRequest(`/admin/hunt-item-aliases/${alias.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          canonical_name: canonicalName,
          is_approved: shouldApprove,
        }),
      })

      showSuccess(shouldApprove ? "Alias aprovado e salvo." : "Alias salvo como pendente.")
      await loadAliases(debouncedAliasFilters)
    } catch (err) {
      showError(err.message || "Erro ao atualizar alias")
    } finally {
      setAliasSavingMap((prev) => {
        const next = { ...prev }
        delete next[alias.id]
        return next
      })
    }
  }

  function openEditNpcPrice(item) {
    setNpcPriceForm({
      previous_name: item.normalized_name,
      name: item.name,
      unit_price: String(item.unit_price ?? 0),
    })
    setNpcPriceModal({ item })
  }

  async function handleSubmitNpcPrice(event) {
    event.preventDefault()
    setIsSubmittingNpcPrice(true)

    try {
      await adminRequest("/admin/hunt-npc-prices", {
        method: "PUT",
        body: JSON.stringify({
          previous_name: npcPriceForm.previous_name,
          name: npcPriceForm.name,
          unit_price: Number(String(npcPriceForm.unit_price).replace(",", ".") || 0),
        }),
      })
      showSuccess("Preço NPC atualizado com sucesso.")
      setNpcPriceModal(null)
      await loadNpcPrices(debouncedNpcPriceFilters)
      await loadAliases(debouncedAliasFilters)
    } catch (err) {
      showError(err.message || "Erro ao atualizar preço NPC")
    } finally {
      setIsSubmittingNpcPrice(false)
    }
  }

  function openCreateTask() {
    setTaskForm(taskInitialForm)
    setTaskModal({ type: "create" })
  }

  function openEditTask(task) {
    setTaskForm({
      name: task.name,
      description: task.description || "",
      task_type: Array.isArray(task.task_type) ? task.task_type : [task.task_type],
      continent: task.continent,
      min_level: task.min_level,
      nw_level: task.nw_level ?? "",
      reward_text: task.reward_text || "",
      coordinate: task.coordinate || "",
      city: task.city || "",
      is_active: task.is_active,
    })
    setTaskModal({ type: "edit", item: task })
  }

  function openCreateQuest() {
    setQuestForm(questInitialForm)
    setQuestModal({ type: "create" })
  }

  function openEditQuest(quest) {
    setQuestForm({
      name: quest.name,
      description: quest.description || "",
      continent: quest.continent,
      min_level: quest.min_level,
      nw_level: quest.nw_level ?? "",
      reward_text: quest.reward_text || "",
      is_active: quest.is_active,
    })
    setQuestModal({ type: "edit", item: quest })
  }

  function openDeleteModal(type, item) {
    if (preferences.confirmBeforeRemoving) {
      setDeleteModal({ type, item })
      return
    }

    handleDeleteDirect(type, item)
  }

  function closeDeleteModal() {
    if (!isDeletingItem) {
      setDeleteModal(null)
    }
  }

  async function handleSubmitTask(event) {
    event.preventDefault()
    setIsSubmittingTask(true)

    try {
      if (!String(taskForm.city || "").trim()) {
        throw new Error("Cidade é obrigatória para salvar a task.")
      }
      if (!taskForm.task_type || taskForm.task_type.length === 0) {
        throw new Error("Selecione ao menos um tipo de task.")
      }
      if (taskForm.continent === "nightmare_world" && !String(taskForm.nw_level || "").trim()) {
        throw new Error("NW Level é obrigatório para tasks em Nightmare World.")
      }
      const normalizedCoordinate = taskForm.coordinate ? normalizeCoordinateInput(taskForm.coordinate) : null
      const payload = {
        ...taskForm,
        coordinate: normalizedCoordinate,
        min_level: Number(taskForm.min_level),
        nw_level: taskForm.continent === "nightmare_world" ? Number(taskForm.nw_level) : null,
      }

      if (taskModal.type === "create") {
        await adminRequest("/admin/tasks", { method: "POST", body: JSON.stringify(payload) })
        showSuccess("Task criada com sucesso.")
      } else {
        await adminRequest(`/admin/tasks/${taskModal.item.id}`, { method: "PUT", body: JSON.stringify(payload) })
        showSuccess("Task atualizada com sucesso.")
      }

      setTaskModal(null)
      await loadTasks(debouncedTaskFilters)
    } catch (err) {
      showError(err.message || "Erro ao salvar task")
    } finally {
      setIsSubmittingTask(false)
    }
  }

  async function handleSubmitQuest(event) {
    event.preventDefault()
    setIsSubmittingQuest(true)

    try {
      if (questForm.continent === "nightmare_world" && !String(questForm.nw_level || "").trim()) {
        throw new Error("NW Level é obrigatório para quests em Nightmare World.")
      }

      const payload = {
        ...questForm,
        min_level: Number(questForm.min_level),
        nw_level: questForm.continent === "nightmare_world" ? Number(questForm.nw_level) : null,
      }

      if (questModal.type === "create") {
        await adminRequest("/admin/quests", { method: "POST", body: JSON.stringify(payload) })
        showSuccess("Quest criada com sucesso.")
      } else {
        await adminRequest(`/admin/quests/${questModal.item.id}`, { method: "PUT", body: JSON.stringify(payload) })
        showSuccess("Quest atualizada com sucesso.")
      }

      setQuestModal(null)
      await loadQuests(debouncedQuestFilters)
    } catch (err) {
      showError(err.message || "Erro ao salvar quest")
    } finally {
      setIsSubmittingQuest(false)
    }
  }

  async function toggleTaskActive(taskId) {
    try {
      setIsTogglingTaskId(taskId)
      await adminRequest(`/admin/tasks/${taskId}/toggle-active`, { method: "PATCH" })
      showSuccess("Status da task atualizado.")
      await loadTasks(debouncedTaskFilters)
    } catch (err) {
      showError(err.message || "Erro ao alterar status da task")
    } finally {
      setIsTogglingTaskId(null)
    }
  }

  async function toggleQuestActive(questId) {
    try {
      setIsTogglingQuestId(questId)
      await adminRequest(`/admin/quests/${questId}/toggle-active`, { method: "PATCH" })
      showSuccess("Status da quest atualizado.")
      await loadQuests(debouncedQuestFilters)
    } catch (err) {
      showError(err.message || "Erro ao alterar status da quest")
    } finally {
      setIsTogglingQuestId(null)
    }
  }

  async function handleDeleteDirect(type, item) {
    setIsDeletingItem(true)

    try {
      if (type === "task") {
        await adminRequest(`/admin/tasks/${item.id}`, { method: "DELETE" })
        showSuccess("Task removida permanentemente.")
        await loadTasks(debouncedTaskFilters)
      } else {
        await adminRequest(`/admin/quests/${item.id}`, { method: "DELETE" })
        showSuccess("Quest removida permanentemente.")
        await loadQuests(debouncedQuestFilters)
      }
    } catch (err) {
      showError(err.message || "Erro ao remover item")
    } finally {
      setIsDeletingItem(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteModal) return
    await handleDeleteDirect(deleteModal.type, deleteModal.item)
    setDeleteModal(null)
  }

  function handleLogout() {
    clearAdminToken()
    navigate("/admin/login", { replace: true })
  }

  return (
    <div className="admin-page">
      <div className="admin-page__backdrop" />
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="admin-page__shell">
        <header className="admin-page__topbar">
          <div className="admin-page__topbar-main">
            <span className="admin-page__eyebrow">Admin</span>
            <h1 className="admin-page__title">Painel administrativo</h1>
            <p className="admin-page__subtitle">
              Gerencie apenas o que ainda existe no produto: templates de tasks e quests.
            </p>
          </div>

          <div className="admin-page__topbar-actions">
            <button
              type="button"
              className={ocrDebugEnabled ? "admin-page__ghost-button admin-page__ghost-button--success" : "admin-page__ghost-button admin-page__ghost-button--danger"}
              onClick={toggleOcrDebug}
              disabled={isLoadingOcrDebug || isSavingOcrDebug}
              title="Controla o debug OCR global do processamento de drops"
            >
              {isLoadingOcrDebug
                ? "Carregando OCR..."
                : isSavingOcrDebug
                  ? "Salvando OCR..."
                  : ocrDebugEnabled
                    ? "Debug OCR: Ligado"
                    : "Debug OCR: Desligado"}
            </button>
            <span className="admin-page__admin-badge">{adminName || "admin"}</span>
            <button type="button" className="admin-page__ghost-button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>

        <div className="admin-page__tabs">
          {[ ["tasks", "Tasks"], ["quests", "Quests"], ["aliases", "Itens OCR"], ["npc-prices", "Preços NPC"], ["pokemon", "Pokémon"], ["sidebar", "Sidebar"], ["ocr-debug", "Debug OCR"] ].map(([value, label]) => (
            <button key={value} type="button" className={activeTab === value ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"} onClick={() => setActiveTab(value)}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "tasks" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">Tasks</h2>
                <p className="admin-page__section-subtitle">Controle completo de templates de tasks do sistema.</p>
              </div>
              <button type="button" className="admin-page__primary-button" onClick={openCreateTask}>Nova task</button>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--tasks">
                <input className="admin-page__input" placeholder="Buscar por nome" value={taskFilters.search} onChange={(event) => setTaskFilters((prev) => ({ ...prev, search: event.target.value }))} />
                <select className="admin-page__input" value={taskFilters.task_type} onChange={(event) => setTaskFilters((prev) => ({ ...prev, task_type: event.target.value }))}>
                  {taskTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <select className="admin-page__input" value={taskFilters.continent} onChange={(event) => setTaskFilters((prev) => ({ ...prev, continent: event.target.value, city: "", nw_level: event.target.value === "nightmare_world" ? prev.nw_level : "" }))}>
                  {continents.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {taskFilters.continent === "nightmare_world" ? <input className="admin-page__input" type="number" min="1" max="999" placeholder="NW Level" value={taskFilters.nw_level} onChange={(event) => setTaskFilters((prev) => ({ ...prev, nw_level: event.target.value }))} /> : null}
                <select className="admin-page__input" value={taskFilters.city} onChange={(event) => setTaskFilters((prev) => ({ ...prev, city: event.target.value }))}>
                  {taskCityOptions.map((city) => (
                    <option key={city.value} value={city.value}>{city.label}</option>
                  ))}
                </select>
                <input className="admin-page__input" type="number" placeholder="Nível mín." value={taskFilters.min_level} onChange={(event) => setTaskFilters((prev) => ({ ...prev, min_level: event.target.value }))} />
                <input className="admin-page__input" type="number" placeholder="Nível máx." value={taskFilters.max_level} onChange={(event) => setTaskFilters((prev) => ({ ...prev, max_level: event.target.value }))} />
                <select className="admin-page__input" value={taskFilters.is_active} onChange={(event) => setTaskFilters((prev) => ({ ...prev, is_active: event.target.value }))}>
                  <option value="">Todos os status</option>
                  <option value="true">Ativas</option>
                  <option value="false">Inativas</option>
                </select>
              </div>
            </div>

            <div className="admin-page__stats-row">
              <span className="admin-page__stat">Total: {tasks.length}</span>
              <span className="admin-page__stat admin-page__stat--active">Ativas: {taskStats.active}</span>
              <span className="admin-page__stat admin-page__stat--inactive">Inativas: {taskStats.inactive}</span>
              {taskFilters.city && (
                <span className="admin-page__stat admin-page__stat--location">{formatCity(taskFilters.city)}: {taskStats.city}</span>
              )}
              {taskFilters.continent === "nightmare_world" && taskFilters.nw_level && (
                <span className="admin-page__stat admin-page__stat--location">Filtro NW ativo: {taskFilters.nw_level}</span>
              )}
            </div>

            <div className="admin-page__cards-grid">
              {isLoadingTasks ? <div className="admin-page__empty admin-page__empty--full">Carregando tasks...</div> : !filteredTasks.length ? <div className="admin-page__empty admin-page__empty--full">Nenhuma task encontrada.</div> : filteredTasks.map((task) => (
                <article key={task.id} className="admin-page__tile admin-page__tile--task">
                  <div className="admin-page__tile-main">
                    <div className="admin-page__tile-top">
                      <strong className="admin-page__tile-title">{task.name}</strong>
                    </div>
                    <p className="admin-page__tile-description">{task.description || "Sem descrição cadastrada."}</p>
                    <div className="admin-page__chip-row">
                      <span className="admin-page__chip">Tipo: {formatTaskType(task.task_type)}</span>
                      <span className="admin-page__chip">Continente: {formatContinent(task.continent)}</span>
                      <span className="admin-page__chip">Cidade: {formatCity(task.city) || "—"}</span>
                      <span className="admin-page__chip">Nível mín.: {task.min_level}</span>
                      {task.continent === "nightmare_world" && task.nw_level !== null && task.nw_level !== undefined ? <span className="admin-page__chip">NW Level: {task.nw_level}</span> : null}
                    </div>
                    <p className="admin-page__tile-reward">Recompensa: {task.reward_text || "—"}</p>
                  </div>
                  <div className="admin-page__tile-right">
                    <span className={task.is_active ? "admin-page__status admin-page__status--active admin-page__status--compact" : "admin-page__status admin-page__status--inactive admin-page__status--compact"}>{task.is_active ? "Ativa" : "Inativa"}</span>
                    <div className="admin-page__task-actions">
                      <button type="button" className="admin-page__icon-button" onClick={() => openEditTask(task)} title="Editar" aria-label="Editar task">✎</button>
                      <button type="button" className={task.is_active ? "admin-page__icon-button admin-page__icon-button--warning" : "admin-page__icon-button admin-page__icon-button--success"} onClick={() => toggleTaskActive(task.id)} disabled={isTogglingTaskId === task.id} title={task.is_active ? "Desativar" : "Ativar"} aria-label={task.is_active ? "Desativar task" : "Ativar task"}>{isTogglingTaskId === task.id ? "…" : "⏻"}</button>
                      <button type="button" className="admin-page__icon-button admin-page__icon-button--danger" onClick={() => openDeleteModal("task", task)} title="Remover" aria-label="Remover task">🗑</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeTab === "quests" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">Quests</h2>
                <p className="admin-page__section-subtitle">Controle completo de templates de quests do sistema.</p>
              </div>
              <button type="button" className="admin-page__primary-button" onClick={openCreateQuest}>Nova quest</button>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--quests">
                <input className="admin-page__input" placeholder="Buscar por nome" value={questFilters.search} onChange={(event) => setQuestFilters((prev) => ({ ...prev, search: event.target.value }))} />
                <select className="admin-page__input" value={questFilters.continent} onChange={(event) => setQuestFilters((prev) => ({ ...prev, continent: event.target.value, nw_level: event.target.value === "nightmare_world" ? prev.nw_level : "" }))}>
                  {continents.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {questFilters.continent === "nightmare_world" ? <input className="admin-page__input" type="number" min="1" max="999" placeholder="NW Level" value={questFilters.nw_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, nw_level: event.target.value }))} /> : null}
                <input className="admin-page__input" type="number" placeholder="Nível mín." value={questFilters.min_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, min_level: event.target.value }))} />
                <input className="admin-page__input" type="number" placeholder="Nível máx." value={questFilters.max_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, max_level: event.target.value }))} />
                <select className="admin-page__input" value={questFilters.is_active} onChange={(event) => setQuestFilters((prev) => ({ ...prev, is_active: event.target.value }))}>
                  <option value="">Todos os status</option>
                  <option value="true">Ativas</option>
                  <option value="false">Inativas</option>
                </select>
              </div>
            </div>

            <div className="admin-page__stats-row">
              <span className="admin-page__stat">Total: {quests.length}</span>
              <span className="admin-page__stat admin-page__stat--active">Ativas: {questStats.active}</span>
              <span className="admin-page__stat admin-page__stat--inactive">Inativas: {questStats.inactive}</span>
              {questFilters.continent && questStats.continent !== null && (
                <span className="admin-page__stat admin-page__stat--location">{formatContinent(questFilters.continent)}: {questStats.continent}</span>
              )}
              {questFilters.continent === "nightmare_world" && questFilters.nw_level && (
                <span className="admin-page__stat admin-page__stat--location">Filtro NW ativo: {questFilters.nw_level}</span>
              )}
            </div>

            <div className="admin-page__cards-grid">
              {isLoadingQuests ? <div className="admin-page__empty admin-page__empty--full">Carregando quests...</div> : !quests.length ? <div className="admin-page__empty admin-page__empty--full">Nenhuma quest encontrada.</div> : quests.map((quest) => (
                <article key={quest.id} className="admin-page__tile admin-page__tile--task">
                  <div className="admin-page__tile-main">
                    <div className="admin-page__tile-top">
                      <strong className="admin-page__tile-title">{quest.name}</strong>
                    </div>
                    <p className="admin-page__tile-description">{quest.description || "Sem descrição cadastrada."}</p>
                    <div className="admin-page__chip-row">
                      <span className="admin-page__chip">Continente: {formatContinent(quest.continent)}</span>
                      <span className="admin-page__chip">Nível mín.: {quest.min_level}</span>
                      {quest.continent === "nightmare_world" && quest.nw_level !== null && quest.nw_level !== undefined ? <span className="admin-page__chip">NW Level: {quest.nw_level}</span> : null}
                    </div>
                    <p className="admin-page__tile-reward">Recompensa: {quest.reward_text || "—"}</p>
                  </div>
                  <div className="admin-page__tile-right">
                    <span className={quest.is_active ? "admin-page__status admin-page__status--active admin-page__status--compact" : "admin-page__status admin-page__status--inactive admin-page__status--compact"}>{quest.is_active ? "Ativa" : "Inativa"}</span>
                    <div className="admin-page__task-actions">
                      <button type="button" className="admin-page__icon-button" onClick={() => openEditQuest(quest)} title="Editar" aria-label="Editar quest">✎</button>
                      <button type="button" className={quest.is_active ? "admin-page__icon-button admin-page__icon-button--warning" : "admin-page__icon-button admin-page__icon-button--success"} onClick={() => toggleQuestActive(quest.id)} disabled={isTogglingQuestId === quest.id} title={quest.is_active ? "Desativar" : "Ativar"} aria-label={quest.is_active ? "Desativar quest" : "Ativar quest"}>{isTogglingQuestId === quest.id ? "…" : "⏻"}</button>
                      <button type="button" className="admin-page__icon-button admin-page__icon-button--danger" onClick={() => openDeleteModal("quest", quest)} title="Remover" aria-label="Remover quest">🗑</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeTab === "aliases" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">Itens OCR</h2>
                <p className="admin-page__section-subtitle">
                  Leituras coletadas dos jogadores para mapear nomes incorretos para um nome canônico.
                </p>
              </div>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--aliases">
                <input
                  className="admin-page__input"
                  placeholder="Buscar leitura ou nome canônico"
                  value={aliasFilters.search}
                  onChange={(event) => setAliasFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
                <select
                  className="admin-page__input"
                  value={aliasFilters.status}
                  onChange={(event) => setAliasFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="pending">Pendentes</option>
                  <option value="approved">Aprovados</option>
                  <option value="all">Todos</option>
                </select>
              </div>
            </div>

            <div className="admin-page__cards-grid">
              {isLoadingAliases ? <div className="admin-page__empty admin-page__empty--full">Carregando aliases...</div> : !aliases.length ? <div className="admin-page__empty admin-page__empty--full">Nenhum alias encontrado.</div> : aliases.map((alias) => (
                <article key={alias.id} className="admin-page__tile">
                  <div className="admin-page__tile-main">
                    <div className="admin-page__tile-top">
                      <strong className="admin-page__tile-title">{alias.observed_name}</strong>
                      <span className={alias.is_approved ? "admin-page__status admin-page__status--active" : "admin-page__status admin-page__status--inactive"}>{alias.is_approved ? "Aprovado" : "Pendente"}</span>
                    </div>

                    <div className="admin-page__chip-row">
                      <span className="admin-page__chip">Normalizado: {alias.observed_name_normalized}</span>
                      <span className="admin-page__chip">Ocorrências: {alias.occurrences}</span>
                    </div>

                    <div className="admin-page__alias-input-row">
                      <input
                        className="admin-page__input"
                        value={aliasDrafts[alias.id] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value
                          setAliasDrafts((prev) => ({ ...prev, [alias.id]: value }))
                        }}
                        placeholder="Nome canônico correto"
                      />
                    </div>
                  </div>

                  <div className="admin-page__tile-actions admin-page__tile-actions--row">
                    <button
                      type="button"
                      className="admin-page__primary-button"
                      onClick={() => saveAlias(alias, true)}
                      disabled={Boolean(aliasSavingMap[alias.id])}
                    >
                      {aliasSavingMap[alias.id] ? "Salvando..." : "Aprovar alias"}
                    </button>

                    <button
                      type="button"
                      className="admin-page__ghost-button"
                      onClick={() => saveAlias(alias, false)}
                      disabled={Boolean(aliasSavingMap[alias.id])}
                    >
                      Salvar pendente
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeTab === "npc-prices" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">Preços NPC</h2>
                <p className="admin-page__section-subtitle">
                  Tabela oficial de preço NPC usada para montar os totais no OCR e sincronizar nomes canônicos dos aliases.
                </p>
              </div>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--npc-prices">
                <input
                  className="admin-page__input"
                  placeholder="Buscar item por nome"
                  value={npcPriceFilters.search}
                  onChange={(event) => setNpcPriceFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
              </div>
            </div>

            <div className="admin-page__cards-grid">
              {isLoadingNpcPrices ? <div className="admin-page__empty admin-page__empty--full">Carregando preços NPC...</div> : !npcPrices.length ? <div className="admin-page__empty admin-page__empty--full">Nenhum preço NPC encontrado.</div> : npcPrices.map((item) => (
                <article key={item.normalized_name} className="admin-page__tile">
                  <div className="admin-page__tile-main">
                    <div className="admin-page__tile-top">
                      <div className="admin-page__tile-title-row">
                        <strong className="admin-page__tile-title">{item.name}</strong>
                        {Array.isArray(item.related_aliases) && item.related_aliases.length ? (
                          <span
                            className="admin-page__info-badge"
                            title={`Aliases relacionadas:\n${item.related_aliases.join("\n")}`}
                            aria-label={`Aliases relacionadas: ${item.related_aliases.join(", ")}`}
                          >
                            i
                          </span>
                        ) : null}
                      </div>
                      <span className="admin-page__status admin-page__status--active">{item.unit_price}</span>
                    </div>

                    <div className="admin-page__chip-row">
                      <span className="admin-page__chip">Normalizado: {item.normalized_name}</span>
                      {Array.isArray(item.related_aliases) && item.related_aliases.length ? (
                        <span className="admin-page__chip">Aliases: {item.related_aliases.length}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-page__tile-actions">
                    <button type="button" className="admin-page__ghost-button" onClick={() => openEditNpcPrice(item)}>
                      Editar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeTab === "pokemon" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">Pokémon</h2>
                <p className="admin-page__section-subtitle">Gerencie a lista de Pokémon disponíveis nas hunts. Busque para filtrar e ajuste ID e nome separadamente.</p>
              </div>
              <button type="button" className="admin-page__primary-button" onClick={openCreatePokemon}>Novo Pokémon</button>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--npc-prices">
                <input
                  className="admin-page__input"
                  placeholder="Buscar por ID ou nome (ex: 0003, Venusaur, Shiny...)"
                  value={pokemonFilters.search}
                  onChange={(event) => setPokemonFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
              </div>
            </div>

            <div className="admin-page__pokemon-grid">
              {isLoadingPokemon ? (
                <div className="admin-page__empty admin-page__empty--full">Carregando Pokémon...</div>
              ) : !pokemon.length ? (
                <div className="admin-page__empty admin-page__empty--full">Nenhum Pokémon encontrado.</div>
              ) : pokemon.map((entry) => (
                <article key={entry.full_name} className="admin-page__pokemon-card">
                  <span className="admin-page__pokemon-dex">#{entry.dex_id}</span>
                  <span className="admin-page__pokemon-name">{entry.name}</span>
                  <div className="admin-page__pokemon-actions">
                    <button type="button" className="admin-page__ghost-button admin-page__ghost-button--sm" onClick={() => openEditPokemon(entry)}>Editar</button>
                    <button type="button" className="admin-page__danger-button admin-page__danger-button--sm" onClick={() => handleDeletePokemon(entry.full_name)} disabled={isDeletingPokemon}>✕</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeTab === "sidebar" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">Menus da Sidebar</h2>
                <p className="admin-page__section-subtitle">
                  Defina quais menus ficam ativos para os jogadores e marque os que estão em teste com o selo beta.
                </p>
              </div>
              <button type="button" className="admin-page__ghost-button" onClick={loadSidebarMenus}>
                Atualizar
              </button>
            </div>

            <div className="admin-page__cards-grid admin-page__cards-grid--sidebar">
              {isLoadingSidebarMenus ? <div className="admin-page__empty admin-page__empty--full">Carregando menus...</div> : !sidebarMenus.length ? <div className="admin-page__empty admin-page__empty--full">Nenhuma configuração de menu encontrada.</div> : sidebarMenus.map((menu) => {
                const isSaving = Boolean(savingSidebarMenuMap[menu.menu_key])
                return (
                  <article key={menu.menu_key} className="admin-page__tile admin-page__tile--sidebar-menu">
                    <div className="admin-page__tile-main">
                      <div className="admin-page__tile-top">
                        <strong className="admin-page__tile-title">{menu.label}</strong>
                        <span className={menu.is_enabled ? "admin-page__status admin-page__status--active" : "admin-page__status admin-page__status--inactive"}>
                          {menu.is_enabled ? "Ativo" : "Inativo"}
                        </span>
                      </div>

                      <div className="admin-page__chip-row">
                        <span className="admin-page__chip">Rota: {menu.path}</span>
                        {menu.is_beta ? <span className="admin-page__chip admin-page__chip--beta">Beta ativo</span> : null}
                      </div>
                    </div>

                    <div className="admin-page__tile-actions admin-page__tile-actions--row">
                      <button
                        type="button"
                        className={menu.is_enabled ? "admin-page__ghost-button admin-page__ghost-button--danger" : "admin-page__ghost-button admin-page__ghost-button--success"}
                        onClick={() => updateSidebarMenu(menu.menu_key, { is_enabled: !menu.is_enabled })}
                        disabled={isSaving}
                      >
                        {isSaving ? "Salvando..." : menu.is_enabled ? "Desativar (cadeado)" : "Ativar menu"}
                      </button>

                      <button
                        type="button"
                        className="admin-page__ghost-button"
                        onClick={() => updateSidebarMenu(menu.menu_key, { is_beta: !menu.is_beta })}
                        disabled={isSaving}
                      >
                        {isSaving ? "Salvando..." : menu.is_beta ? "Remover beta" : "Marcar como beta"}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">Gerenciamento de Debug OCR</h2>
                <p className="admin-page__section-subtitle">
                  Veja as sessões geradas pelo OCR, abra recortes/imagens e confira os textos extraídos.
                </p>
              </div>
              <button type="button" className="admin-page__ghost-button" onClick={loadOcrDebugSessions}>
                Atualizar sessões
              </button>
            </div>

            <div className="admin-page__cards-grid admin-page__cards-grid--debug">
              <article className="admin-page__tile admin-page__tile--debug">
                <div className="admin-page__tile-main">
                  <div className="admin-page__tile-top">
                    <strong className="admin-page__tile-title">Sessões</strong>
                  </div>
                  {isLoadingOcrDebugSessions ? (
                    <div className="admin-page__empty">Carregando sessões...</div>
                  ) : !ocrDebugSessions.length ? (
                    <div className="admin-page__empty">Nenhuma sessão de debug encontrada.</div>
                  ) : (
                    <div className="admin-page__debug-list">
                      {ocrDebugSessions.map((session) => (
                        <button
                          key={session.session_id}
                          type="button"
                          className={selectedOcrDebugSession === session.session_id ? "admin-page__debug-row admin-page__debug-row--active" : "admin-page__debug-row"}
                          onClick={() => loadOcrDebugFiles(session.session_id)}
                        >
                          <span className="admin-page__debug-row-title">{session.session_id}</span>
                          <span className="admin-page__debug-row-meta">Arquivos: {session.file_count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              <article className="admin-page__tile admin-page__tile--debug">
                <div className="admin-page__tile-main">
                  <div className="admin-page__tile-top">
                    <strong className="admin-page__tile-title">Arquivos</strong>
                  </div>
                  {isLoadingOcrDebugFiles ? (
                    <div className="admin-page__empty">Carregando arquivos...</div>
                  ) : !selectedOcrDebugSession ? (
                    <div className="admin-page__empty">Selecione uma sessão para ver os arquivos.</div>
                  ) : !ocrDebugFiles.length ? (
                    <div className="admin-page__empty">Nenhum arquivo encontrado na sessão.</div>
                  ) : (
                    <div className="admin-page__debug-list">
                      {ocrDebugFiles.map((file) => (
                        <div key={file.name} className="admin-page__debug-file-row">
                          <div className="admin-page__debug-file-meta">
                            <strong>{file.name}</strong>
                            <span>{file.kind} · {file.size_bytes} bytes</span>
                          </div>
                          <div className="admin-page__debug-file-actions">
                            {file.kind === "text" ? (
                              <button type="button" className="admin-page__ghost-button" onClick={() => openOcrDebugText(file.name)}>
                                Ver texto
                              </button>
                            ) : null}
                            <button type="button" className="admin-page__ghost-button" onClick={() => openOcrDebugFile(file.name)}>
                              Abrir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              <article className="admin-page__tile admin-page__tile--debug admin-page__tile--debug-wide">
                <div className="admin-page__tile-main">
                  <div className="admin-page__tile-top">
                    <strong className="admin-page__tile-title">Preview de texto</strong>
                    {ocrDebugPreviewTitle ? <span className="admin-page__chip">{ocrDebugPreviewTitle}</span> : null}
                  </div>
                  <pre className="admin-page__debug-text-preview">{ocrDebugTextPreview || "Abra um arquivo de texto para visualizar o conteúdo."}</pre>
                </div>
              </article>
            </div>
          </section>
        )}
      </div>

        {pokemonModal ? (
          <div className="character-modal-backdrop">
            <div className="character-modal">
              <h2 className="character-modal__title">{pokemonModal.type === "create" ? "Novo Pokémon" : "Editar Pokémon"}</h2>
              <form onSubmit={handleSubmitPokemon}>
                <div className="character-modal__field"><label>ID (ex: 0003)</label><input className="character-modal__input" value={pokemonForm.dex_id} onChange={(event) => setPokemonForm((prev) => ({ ...prev, dex_id: event.target.value }))} placeholder="0001" /></div>
                <div className="character-modal__field"><label>Nome (ex: Venusaur, Shiny Charizard, Mega Rayquaza)</label><input className="character-modal__input" value={pokemonForm.name} onChange={(event) => setPokemonForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Venusaur" /></div>
                <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setPokemonModal(null)} disabled={isSubmittingPokemon}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingPokemon}>{isSubmittingPokemon ? "Salvando..." : "Salvar"}</button></div>
              </form>
            </div>
          </div>
        ) : null}

        {taskModal ? (
          <div className="character-modal-backdrop">
            <div className="character-modal">
              <h2 className="character-modal__title">{taskModal.type === "create" ? "Nova task" : "Editar task"}</h2>
              <form onSubmit={handleSubmitTask}>
              <div className="character-modal__field"><label>Nome do NPC</label><input className="character-modal__input" value={taskForm.name} onChange={(event) => setTaskForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Descrição</label><input className="character-modal__input" value={taskForm.description} onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Tipo (selecione um ou mais)</label><div className="character-modal__checkboxes">{taskTypes.filter((item) => item.value).map((item) => <label key={item.value} className="character-modal__checkbox"><input type="checkbox" checked={taskForm.task_type.includes(item.value)} onChange={(event) => { if (!event.target.checked && taskForm.task_type.length === 1) { setToast({ type: "error", message: "Selecione ao menos um tipo de task" }); return; } setTaskForm((prev) => ({ ...prev, task_type: event.target.checked ? [...prev.task_type, item.value] : prev.task_type.filter((t) => t !== item.value) })); }} /><span>{item.label}</span></label>)}</div></div>
              <div className="character-modal__field"><label>Continente</label><select className="character-modal__input" value={taskForm.continent} onChange={(event) => setTaskForm((prev) => ({ ...prev, continent: event.target.value }))}>{continents.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div className="character-modal__field"><label>Nível mínimo</label><input className="character-modal__input" type="number" min="5" max="625" value={taskForm.min_level} onChange={(event) => setTaskForm((prev) => ({ ...prev, min_level: event.target.value }))} /></div>
              {taskForm.continent === "nightmare_world" ? <div className="character-modal__field"><label>Nightmare Level (NW Level)</label><input className="character-modal__input" type="number" min="1" max="999" value={taskForm.nw_level} onChange={(event) => setTaskForm((prev) => ({ ...prev, nw_level: event.target.value }))} /></div> : null}
              <div className="character-modal__field"><label>Recompensa</label><input className="character-modal__input" value={taskForm.reward_text} onChange={(event) => setTaskForm((prev) => ({ ...prev, reward_text: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Coordenada <span style={{color: "#999", fontSize: "0.85em"}}>(opcional)</span></label><input className="character-modal__input" placeholder="Ex: 100000,100000,100000 ou -5000,200,-150" value={taskForm.coordinate} onChange={(event) => setTaskForm((prev) => ({ ...prev, coordinate: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Cidade</label><input className="character-modal__input" value={taskForm.city} onChange={(event) => setTaskForm((prev) => ({ ...prev, city: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Ativa</label><select className="character-modal__input" value={String(taskForm.is_active)} onChange={(event) => setTaskForm((prev) => ({ ...prev, is_active: event.target.value === "true" }))}><option value="true">Sim</option><option value="false">Não</option></select></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setTaskModal(null)} disabled={isSubmittingTask}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingTask}>{isSubmittingTask ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {questModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal">
            <h2 className="character-modal__title">{questModal.type === "create" ? "Nova quest" : "Editar quest"}</h2>
            <form onSubmit={handleSubmitQuest}>
              <div className="character-modal__field"><label>Nome</label><input className="character-modal__input" value={questForm.name} onChange={(event) => setQuestForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Descrição</label><input className="character-modal__input" value={questForm.description} onChange={(event) => setQuestForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Continente</label><select className="character-modal__input" value={questForm.continent} onChange={(event) => setQuestForm((prev) => ({ ...prev, continent: event.target.value }))}>{continents.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div className="character-modal__field"><label>Nível mínimo</label><input className="character-modal__input" type="number" min="5" max="625" value={questForm.min_level} onChange={(event) => setQuestForm((prev) => ({ ...prev, min_level: event.target.value }))} /></div>
              {questForm.continent === "nightmare_world" ? <div className="character-modal__field"><label>Nightmare Level (NW Level)</label><input className="character-modal__input" type="number" min="1" max="999" value={questForm.nw_level} onChange={(event) => setQuestForm((prev) => ({ ...prev, nw_level: event.target.value }))} /></div> : null}
              <div className="character-modal__field"><label>Recompensa</label><input className="character-modal__input" value={questForm.reward_text} onChange={(event) => setQuestForm((prev) => ({ ...prev, reward_text: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Ativa</label><select className="character-modal__input" value={String(questForm.is_active)} onChange={(event) => setQuestForm((prev) => ({ ...prev, is_active: event.target.value === "true" }))}><option value="true">Sim</option><option value="false">Não</option></select></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setQuestModal(null)} disabled={isSubmittingQuest}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingQuest}>{isSubmittingQuest ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {npcPriceModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal">
            <h2 className="character-modal__title">Editar preço NPC</h2>
            <form onSubmit={handleSubmitNpcPrice}>
              <div className="character-modal__field"><label>Nome do item</label><input className="character-modal__input" value={npcPriceForm.name} onChange={(event) => setNpcPriceForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Preço unitário NPC</label><input className="character-modal__input" type="number" min="0" step="0.01" value={npcPriceForm.unit_price} onChange={(event) => setNpcPriceForm((prev) => ({ ...prev, unit_price: event.target.value }))} /></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setNpcPriceModal(null)} disabled={isSubmittingNpcPrice}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingNpcPrice}>{isSubmittingNpcPrice ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal character-modal--danger">
            <h2 className="character-modal__title">Remover {deleteModal.type === "task" ? "task" : "quest"}</h2>
            <p className="character-modal__description">Você está prestes a remover permanentemente <strong>{deleteModal.item.name}</strong>.</p>
            <div className="character-modal__notice-list">
              <div className="character-modal__notice character-modal__notice--warning">Essa ação apagará o item do sistema inteiro.</div>
              <div className="character-modal__notice character-modal__notice--warning">Ela não pode ser desfeita.</div>
            </div>
            <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={closeDeleteModal} disabled={isDeletingItem}>Cancelar</button><button type="button" className="character-modal__button character-modal__button--danger" onClick={handleDeleteConfirmed} disabled={isDeletingItem}>{isDeletingItem ? "Removendo..." : "Remover permanentemente"}</button></div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
