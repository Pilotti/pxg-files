import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@/lib/react-router-compat"
import { adminRequest, clearAdminToken, getAdminToken } from "../services/admin-api.js"
import { API_URL } from "../services/session-manager.js"
import { readAppPreferences } from "../services/app-preferences.js"
import ConfirmActionModal from "../components/confirm-action-modal.jsx"

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
  min_level: "",
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
  city: "",
  min_level: "",
  nw_level: "",
  reward_text: "",
  is_active: true,
}

const npcPriceInitialForm = {
  previous_name: "",
  name: "",
  unit_price: "0",
}

const consumableInitialForm = {
  previous_nome: "",
  nome: "",
  preco_npc: "0",
  categoria: "",
}

const TASK_PAGE_SIZE = 30
const NPC_PRICE_PAGE_SIZE = 30
const POKEMON_PAGE_SIZE = 30
const CONSUMABLE_PAGE_SIZE = 50

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
    throw new Error("Cada valor da coordenada deve ser inteiro vÃ¡lido")
  }

  const outOfRange = numbers.some((num) => num < -1000000 || num > 1000000)
  if (outOfRange) {
    throw new Error("Cada coordenada deve estar entre -1000000 e 1000000")
  }

  return `${numbers[0]},${numbers[1]},${numbers[2]}`
}

function normalizeMinLevelInput(value) {
  if (value === "" || value === null || value === undefined) {
    return 5
  }

  return Number(value)
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function extractObservedCandidatesFromOcrText(content) {
  const seen = new Set()
  const rows = []
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)

  const skipTokens = new Set([
    "item", "count", "value", "contagem", "valor", "total", "ganho", "pagina", "redefinir", "reset",
  ])

  for (const rawLine of lines) {
    let candidate = rawLine

    if (rawLine.includes("|")) {
      candidate = rawLine.split("|")[0].trim()
    }

    candidate = candidate
      .replace(/^[-*]\s*/, "")
      .replace(/^[0-9]+[\).:-]?\s*/, "")
      .replace(/\s+/g, " ")
      .trim()

    const normalized = candidate.toLowerCase()
    if (!candidate || candidate.length < 2) continue
    if (!/[a-zA-Z]/.test(candidate)) continue
    if (skipTokens.has(normalized)) continue
    if (/^(debug|strategy|rows_|session_id|warnings|elapsed_ms|processed_images)/i.test(candidate)) continue

    if (!seen.has(normalized)) {
      seen.add(normalized)
      rows.push({ id: `${rows.length}-${normalized}`, observed: candidate, canonical: candidate })
    }
  }

  return rows.slice(0, 120)
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
        âœ•
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
  const [taskPage, setTaskPage] = useState(1)
  const [taskTotal, setTaskTotal] = useState(0)
  const [taskTotalPages, setTaskTotalPages] = useState(1)
  const [quests, setQuests] = useState([])
  const [users, setUsers] = useState([])
  const [aliases, setAliases] = useState([])
  const [npcItemNames, setNpcItemNames] = useState([])
  const [npcPrices, setNpcPrices] = useState([])
  const [npcPricePage, setNpcPricePage] = useState(1)
  const [npcPriceTotal, setNpcPriceTotal] = useState(0)
  const [npcPriceTotalPages, setNpcPriceTotalPages] = useState(1)
  const [taskFilters, setTaskFilters] = useState({
    search: "",
    task_type: "",
    continent: "",
    nw_level: "",
    city: "",
    min_level: "",
    max_level: "",
    is_active: "",
  })
  const [questFilters, setQuestFilters] = useState({
    search: "",
    continent: "",
    city: "",
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
  const [consumables, setConsumables] = useState([])
  const [consumablePage, setConsumablePage] = useState(1)
  const [consumableTotal, setConsumableTotal] = useState(0)
  const [consumableTotalPages, setConsumableTotalPages] = useState(1)
  const [consumableFilters, setConsumableFilters] = useState({ search: "", category: "" })
  const [consumableCategories, setConsumableCategories] = useState([])
  const [consumableModal, setConsumableModal] = useState(null)
  const [consumableForm, setConsumableForm] = useState(consumableInitialForm)
  const [isLoadingConsumables, setIsLoadingConsumables] = useState(true)
  const [isSubmittingConsumable, setIsSubmittingConsumable] = useState(false)
  const [userFilters, setUserFilters] = useState({
    search: "",
  })
  const [pokemon, setPokemon] = useState([])
  const [pokemonPage, setPokemonPage] = useState(1)
  const [pokemonTotal, setPokemonTotal] = useState(0)
  const [pokemonTotalPages, setPokemonTotalPages] = useState(1)
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
  const debouncedUserFilters = useDebouncedValue(userFilters, 250)
  const debouncedPokemonFilters = useDebouncedValue(pokemonFilters, 250)
  const debouncedConsumableFilters = useDebouncedValue(consumableFilters, 250)
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
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [deletingUserId, setDeletingUserId] = useState(null)
  const [userDeleteModal, setUserDeleteModal] = useState(null)
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
  const [manualOcrFiles, setManualOcrFiles] = useState([])
  const [isUploadingManualOcr, setIsUploadingManualOcr] = useState(false)
  const [selectedOcrDebugSession, setSelectedOcrDebugSession] = useState("")
  const [ocrDebugFiles, setOcrDebugFiles] = useState([])
  const [isLoadingOcrDebugFiles, setIsLoadingOcrDebugFiles] = useState(false)
  const [ocrDebugTextPreview, setOcrDebugTextPreview] = useState("")
  const [ocrDebugPreviewTitle, setOcrDebugPreviewTitle] = useState("")
  const [ocrDebugImagePreviewUrl, setOcrDebugImagePreviewUrl] = useState("")
  const [ocrDebugImagePreviewTitle, setOcrDebugImagePreviewTitle] = useState("")
  const [ocrTrainingRows, setOcrTrainingRows] = useState([])
  const [isSavingManualAlias, setIsSavingManualAlias] = useState(false)
  const [trainingSavingMap, setTrainingSavingMap] = useState({})
  const [isClearingOcrDebug, setIsClearingOcrDebug] = useState(false)
  const [deletingOcrDebugSessionId, setDeletingOcrDebugSessionId] = useState("")
  const [deletingOcrDebugFileName, setDeletingOcrDebugFileName] = useState("")
  const [aliasDrafts, setAliasDrafts] = useState({})
  const [aliasSavingMap, setAliasSavingMap] = useState({})
  const [toast, setToast] = useState(null)
  const taskRequestControllerRef = useRef(null)
  const didBootstrapAdminRef = useRef(false)

  const taskCityOptions = useMemo(() => {
    const filteredByContinent = taskFilters.continent
      ? tasks.filter((task) => task.continent === taskFilters.continent)
      : tasks

    const citySet = new Set(
      filteredByContinent
        .map((task) => String(task.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [tasks, taskFilters.continent])

  const questCityOptions = useMemo(() => {
    const filteredByContinent = questFilters.continent
      ? quests.filter((quest) => quest.continent === questFilters.continent)
      : quests

    const citySet = new Set(
      filteredByContinent
        .map((quest) => String(quest.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase())
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [quests, questFilters.continent])

  const taskStats = useMemo(() => ({
    active: tasks.filter((t) => t.is_active).length,
    inactive: tasks.filter((t) => !t.is_active).length,
    city: taskFilters.city
      ? tasks.filter((t) => String(t.city || "").trim().toLowerCase() === taskFilters.city).length
      : null,
  }), [tasks, taskFilters.city])

  const questStats = useMemo(() => ({
    active: quests.filter((q) => q.is_active).length,
    inactive: quests.filter((q) => !q.is_active).length,
    continent: questFilters.continent ? quests.filter((q) => q.continent === questFilters.continent).length : null,
    city: questFilters.city
      ? quests.filter((q) => String(q.city || "").trim().toLowerCase() === questFilters.city).length
      : null,
  }), [quests, questFilters.continent, questFilters.city])

  useEffect(() => {
    if (didBootstrapAdminRef.current) return
    didBootstrapAdminRef.current = true

    if (!getAdminToken()) {
      navigate("/admin/login", { replace: true })
      return
    }

    loadAdminMe()
  }, [])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "tasks") return
    loadTasks(debouncedTaskFilters, taskPage)
  }, [activeTab, debouncedTaskFilters, taskPage])

  useEffect(() => () => {
    taskRequestControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "quests") return
    loadQuests(debouncedQuestFilters)
  }, [activeTab, debouncedQuestFilters])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "aliases") return
    loadAliases(debouncedAliasFilters)
    if (npcItemNames.length === 0) {
      adminRequest("/admin/hunt-npc-prices/names")
        .then((names) => setNpcItemNames(Array.isArray(names) ? names : []))
        .catch(() => {})
    }
  }, [activeTab, debouncedAliasFilters])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "npc-prices") return
    loadNpcPrices(debouncedNpcPriceFilters, npcPricePage)
  }, [activeTab, debouncedNpcPriceFilters, npcPricePage])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "users") return
    loadUsers(debouncedUserFilters)
  }, [activeTab, debouncedUserFilters])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "pokemon") return
    loadPokemon(debouncedPokemonFilters, pokemonPage)
  }, [activeTab, debouncedPokemonFilters, pokemonPage])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "sidebar") return
    loadSidebarMenus()
  }, [activeTab])

  useEffect(() => {
    if (!getAdminToken() || activeTab !== "consumables") return
    loadConsumables(debouncedConsumableFilters, consumablePage)
  }, [activeTab, debouncedConsumableFilters, consumablePage])

  useEffect(() => {
    if (!toast) return

    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    return () => {
      if (ocrDebugImagePreviewUrl) {
        URL.revokeObjectURL(ocrDebugImagePreviewUrl)
      }
    }
  }, [ocrDebugImagePreviewUrl])

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
      showError(err.message || "Erro ao carregar configuraÃ§Ã£o do OCR")
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
      showError(err.message || "Erro ao carregar sessÃµes de debug OCR")
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
    if (ocrDebugImagePreviewUrl) {
      URL.revokeObjectURL(ocrDebugImagePreviewUrl)
    }
    setOcrDebugImagePreviewUrl("")
    setOcrDebugImagePreviewTitle("")
    setOcrTrainingRows([])
    try {
      const files = await adminRequest(`/admin/ocr-debug/sessions/${encodeURIComponent(sessionId)}/files`)
      setOcrDebugFiles(files)

      const textFiles = files.filter((item) => item.kind === "text")
      const preferredTextFile =
        textFiles.find((item) => item.name.includes("manual_training_parsed")) ||
        textFiles.find((item) => item.name.includes("parsed_lines_column_mode")) ||
        textFiles.find((item) => item.name.includes("fallback_raw_text")) ||
        textFiles[0]

      if (preferredTextFile) {
        await openOcrDebugText(preferredTextFile.name)
      }
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
      const content = String(data?.content || "")
      setOcrDebugTextPreview(content)
      setOcrTrainingRows(extractObservedCandidatesFromOcrText(content))
    } catch (err) {
      showError(err.message || "Erro ao abrir preview de texto")
    }
  }

  async function openOcrDebugFile(fileName) {
    if (!selectedOcrDebugSession || !fileName) return

    const token = getAdminToken()
    if (!token) {
      showError("SessÃ£o admin expirada.")
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
        throw new Error("NÃ£o foi possÃ­vel abrir o arquivo de debug.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, "_blank", "noopener,noreferrer")
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
    } catch (err) {
      showError(err.message || "Erro ao abrir arquivo de debug")
    }
  }

  async function previewOcrDebugImage(fileName) {
    if (!selectedOcrDebugSession || !fileName) return

    const token = getAdminToken()
    if (!token) {
      showError("SessÃ£o admin expirada.")
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
        throw new Error("NÃ£o foi possÃ­vel abrir a imagem de debug.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      if (ocrDebugImagePreviewUrl) {
        URL.revokeObjectURL(ocrDebugImagePreviewUrl)
      }
      setOcrDebugImagePreviewUrl(objectUrl)
      setOcrDebugImagePreviewTitle(fileName)
    } catch (err) {
      showError(err.message || "Erro ao visualizar imagem de debug")
    }
  }

  async function saveManualAliasTraining(index) {
    const row = ocrTrainingRows[index]
    if (!row) return

    const observedName = String(row.observed || "").trim()
    const canonicalName = String(row.canonical || "").trim()

    if (!observedName || !canonicalName) {
      showError("Preencha leitura OCR e nome canÃ´nico para salvar o treino.")
      return
    }

    setTrainingSavingMap((prev) => ({ ...prev, [index]: true }))
    try {
      await adminRequest("/admin/hunt-item-aliases/manual", {
        method: "POST",
        body: JSON.stringify({
          observed_name: observedName,
          canonical_name: canonicalName,
        }),
      })
      showSuccess(`Alias salva: ${observedName} -> ${canonicalName}`)
    } catch (err) {
      showError(err.message || "Erro ao salvar treino OCR")
    } finally {
      setTrainingSavingMap((prev) => {
        const next = { ...prev }
        delete next[index]
        return next
      })
    }
  }

  async function saveAllManualAliasTraining() {
    if (!ocrTrainingRows.length || isSavingManualAlias) return

    setIsSavingManualAlias(true)
    let saved = 0
    try {
      for (let index = 0; index < ocrTrainingRows.length; index += 1) {
        const row = ocrTrainingRows[index]
        const observedName = String(row.observed || "").trim()
        const canonicalName = String(row.canonical || "").trim()
        if (!observedName || !canonicalName) continue

        await adminRequest("/admin/hunt-item-aliases/manual", {
          method: "POST",
          body: JSON.stringify({
            observed_name: observedName,
            canonical_name: canonicalName,
          }),
        })
        saved += 1
      }
      showSuccess(`Treino OCR salvo em lote (${saved} alias).`)
      if (activeTab === "aliases") {
        await loadAliases(debouncedAliasFilters)
      }
    } catch (err) {
      showError(err.message || "Erro ao salvar treino OCR em lote")
    } finally {
      setIsSavingManualAlias(false)
    }
  }

  async function handleDeleteOcrDebugFile(fileName) {
    if (!selectedOcrDebugSession || !fileName || deletingOcrDebugFileName) return

    const confirmed = window.confirm(`Excluir o arquivo ${fileName}?`)
    if (!confirmed) return

    setDeletingOcrDebugFileName(fileName)
    try {
      await adminRequest(`/admin/ocr-debug/sessions/${encodeURIComponent(selectedOcrDebugSession)}/files/${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      })
      showSuccess("Arquivo de debug removido.")

      if (ocrDebugPreviewTitle === fileName) {
        setOcrDebugPreviewTitle("")
        setOcrDebugTextPreview("")
        setOcrTrainingRows([])
      }
      if (ocrDebugImagePreviewTitle === fileName) {
        if (ocrDebugImagePreviewUrl) {
          URL.revokeObjectURL(ocrDebugImagePreviewUrl)
        }
        setOcrDebugImagePreviewTitle("")
        setOcrDebugImagePreviewUrl("")
      }

      await loadOcrDebugFiles(selectedOcrDebugSession)
      await loadOcrDebugSessions()
    } catch (err) {
      showError(err.message || "Erro ao remover arquivo de debug")
    } finally {
      setDeletingOcrDebugFileName("")
    }
  }

  async function handleDeleteOcrDebugSession(sessionId) {
    if (!sessionId || deletingOcrDebugSessionId) return

    const confirmed = window.confirm(`Excluir toda a sessÃ£o ${sessionId}?`)
    if (!confirmed) return

    setDeletingOcrDebugSessionId(sessionId)
    try {
      await adminRequest(`/admin/ocr-debug/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      })
      showSuccess("SessÃ£o de debug removida.")

      if (selectedOcrDebugSession === sessionId) {
        setSelectedOcrDebugSession("")
        setOcrDebugFiles([])
        setOcrDebugPreviewTitle("")
        setOcrDebugTextPreview("")
        setOcrTrainingRows([])
        if (ocrDebugImagePreviewUrl) {
          URL.revokeObjectURL(ocrDebugImagePreviewUrl)
        }
        setOcrDebugImagePreviewTitle("")
        setOcrDebugImagePreviewUrl("")
      }

      await loadOcrDebugSessions()
    } catch (err) {
      showError(err.message || "Erro ao remover sessÃ£o de debug")
    } finally {
      setDeletingOcrDebugSessionId("")
    }
  }

  async function handleClearAllOcrDebugSessions() {
    if (isClearingOcrDebug) return

    const confirmed = window.confirm("Excluir todas as sessÃµes de debug OCR?")
    if (!confirmed) return

    setIsClearingOcrDebug(true)
    try {
      await adminRequest("/admin/ocr-debug/sessions", { method: "DELETE" })
      showSuccess("SessÃµes de debug removidas.")
      setSelectedOcrDebugSession("")
      setOcrDebugFiles([])
      setOcrDebugPreviewTitle("")
      setOcrDebugTextPreview("")
      setOcrTrainingRows([])
      if (ocrDebugImagePreviewUrl) {
        URL.revokeObjectURL(ocrDebugImagePreviewUrl)
      }
      setOcrDebugImagePreviewTitle("")
      setOcrDebugImagePreviewUrl("")
      await loadOcrDebugSessions()
    } catch (err) {
      showError(err.message || "Erro ao limpar sessÃµes de debug")
    } finally {
      setIsClearingOcrDebug(false)
    }
  }

  function handleSelectManualOcrFiles(event) {
    const files = Array.from(event.target.files || [])
    setManualOcrFiles(files)
  }

  async function handleUploadManualOcrFiles() {
    if (!manualOcrFiles.length || isUploadingManualOcr) return

    const token = getAdminToken()
    if (!token) {
      showError("SessÃ£o admin expirada.")
      return
    }

    setIsUploadingManualOcr(true)
    try {
      const formData = new FormData()
      for (const file of manualOcrFiles) {
        formData.append("files", file)
      }

      const response = await fetch(`${API_URL}/admin/ocr-debug/manual-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.detail || "NÃ£o foi possÃ­vel enviar imagens para treino manual OCR.")
      }

      showSuccess("Imagens enviadas para treino OCR manual.")
      setManualOcrFiles([])
      await loadOcrDebugSessions()
      if (payload?.session_id) {
        await loadOcrDebugFiles(payload.session_id)
      }
    } catch (err) {
      showError(err.message || "Erro ao enviar treino OCR manual")
    } finally {
      setIsUploadingManualOcr(false)
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

  function updateTaskFilters(updater) {
    setTaskPage(1)
    setTaskFilters((prev) => {
      if (typeof updater === "function") {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
  }

  async function loadTasks(nextFilters = taskFilters, nextPage = taskPage) {
    taskRequestControllerRef.current?.abort()
    const controller = new AbortController()
    taskRequestControllerRef.current = controller

    setIsLoadingTasks(true)
    try {
      const response = await adminRequest(
        `/admin/tasks${buildQuery({ ...nextFilters, page: nextPage, page_size: TASK_PAGE_SIZE })}`,
        { signal: controller.signal },
      )

      const items = Array.isArray(response?.items) ? response.items : []
      const total = Number(response?.total ?? items.length)
      const totalPages = Math.max(1, Number(response?.total_pages ?? 1))

      setTasks(items)
      setTaskTotal(total)
      setTaskTotalPages(totalPages)

      if (nextPage > totalPages) {
        setTaskPage(totalPages)
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return
      }
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

  function updateNpcPriceFilters(updater) {
    setNpcPricePage(1)
    setNpcPriceFilters((prev) => {
      if (typeof updater === "function") {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
  }

  function updateConsumableFilters(updater) {
    setConsumablePage(1)
    setConsumableFilters((prev) => {
      if (typeof updater === "function") return updater(prev)
      return { ...prev, ...updater }
    })
  }

  async function loadConsumables(nextFilters = consumableFilters, nextPage = consumablePage) {
    setIsLoadingConsumables(true)
    try {
      const response = await adminRequest(
        `/admin/consumables${buildQuery({ ...nextFilters, page: nextPage, page_size: CONSUMABLE_PAGE_SIZE })}`,
      )
      const items = Array.isArray(response?.items) ? response.items : []
      const categories = Array.isArray(response?.available_categories) ? response.available_categories : []
      const total = Number(response?.total ?? items.length)
      const totalPages = Math.max(1, Number(response?.total_pages ?? 1))
      setConsumables(items)
      setConsumableCategories(categories)
      setConsumableTotal(total)
      setConsumableTotalPages(totalPages)
      if (nextPage > totalPages) setConsumablePage(totalPages)
    } catch (err) {
      showError(err.message || "Erro ao carregar consumÃ­veis")
    } finally {
      setIsLoadingConsumables(false)
    }
  }

  function openCreateConsumable() {
    setConsumableForm(consumableInitialForm)
    setConsumableModal({ type: "create" })
  }

  function openEditConsumable(item) {
    setConsumableForm({
      previous_nome: item.nome,
      nome: item.nome,
      preco_npc: String(item.preco_npc ?? 0),
      categoria: item.categoria ?? "",
    })
    setConsumableModal({ type: "edit", item })
  }

  async function handleSubmitConsumable(event) {
    event.preventDefault()
    setIsSubmittingConsumable(true)
    try {
      if (consumableModal?.type === "create") {
        await adminRequest("/admin/consumables", {
          method: "POST",
          body: JSON.stringify({
            nome: consumableForm.nome,
            preco_npc: Number(String(consumableForm.preco_npc).replace(",", ".") || 0),
            categoria: consumableForm.categoria,
          }),
        })
        showSuccess("ConsumÃ­vel criado com sucesso.")
      } else {
        await adminRequest("/admin/consumables", {
          method: "PUT",
          body: JSON.stringify({
            previous_nome: consumableForm.previous_nome,
            nome: consumableForm.nome,
            preco_npc: Number(String(consumableForm.preco_npc).replace(",", ".") || 0),
            categoria: consumableForm.categoria,
          }),
        })
        showSuccess("ConsumÃ­vel atualizado com sucesso.")
      }
      setConsumableModal(null)
      await loadConsumables(debouncedConsumableFilters)
    } catch (err) {
      showError(err.message || "Erro ao salvar consumÃ­vel")
    } finally {
      setIsSubmittingConsumable(false)
    }
  }

  async function handleDeleteConsumable(nome) {
    try {
      await adminRequest(`/admin/consumables/${encodeURIComponent(nome)}`, { method: "DELETE" })
      showSuccess("ConsumÃ­vel removido com sucesso.")
      await loadConsumables(debouncedConsumableFilters)
    } catch (err) {
      showError(err.message || "Erro ao remover consumÃ­vel")
    }
  }

  async function loadNpcPrices(nextFilters = npcPriceFilters, nextPage = npcPricePage) {
    setIsLoadingNpcPrices(true)
    try {
      const response = await adminRequest(
        `/admin/hunt-npc-prices${buildQuery({ ...nextFilters, page: nextPage, page_size: NPC_PRICE_PAGE_SIZE })}`,
      )
      const items = Array.isArray(response?.items) ? response.items : []
      const total = Number(response?.total ?? items.length)
      const totalPages = Math.max(1, Number(response?.total_pages ?? 1))

      setNpcPrices(items)
      setNpcPriceTotal(total)
      setNpcPriceTotalPages(totalPages)

      if (nextPage > totalPages) {
        setNpcPricePage(totalPages)
      }
    } catch (err) {
      showError(err.message || "Erro ao carregar preÃ§os NPC")
    } finally {
      setIsLoadingNpcPrices(false)
    }
  }

  async function loadUsers(nextFilters = userFilters) {
    setIsLoadingUsers(true)
    try {
      setUsers(await adminRequest(`/admin/users${buildQuery(nextFilters)}`))
    } catch (err) {
      showError(err.message || "Erro ao carregar usuÃ¡rios")
    } finally {
      setIsLoadingUsers(false)
    }
  }

  function openUserDeleteModal(userId, username) {
    if (!userId || deletingUserId) return
    setUserDeleteModal({ userId, username })
  }

  async function handleDeleteUserConfirmed() {
    if (!userDeleteModal?.userId || deletingUserId) return

    const userId = userDeleteModal.userId
    setDeletingUserId(userId)
    try {
      await adminRequest(`/admin/users/${userId}`, { method: "DELETE" })
      showSuccess("UsuÃ¡rio removido com sucesso.")
      setUserDeleteModal(null)
      await loadUsers(debouncedUserFilters)
    } catch (err) {
      showError(err.message || "Erro ao remover usuÃ¡rio")
    } finally {
      setDeletingUserId(null)
    }
  }

  async function loadSidebarMenus() {
    setIsLoadingSidebarMenus(true)
    try {
      setSidebarMenus(await adminRequest("/admin/sidebar-menus"))
    } catch (err) {
      showError(err.message || "Erro ao carregar configuraÃ§Ã£o da sidebar")
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
      showSuccess("ConfiguraÃ§Ã£o do menu atualizada.")
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

    function updatePokemonFilters(updater) {
      setPokemonPage(1)
      setPokemonFilters((prev) => {
        if (typeof updater === "function") {
          return updater(prev)
        }
        return { ...prev, ...updater }
      })
    }

    async function loadPokemon(nextFilters = pokemonFilters, nextPage = pokemonPage) {
      setIsLoadingPokemon(true)
      try {
        const response = await adminRequest(
          `/admin/pokemon${buildQuery({ ...nextFilters, page: nextPage, page_size: POKEMON_PAGE_SIZE })}`,
        )
        const items = Array.isArray(response?.items) ? response.items : []
        const total = Number(response?.total ?? items.length)
        const totalPages = Math.max(1, Number(response?.total_pages ?? 1))

        setPokemon(items)
        setPokemonTotal(total)
        setPokemonTotalPages(totalPages)

        if (nextPage > totalPages) {
          setPokemonPage(totalPages)
        }
      } catch (err) {
        showError(err.message || "Erro ao carregar PokÃ©mon")
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
          showSuccess("PokÃ©mon adicionado com sucesso.")
        } else {
          await adminRequest("/admin/pokemon", {
            method: "PUT",
            body: JSON.stringify({
              original_full_name: pokemonModal.original_full_name,
              dex_id: pokemonForm.dex_id.trim(),
              name: pokemonForm.name.trim(),
            }),
          })
          showSuccess("PokÃ©mon atualizado com sucesso.")
        }
        setPokemonModal(null)
        await loadPokemon(debouncedPokemonFilters)
      } catch (err) {
        showError(err.message || "Erro ao salvar PokÃ©mon")
      } finally {
        setIsSubmittingPokemon(false)
      }
    }

    async function handleDeletePokemon(fullName) {
      if (isDeletingPokemon) return
      setIsDeletingPokemon(true)
      try {
        await adminRequest(`/admin/pokemon?full_name=${encodeURIComponent(fullName)}`, { method: "DELETE" })
        showSuccess("PokÃ©mon removido.")
        await loadPokemon(debouncedPokemonFilters)
      } catch (err) {
        showError(err.message || "Erro ao remover PokÃ©mon")
      } finally {
        setIsDeletingPokemon(false)
      }
    }

  async function saveAlias(alias, shouldApprove = true) {
    const rawCanonical = aliasDrafts[alias.id] ?? alias.canonical_name ?? alias.observed_name
    const canonicalName = String(rawCanonical || "").trim()

    if (!canonicalName) {
      showError("Informe um nome canÃ´nico antes de salvar o alias.")
      return
    }

    if (shouldApprove && npcItemNames.length > 0 && !npcItemNames.includes(canonicalName)) {
      showError(`"${canonicalName}" nÃ£o estÃ¡ na lista de itens NPC. Escolha um nome da lista para aprovar.`)
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
    setNpcPriceModal({ type: "edit", item })
  }

  function openCreateNpcPrice() {
    setNpcPriceForm(npcPriceInitialForm)
    setNpcPriceModal({ type: "create" })
  }

  async function handleSubmitNpcPrice(event) {
    event.preventDefault()
    setIsSubmittingNpcPrice(true)

    try {
      if (npcPriceModal?.type === "create") {
        await adminRequest("/admin/hunt-npc-prices", {
          method: "POST",
          body: JSON.stringify({
            name: npcPriceForm.name,
            unit_price: Number(String(npcPriceForm.unit_price).replace(",", ".") || 0),
          }),
        })
        showSuccess("Item NPC criado com sucesso.")
      } else {
        await adminRequest("/admin/hunt-npc-prices", {
          method: "PUT",
          body: JSON.stringify({
            previous_name: npcPriceForm.previous_name,
            name: npcPriceForm.name,
            unit_price: Number(String(npcPriceForm.unit_price).replace(",", ".") || 0),
          }),
        })
        showSuccess("PreÃ§o NPC atualizado com sucesso.")
      }
      setNpcPriceModal(null)
      await loadNpcPrices(debouncedNpcPriceFilters)
      await loadAliases(debouncedAliasFilters)
    } catch (err) {
      showError(err.message || "Erro ao atualizar preÃ§o NPC")
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
      city: quest.city || "",
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
        throw new Error("Cidade Ã© obrigatÃ³ria para salvar a task.")
      }
      if (!String(taskForm.description || "").trim()) {
        throw new Error("DescriÃ§Ã£o Ã© obrigatÃ³ria para salvar a task.")
      }
      if (!taskForm.task_type || taskForm.task_type.length === 0) {
        throw new Error("Selecione ao menos um tipo de task.")
      }
      if (!String(taskForm.reward_text || "").trim()) {
        throw new Error("Recompensa Ã© obrigatÃ³ria para salvar a task.")
      }
      if (taskForm.continent === "nightmare_world" && !String(taskForm.nw_level || "").trim()) {
        throw new Error("NW Level Ã© obrigatÃ³rio para tasks em Nightmare World.")
      }
      const normalizedCoordinate = taskForm.coordinate ? normalizeCoordinateInput(taskForm.coordinate) : null
      const payload = {
        ...taskForm,
        coordinate: normalizedCoordinate,
        min_level: normalizeMinLevelInput(taskForm.min_level),
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
      if (!String(questForm.city || "").trim()) {
        throw new Error("Cidade Ã© obrigatÃ³ria para salvar a quest.")
      }
      if (questForm.continent === "nightmare_world" && !String(questForm.nw_level || "").trim()) {
        throw new Error("NW Level Ã© obrigatÃ³rio para quests em Nightmare World.")
      }

      const payload = {
        ...questForm,
        min_level: normalizeMinLevelInput(questForm.min_level),
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
            <span className="admin-page__admin-badge">{adminName || "admin"}</span>
            <button type="button" className="admin-page__ghost-button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>

        <div className="admin-page__tabs">
          {[ ["tasks", "Tasks"], ["quests", "Quests"], ["aliases", "Itens OCR"], ["npc-prices", "PreÃ§os NPC"], ["consumables", "ConsumÃ­veis"], ["users", "UsuÃ¡rios"], ["pokemon", "PokÃ©mon"], ["sidebar", "Sidebar"] ].map(([value, label]) => (
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
                <input className="admin-page__input" placeholder="Buscar por nome" value={taskFilters.search} onChange={(event) => updateTaskFilters({ search: event.target.value })} />
                <select className="admin-page__input" value={taskFilters.task_type} onChange={(event) => updateTaskFilters({ task_type: event.target.value })}>
                  {taskTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <select className="admin-page__input" value={taskFilters.continent} onChange={(event) => updateTaskFilters((prev) => ({ ...prev, continent: event.target.value, city: "", nw_level: event.target.value === "nightmare_world" ? prev.nw_level : "" }))}>
                  {continents.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {taskFilters.continent === "nightmare_world" ? <input className="admin-page__input" type="number" min="1" max="999" placeholder="NW Level" value={taskFilters.nw_level} onChange={(event) => updateTaskFilters({ nw_level: event.target.value })} /> : null}
                <select className="admin-page__input" value={taskFilters.city} onChange={(event) => updateTaskFilters({ city: event.target.value })}>
                  <option value="">Todas as cidades</option>
                  {taskCityOptions.map((city) => (
                    <option key={city.value} value={city.value}>{city.label}</option>
                  ))}
                </select>
                <input className="admin-page__input" type="number" placeholder="NÃ­vel mÃ­n." value={taskFilters.min_level} onChange={(event) => updateTaskFilters({ min_level: event.target.value })} />
                <input className="admin-page__input" type="number" placeholder="NÃ­vel mÃ¡x." value={taskFilters.max_level} onChange={(event) => updateTaskFilters({ max_level: event.target.value })} />
                <select className="admin-page__input" value={taskFilters.is_active} onChange={(event) => updateTaskFilters({ is_active: event.target.value })}>
                  <option value="">Todos os status</option>
                  <option value="true">Ativas</option>
                  <option value="false">Inativas</option>
                </select>
              </div>
            </div>

            <div className="admin-page__stats-row">
              <span className="admin-page__stat">Total filtrado: {taskTotal}</span>
              <span className="admin-page__stat">PÃ¡gina: {taskPage} / {taskTotalPages}</span>
              <span className="admin-page__stat">Na pÃ¡gina: {tasks.length}</span>
              <span className="admin-page__stat admin-page__stat--active">Ativas (pÃ¡gina): {taskStats.active}</span>
              <span className="admin-page__stat admin-page__stat--inactive">Inativas (pÃ¡gina): {taskStats.inactive}</span>
              {taskFilters.city && (
                <span className="admin-page__stat admin-page__stat--location">{formatCity(taskFilters.city)}: {taskStats.city}</span>
              )}
              {taskFilters.continent === "nightmare_world" && taskFilters.nw_level && (
                <span className="admin-page__stat admin-page__stat--location">Filtro NW ativo: {taskFilters.nw_level}</span>
              )}
            </div>

            <div className="admin-page__pagination">
              <button type="button" className="admin-page__ghost-button" onClick={() => setTaskPage((prev) => Math.max(1, prev - 1))} disabled={isLoadingTasks || taskPage <= 1}>Anterior</button>
              <button type="button" className="admin-page__ghost-button" onClick={() => setTaskPage((prev) => Math.min(taskTotalPages, prev + 1))} disabled={isLoadingTasks || taskPage >= taskTotalPages}>PrÃ³xima</button>
            </div>

            <div className="admin-page__cards-grid">
              {isLoadingTasks ? <div className="admin-page__empty admin-page__empty--full">Carregando tasks...</div> : !tasks.length ? <div className="admin-page__empty admin-page__empty--full">Nenhuma task encontrada.</div> : tasks.map((task) => (
                <article key={task.id} className="admin-page__tile admin-page__tile--task">
                  <div className="admin-page__tile-main">
                    <div className="admin-page__tile-top">
                      <strong className="admin-page__tile-title">{task.name}</strong>
                    </div>
                    <p className="admin-page__tile-description">{task.description || "Sem descriÃ§Ã£o cadastrada."}</p>
                    <div className="admin-page__chip-row">
                      <span className="admin-page__chip">Tipo: {formatTaskType(task.task_type)}</span>
                      <span className="admin-page__chip">Continente: {formatContinent(task.continent)}</span>
                      <span className="admin-page__chip">Cidade: {formatCity(task.city) || "â€”"}</span>
                      <span className="admin-page__chip">NÃ­vel mÃ­n.: {task.min_level}</span>
                      {task.continent === "nightmare_world" && task.nw_level !== null && task.nw_level !== undefined ? <span className="admin-page__chip">NW Level: {task.nw_level}</span> : null}
                    </div>
                    <p className="admin-page__tile-reward">Recompensa: {task.reward_text || "â€”"}</p>
                  </div>
                  <div className="admin-page__tile-right">
                    <span className={task.is_active ? "admin-page__status admin-page__status--active admin-page__status--compact" : "admin-page__status admin-page__status--inactive admin-page__status--compact"}>{task.is_active ? "Ativa" : "Inativa"}</span>
                    <div className="admin-page__task-actions">
                      <button type="button" className="admin-page__icon-button" onClick={() => openEditTask(task)} title="Editar" aria-label="Editar task">âœŽ</button>
                      <button type="button" className={task.is_active ? "admin-page__icon-button admin-page__icon-button--warning" : "admin-page__icon-button admin-page__icon-button--success"} onClick={() => toggleTaskActive(task.id)} disabled={isTogglingTaskId === task.id} title={task.is_active ? "Desativar" : "Ativar"} aria-label={task.is_active ? "Desativar task" : "Ativar task"}>{isTogglingTaskId === task.id ? "â€¦" : "â»"}</button>
                      <button type="button" className="admin-page__icon-button admin-page__icon-button--danger" onClick={() => openDeleteModal("task", task)} title="Remover" aria-label="Remover task">ðŸ—‘</button>
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
                <select className="admin-page__input" value={questFilters.continent} onChange={(event) => setQuestFilters((prev) => ({ ...prev, continent: event.target.value, city: "", nw_level: event.target.value === "nightmare_world" ? prev.nw_level : "" }))}>
                  {continents.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {questFilters.continent === "nightmare_world" ? <input className="admin-page__input" type="number" min="1" max="999" placeholder="NW Level" value={questFilters.nw_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, nw_level: event.target.value }))} /> : null}
                <select className="admin-page__input" value={questFilters.city} onChange={(event) => setQuestFilters((prev) => ({ ...prev, city: event.target.value }))}>
                  <option value="">Todas as cidades</option>
                  {questCityOptions.map((city) => (
                    <option key={city.value} value={city.value}>{city.label}</option>
                  ))}
                </select>
                <input className="admin-page__input" type="number" placeholder="NÃ­vel mÃ­n." value={questFilters.min_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, min_level: event.target.value }))} />
                <input className="admin-page__input" type="number" placeholder="NÃ­vel mÃ¡x." value={questFilters.max_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, max_level: event.target.value }))} />
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
              {questFilters.city && questStats.city !== null && (
                <span className="admin-page__stat admin-page__stat--location">{formatCity(questFilters.city)}: {questStats.city}</span>
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
                    <p className="admin-page__tile-description">{quest.description || "Sem descriÃ§Ã£o cadastrada."}</p>
                    <div className="admin-page__chip-row">
                      <span className="admin-page__chip">Continente: {formatContinent(quest.continent)}</span>
                      <span className="admin-page__chip">Cidade: {formatCity(quest.city) || "â€”"}</span>
                      <span className="admin-page__chip">NÃ­vel mÃ­n.: {quest.min_level}</span>
                      {quest.continent === "nightmare_world" && quest.nw_level !== null && quest.nw_level !== undefined ? <span className="admin-page__chip">NW Level: {quest.nw_level}</span> : null}
                    </div>
                    <p className="admin-page__tile-reward">Recompensa: {quest.reward_text || "â€”"}</p>
                  </div>
                  <div className="admin-page__tile-right">
                    <span className={quest.is_active ? "admin-page__status admin-page__status--active admin-page__status--compact" : "admin-page__status admin-page__status--inactive admin-page__status--compact"}>{quest.is_active ? "Ativa" : "Inativa"}</span>
                    <div className="admin-page__task-actions">
                      <button type="button" className="admin-page__icon-button" onClick={() => openEditQuest(quest)} title="Editar" aria-label="Editar quest">âœŽ</button>
                      <button type="button" className={quest.is_active ? "admin-page__icon-button admin-page__icon-button--warning" : "admin-page__icon-button admin-page__icon-button--success"} onClick={() => toggleQuestActive(quest.id)} disabled={isTogglingQuestId === quest.id} title={quest.is_active ? "Desativar" : "Ativar"} aria-label={quest.is_active ? "Desativar quest" : "Ativar quest"}>{isTogglingQuestId === quest.id ? "â€¦" : "â»"}</button>
                      <button type="button" className="admin-page__icon-button admin-page__icon-button--danger" onClick={() => openDeleteModal("quest", quest)} title="Remover" aria-label="Remover quest">ðŸ—‘</button>
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
                  Leituras coletadas dos jogadores para mapear nomes incorretos para um nome canÃ´nico.
                </p>
              </div>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--aliases">
                <input
                  className="admin-page__input"
                  placeholder="Buscar leitura ou nome canÃ´nico"
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
              {/* Single shared datalist for all alias inputs */}
              <datalist id="npc-names-datalist">
                {npcItemNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              {isLoadingAliases ? <div className="admin-page__empty admin-page__empty--full">Carregando aliases...</div> : !aliases.length ? <div className="admin-page__empty admin-page__empty--full">Nenhum alias encontrado.</div> : aliases.map((alias) => (
                <article key={alias.id} className="admin-page__tile">
                  <div className="admin-page__tile-main">
                    <div className="admin-page__tile-top">
                      <strong className="admin-page__tile-title">{alias.observed_name}</strong>
                      <span className={alias.is_approved ? "admin-page__status admin-page__status--active" : "admin-page__status admin-page__status--inactive"}>{alias.is_approved ? "Aprovado" : "Pendente"}</span>
                    </div>

                    <div className="admin-page__chip-row">
                      <span className="admin-page__chip">Normalizado: {alias.observed_name_normalized}</span>
                      <span className="admin-page__chip">OcorrÃªncias: {alias.occurrences}</span>
                    </div>

                    <div className="admin-page__alias-input-row">
                      <input
                        className="admin-page__input"
                        list="npc-names-datalist"
                        value={aliasDrafts[alias.id] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value
                          setAliasDrafts((prev) => ({ ...prev, [alias.id]: value }))
                        }}
                        placeholder={npcItemNames.length > 0 ? "Digite para buscar item NPC..." : "Carregando itens..."}
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
                <h2 className="admin-page__section-title">PreÃ§os NPC</h2>
                <p className="admin-page__section-subtitle">
                  Tabela oficial de preÃ§o NPC usada para montar os totais no OCR e sincronizar nomes canÃ´nicos dos aliases.
                </p>
              </div>
              <button type="button" className="admin-page__primary-button" onClick={openCreateNpcPrice}>Novo item</button>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--npc-prices">
                <input
                  className="admin-page__input"
                  placeholder="Buscar item por nome"
                  value={npcPriceFilters.search}
                  onChange={(event) => updateNpcPriceFilters({ search: event.target.value })}
                />
              </div>
            </div>

            <div className="admin-page__stats-row">
              <span className="admin-page__stat">Total filtrado: {npcPriceTotal}</span>
              <span className="admin-page__stat">PÃ¡gina: {npcPricePage} / {npcPriceTotalPages}</span>
              <span className="admin-page__stat">Na pÃ¡gina: {npcPrices.length}</span>
            </div>

            <div className="admin-page__pagination">
              <button type="button" className="admin-page__ghost-button" onClick={() => setNpcPricePage((prev) => Math.max(1, prev - 1))} disabled={isLoadingNpcPrices || npcPricePage <= 1}>Anterior</button>
              <button type="button" className="admin-page__ghost-button" onClick={() => setNpcPricePage((prev) => Math.min(npcPriceTotalPages, prev + 1))} disabled={isLoadingNpcPrices || npcPricePage >= npcPriceTotalPages}>PrÃ³xima</button>
            </div>

            {isLoadingNpcPrices ? (
              <div className="admin-page__empty admin-page__empty--full">Carregando preÃ§os NPC...</div>
            ) : !npcPrices.length ? (
              <div className="admin-page__empty admin-page__empty--full">Nenhum preÃ§o NPC encontrado.</div>
            ) : (
              <div className="admin-page__users-table-wrap">
                <div className="admin-page__users-table">
                  <div className="admin-page__npc-row admin-page__npc-row--head">
                    <span>Nome</span>
                    <span>PreÃ§o NPC</span>
                    <span>Aliases</span>
                    <span>AÃ§Ãµes</span>
                  </div>
                  {npcPrices.map((item) => (
                    <div key={item.normalized_name} className="admin-page__npc-row">
                      <span title={`Normalizado: ${item.normalized_name}`}>{item.name}</span>
                      <span>{item.unit_price}</span>
                      <span>
                        {Array.isArray(item.related_aliases) && item.related_aliases.length ? (
                          <span
                            className="admin-page__info-badge"
                            title={`Aliases:\n${item.related_aliases.join("\n")}`}
                          >
                            {item.related_aliases.length}
                          </span>
                        ) : "â€”"}
                      </span>
                      <span>
                        <button type="button" className="admin-page__ghost-button admin-page__ghost-button--sm" onClick={() => openEditNpcPrice(item)}>
                          Editar
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : activeTab === "consumables" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">ConsumÃ­veis</h2>
                <p className="admin-page__section-subtitle">Monte um catÃ¡logo organizado por categoria para o jogador filtrar supplies com mais rapidez na tela de hunts.</p>
              </div>
              <button type="button" className="admin-page__primary-button" onClick={openCreateConsumable}>Novo consumÃ­vel</button>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--aliases">
                <input
                  className="admin-page__input"
                  placeholder="Buscar consumÃ­vel por nome"
                  value={consumableFilters.search}
                  onChange={(event) => updateConsumableFilters({ search: event.target.value })}
                />
                <select
                  className="admin-page__input"
                  value={consumableFilters.category}
                  onChange={(event) => updateConsumableFilters({ category: event.target.value })}
                >
                  <option value="">Todas as categorias</option>
                  {consumableCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-page__stats-row">
              <span className="admin-page__stat">Total: {consumableTotal}</span>
              <span className="admin-page__stat">PÃ¡gina: {consumablePage} / {consumableTotalPages}</span>
              <span className="admin-page__stat">Categorias: {consumableCategories.length}</span>
              {consumableFilters.category ? <span className="admin-page__stat admin-page__stat--location">Filtro: {consumableFilters.category}</span> : null}
            </div>

            <div className="admin-page__pagination">
              <button type="button" className="admin-page__ghost-button" onClick={() => setConsumablePage((prev) => Math.max(1, prev - 1))} disabled={isLoadingConsumables || consumablePage <= 1}>Anterior</button>
              <button type="button" className="admin-page__ghost-button" onClick={() => setConsumablePage((prev) => Math.min(consumableTotalPages, prev + 1))} disabled={isLoadingConsumables || consumablePage >= consumableTotalPages}>PrÃ³xima</button>
            </div>

            {isLoadingConsumables ? (
              <div className="admin-page__empty admin-page__empty--full">Carregando consumÃ­veis...</div>
            ) : !consumables.length ? (
              <div className="admin-page__empty admin-page__empty--full">Nenhum consumÃ­vel encontrado.</div>
            ) : (
              <div className="admin-page__users-table-wrap">
                <div className="admin-page__users-table">
                  <div className="admin-page__npc-row admin-page__npc-row admin-page__npc-row--consumable admin-page__npc-row--head">
                    <span>Nome</span>
                    <span>Categoria</span>
                    <span>PreÃ§o NPC</span>
                    <span>AÃ§Ãµes</span>
                  </div>
                  {consumables.map((item) => (
                    <div key={item.nome} className="admin-page__npc-row admin-page__npc-row--consumable">
                      <span>{item.nome}</span>
                      <span>
                        <span className={item.categoria ? "admin-page__chip admin-page__chip--consumable" : "admin-page__chip admin-page__chip--muted"}>
                          {item.categoria || "Sem categoria"}
                        </span>
                      </span>
                      <span>{item.preco_npc}</span>
                      <span className="admin-page__npc-actions">
                        <button type="button" className="admin-page__ghost-button admin-page__ghost-button--sm" onClick={() => openEditConsumable(item)}>
                          Editar
                        </button>
                        <button type="button" className="admin-page__danger-button admin-page__danger-button--sm" onClick={() => handleDeleteConsumable(item.nome)}>
                          Remover
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : activeTab === "users" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">UsuÃ¡rios cadastrados</h2>
                <p className="admin-page__section-subtitle">Visualize ID e usuÃ¡rio sem expor dados sensÃ­veis.</p>
              </div>
              <button type="button" className="admin-page__ghost-button" onClick={() => loadUsers(debouncedUserFilters)}>
                Atualizar
              </button>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--npc-prices">
                <input
                  className="admin-page__input"
                  placeholder="Buscar por usuÃ¡rio ou email"
                  value={userFilters.search}
                  onChange={(event) => setUserFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
              </div>
            </div>

            {isLoadingUsers ? <div className="admin-page__empty admin-page__empty--full">Carregando usuÃ¡rios...</div> : !users.length ? <div className="admin-page__empty admin-page__empty--full">Nenhum usuÃ¡rio encontrado.</div> : (
              <div className="admin-page__users-table-wrap">
                <div className="admin-page__users-table">
                  <div className="admin-page__users-row admin-page__users-row--head">
                    <span>ID</span>
                    <span>UsuÃ¡rio</span>
                    <span>Email</span>
                    <span>AÃ§Ãµes</span>
                  </div>

                  {users.map((item) => (
                    <div key={item.id} className="admin-page__users-row">
                      <span>{item.id}</span>
                      <span>{item.username}</span>
                      <span>{item.email}</span>
                      <span>
                        <button
                          type="button"
                          className="admin-page__danger-button admin-page__danger-button--sm"
                          onClick={() => openUserDeleteModal(item.id, item.username)}
                          disabled={deletingUserId === item.id}
                        >
                          {deletingUserId === item.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : activeTab === "pokemon" ? (
          <section className="admin-page__panel">
            <div className="admin-page__section-header">
              <div>
                <h2 className="admin-page__section-title">PokÃ©mon</h2>
                <p className="admin-page__section-subtitle">Gerencie a lista de PokÃ©mon disponÃ­veis nas hunts. Busque para filtrar e ajuste ID e nome separadamente.</p>
              </div>
              <button type="button" className="admin-page__primary-button" onClick={openCreatePokemon}>Novo PokÃ©mon</button>
            </div>

            <div className="admin-page__filters-card">
              <div className="admin-page__filters-grid admin-page__filters-grid--npc-prices">
                <input
                  className="admin-page__input"
                  placeholder="Buscar por ID ou nome (ex: 0003, Venusaur, Shiny...)"
                  value={pokemonFilters.search}
                  onChange={(event) => updatePokemonFilters({ search: event.target.value })}
                />
              </div>
            </div>

            <div className="admin-page__stats-row">
              <span className="admin-page__stat">Total filtrado: {pokemonTotal}</span>
              <span className="admin-page__stat">PÃ¡gina: {pokemonPage} / {pokemonTotalPages}</span>
              <span className="admin-page__stat">Na pÃ¡gina: {pokemon.length}</span>
            </div>

            <div className="admin-page__pagination">
              <button type="button" className="admin-page__ghost-button" onClick={() => setPokemonPage((prev) => Math.max(1, prev - 1))} disabled={isLoadingPokemon || pokemonPage <= 1}>Anterior</button>
              <button type="button" className="admin-page__ghost-button" onClick={() => setPokemonPage((prev) => Math.min(pokemonTotalPages, prev + 1))} disabled={isLoadingPokemon || pokemonPage >= pokemonTotalPages}>PrÃ³xima</button>
            </div>

            <div className="admin-page__pokemon-grid">
              {isLoadingPokemon ? (
                <div className="admin-page__empty admin-page__empty--full">Carregando PokÃ©mon...</div>
              ) : !pokemon.length ? (
                <div className="admin-page__empty admin-page__empty--full">Nenhum PokÃ©mon encontrado.</div>
              ) : pokemon.map((entry) => (
                <article key={entry.full_name} className="admin-page__pokemon-card">
                  <span className="admin-page__pokemon-dex">#{entry.dex_id}</span>
                  <span className="admin-page__pokemon-name">{entry.name}</span>
                  <div className="admin-page__pokemon-actions">
                    <button type="button" className="admin-page__ghost-button admin-page__ghost-button--sm" onClick={() => openEditPokemon(entry)}>Editar</button>
                    <button type="button" className="admin-page__danger-button admin-page__danger-button--sm" onClick={() => handleDeletePokemon(entry.full_name)} disabled={isDeletingPokemon}>âœ•</button>
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
                  Defina quais menus ficam ativos para os jogadores e marque os que estÃ£o em teste com o selo beta.
                </p>
              </div>
              <button type="button" className="admin-page__ghost-button" onClick={loadSidebarMenus}>
                Atualizar
              </button>
            </div>

            <div className="admin-page__cards-grid admin-page__cards-grid--sidebar">
              {isLoadingSidebarMenus ? <div className="admin-page__empty admin-page__empty--full">Carregando menus...</div> : !sidebarMenus.length ? <div className="admin-page__empty admin-page__empty--full">Nenhuma configuraÃ§Ã£o de menu encontrada.</div> : sidebarMenus.map((menu) => {
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
                  Veja sessÃµes, relatÃ³rios completos de OCR e, quando ativado, arquivos visuais de debug.
                </p>
              </div>
              <div className="admin-page__tile-actions admin-page__tile-actions--row">
                <label className="admin-page__ghost-button admin-page__upload-label-button" htmlFor="admin-ocr-manual-upload">
                  Selecionar imagens treino
                </label>
                <input
                  id="admin-ocr-manual-upload"
                  className="admin-page__hidden-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleSelectManualOcrFiles}
                />
                <button
                  type="button"
                  className="admin-page__primary-button"
                  onClick={handleUploadManualOcrFiles}
                  disabled={isUploadingManualOcr || !manualOcrFiles.length}
                >
                  {isUploadingManualOcr ? "Enviando treino..." : `Treinar com ${manualOcrFiles.length || 0} imagem(ns)`}
                </button>
                <button type="button" className="admin-page__ghost-button" onClick={loadOcrDebugSessions}>
                  Atualizar sessÃµes
                </button>
                <button type="button" className="admin-page__ghost-button admin-page__ghost-button--danger" onClick={handleClearAllOcrDebugSessions} disabled={isClearingOcrDebug || !ocrDebugSessions.length}>
                  {isClearingOcrDebug ? "Limpando..." : "Limpar tudo"}
                </button>
              </div>
            </div>

            <div className="admin-page__cards-grid admin-page__cards-grid--debug">
              <article className="admin-page__tile admin-page__tile--debug">
                <div className="admin-page__tile-main">
                  <div className="admin-page__tile-top">
                    <strong className="admin-page__tile-title">SessÃµes</strong>
                  </div>
                  {isLoadingOcrDebugSessions ? (
                    <div className="admin-page__empty">Carregando sessÃµes...</div>
                  ) : !ocrDebugSessions.length ? (
                    <div className="admin-page__empty">Nenhuma sessÃ£o de debug encontrada.</div>
                  ) : (
                    <div className="admin-page__debug-list">
                      {ocrDebugSessions.map((session) => (
                        <div key={session.session_id} className={selectedOcrDebugSession === session.session_id ? "admin-page__debug-row admin-page__debug-row--active" : "admin-page__debug-row"}>
                          <button
                            type="button"
                            className="admin-page__debug-row-main"
                            onClick={() => loadOcrDebugFiles(session.session_id)}
                          >
                            <span className="admin-page__debug-row-title">{session.session_id}</span>
                            <span className="admin-page__debug-row-meta">Arquivos: {session.file_count}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-page__icon-button admin-page__icon-button--danger"
                            title="Excluir sessÃ£o"
                            aria-label="Excluir sessÃ£o"
                            onClick={() => handleDeleteOcrDebugSession(session.session_id)}
                            disabled={deletingOcrDebugSessionId === session.session_id}
                          >
                            {deletingOcrDebugSessionId === session.session_id ? "â€¦" : "ðŸ—‘"}
                          </button>
                        </div>
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
                    <div className="admin-page__empty">Selecione uma sessÃ£o para ver os arquivos.</div>
                  ) : !ocrDebugFiles.length ? (
                    <div className="admin-page__empty">Nenhum arquivo encontrado na sessÃ£o.</div>
                  ) : (
                    <div className="admin-page__debug-list">
                      {ocrDebugFiles.map((file) => (
                        <div key={file.name} className="admin-page__debug-file-row">
                          <div className="admin-page__debug-file-meta">
                            <strong>{file.name}</strong>
                            <span>{file.kind} Â· {file.size_bytes} bytes</span>
                          </div>
                          <div className="admin-page__debug-file-actions">
                            {file.kind === "text" ? (
                              <button type="button" className="admin-page__ghost-button" onClick={() => openOcrDebugText(file.name)}>
                                Ver texto
                              </button>
                            ) : null}
                            {file.kind === "image" ? (
                              <button type="button" className="admin-page__ghost-button" onClick={() => previewOcrDebugImage(file.name)}>
                                Ver imagem
                              </button>
                            ) : null}
                            <button type="button" className="admin-page__ghost-button" onClick={() => openOcrDebugFile(file.name)}>
                              Abrir
                            </button>
                            <button
                              type="button"
                              className="admin-page__ghost-button admin-page__ghost-button--danger"
                              onClick={() => handleDeleteOcrDebugFile(file.name)}
                              disabled={deletingOcrDebugFileName === file.name}
                            >
                              {deletingOcrDebugFileName === file.name ? "Excluindo..." : "Excluir"}
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
                  <pre className="admin-page__debug-text-preview">{ocrDebugTextPreview || "Abra um arquivo de texto para visualizar o conteÃºdo."}</pre>

                  <div className="admin-page__tile-top admin-page__tile-top--spaced">
                    <strong className="admin-page__tile-title">Preview de imagem</strong>
                    {ocrDebugImagePreviewTitle ? <span className="admin-page__chip">{ocrDebugImagePreviewTitle}</span> : null}
                  </div>
                  {ocrDebugImagePreviewUrl ? (
                    <img src={ocrDebugImagePreviewUrl} alt={ocrDebugImagePreviewTitle || "preview OCR"} className="admin-page__ocr-image-preview" />
                  ) : (
                    <div className="admin-page__empty">Abra um arquivo de imagem para visualizar aqui.</div>
                  )}

                  <div className="admin-page__tile-top admin-page__tile-top--spaced">
                    <strong className="admin-page__tile-title">Campo de treino OCR</strong>
                    {ocrTrainingRows.length ? <span className="admin-page__chip">{ocrTrainingRows.length} valor(es) detectado(s)</span> : null}
                  </div>
                  {!ocrTrainingRows.length ? (
                    <div className="admin-page__empty">Abra um arquivo de texto OCR para preencher automaticamente os valores detectados.</div>
                  ) : (
                    <>
                      <div className="admin-page__training-list">
                        {ocrTrainingRows.map((row, index) => (
                          <div key={row.id} className="admin-page__training-row">
                            <input
                              className="admin-page__input"
                              value={row.observed}
                              onChange={(event) => {
                                const value = event.target.value
                                setOcrTrainingRows((prev) => prev.map((item, idx) => idx === index ? { ...item, observed: value } : item))
                              }}
                              placeholder="Leitura OCR"
                            />
                            <input
                              className="admin-page__input"
                              value={row.canonical}
                              onChange={(event) => {
                                const value = event.target.value
                                setOcrTrainingRows((prev) => prev.map((item, idx) => idx === index ? { ...item, canonical: value } : item))
                              }}
                              placeholder="Nome canÃ´nico correto"
                            />
                            <button
                              type="button"
                              className="admin-page__ghost-button"
                              onClick={() => saveManualAliasTraining(index)}
                              disabled={Boolean(trainingSavingMap[index]) || isSavingManualAlias}
                            >
                              {trainingSavingMap[index] ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="admin-page__tile-actions admin-page__tile-actions--row">
                        <button
                          type="button"
                          className="admin-page__primary-button"
                          onClick={saveAllManualAliasTraining}
                          disabled={isSavingManualAlias}
                        >
                          {isSavingManualAlias ? "Salvando lote..." : "Salvar todos como alias"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            </div>
          </section>
        )}
      </div>

        {pokemonModal ? (
          <div className="character-modal-backdrop">
            <div className="character-modal">
              <h2 className="character-modal__title">{pokemonModal.type === "create" ? "Novo PokÃ©mon" : "Editar PokÃ©mon"}</h2>
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
              <div className="character-modal__field"><label>O que deve fazer</label><input className="character-modal__input" required value={taskForm.description} onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Tipo (selecione um ou mais)</label><div className="character-modal__checkboxes">{taskTypes.filter((item) => item.value).map((item) => <label key={item.value} className="character-modal__checkbox"><input type="checkbox" checked={taskForm.task_type.includes(item.value)} onChange={(event) => { if (!event.target.checked && taskForm.task_type.length === 1) { setToast({ type: "error", message: "Selecione ao menos um tipo de task" }); return; } setTaskForm((prev) => ({ ...prev, task_type: event.target.checked ? [...prev.task_type, item.value] : prev.task_type.filter((t) => t !== item.value) })); }} /><span>{item.label}</span></label>)}</div></div>
              <div className="character-modal__field"><label>Continente</label><select className="character-modal__input" value={taskForm.continent} onChange={(event) => setTaskForm((prev) => ({ ...prev, continent: event.target.value, nw_level: event.target.value === "nightmare_world" ? prev.nw_level : "" }))}>{continents.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div className="character-modal__field"><label>NÃ­vel mÃ­nimo <span style={{color: "#999", fontSize: "0.85em"}}>(vazio = 5)</span></label><input className="character-modal__input" type="number" min="0" max="625" value={taskForm.min_level} onChange={(event) => setTaskForm((prev) => ({ ...prev, min_level: event.target.value }))} /></div>
              {taskForm.continent === "nightmare_world" ? <div className="character-modal__field"><label>Nightmare Level (NW Level)</label><input className="character-modal__input" type="number" min="1" max="999" value={taskForm.nw_level} onChange={(event) => setTaskForm((prev) => ({ ...prev, nw_level: event.target.value }))} /></div> : null}
              <div className="character-modal__field"><label>Recompensa</label><input className="character-modal__input" required value={taskForm.reward_text} onChange={(event) => setTaskForm((prev) => ({ ...prev, reward_text: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Coordenada <span style={{color: "#999", fontSize: "0.85em"}}>(opcional)</span></label><input className="character-modal__input" placeholder="Ex: 1000000,-1000000,500" value={taskForm.coordinate} onChange={(event) => setTaskForm((prev) => ({ ...prev, coordinate: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Cidade</label><input className="character-modal__input" required value={taskForm.city} onChange={(event) => setTaskForm((prev) => ({ ...prev, city: event.target.value }))} /></div>
              <div className="character-modal__field"><label>DisponÃ­vel para o usuÃ¡rio adicionar</label><button type="button" className={taskForm.is_active ? "admin-page__toggle admin-page__toggle--active" : "admin-page__toggle"} onClick={() => setTaskForm((prev) => ({ ...prev, is_active: !prev.is_active }))}>{taskForm.is_active ? "Ativa" : "Inativa"}</button></div>
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
              <div className="character-modal__field"><label>DescriÃ§Ã£o</label><input className="character-modal__input" value={questForm.description} onChange={(event) => setQuestForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Continente</label><select className="character-modal__input" value={questForm.continent} onChange={(event) => setQuestForm((prev) => ({ ...prev, continent: event.target.value }))}>{continents.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div className="character-modal__field"><label>Cidade</label><input className="character-modal__input" required value={questForm.city} onChange={(event) => setQuestForm((prev) => ({ ...prev, city: event.target.value }))} /></div>
              <div className="character-modal__field"><label>NÃ­vel mÃ­nimo</label><input className="character-modal__input" type="number" min="0" max="625" value={questForm.min_level} onChange={(event) => setQuestForm((prev) => ({ ...prev, min_level: event.target.value }))} /></div>
              {questForm.continent === "nightmare_world" ? <div className="character-modal__field"><label>Nightmare Level (NW Level)</label><input className="character-modal__input" type="number" min="1" max="999" value={questForm.nw_level} onChange={(event) => setQuestForm((prev) => ({ ...prev, nw_level: event.target.value }))} /></div> : null}
              <div className="character-modal__field"><label>Recompensa</label><input className="character-modal__input" value={questForm.reward_text} onChange={(event) => setQuestForm((prev) => ({ ...prev, reward_text: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Ativa</label><select className="character-modal__input" value={String(questForm.is_active)} onChange={(event) => setQuestForm((prev) => ({ ...prev, is_active: event.target.value === "true" }))}><option value="true">Sim</option><option value="false">NÃ£o</option></select></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setQuestModal(null)} disabled={isSubmittingQuest}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingQuest}>{isSubmittingQuest ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {npcPriceModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal">
            <h2 className="character-modal__title">{npcPriceModal.type === "create" ? "Novo item NPC" : "Editar preÃ§o NPC"}</h2>
            <form onSubmit={handleSubmitNpcPrice}>
              <div className="character-modal__field"><label>Nome do item</label><input className="character-modal__input" value={npcPriceForm.name} onChange={(event) => setNpcPriceForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="character-modal__field"><label>PreÃ§o unitÃ¡rio NPC</label><input className="character-modal__input" type="number" min="0" step="0.01" value={npcPriceForm.unit_price} onChange={(event) => setNpcPriceForm((prev) => ({ ...prev, unit_price: event.target.value }))} /></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setNpcPriceModal(null)} disabled={isSubmittingNpcPrice}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingNpcPrice}>{isSubmittingNpcPrice ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {consumableModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal character-modal--consumable">
            <div className="character-modal__header">
              <div>
                <span className="character-modal__eyebrow">CatÃ¡logo de supply</span>
                <h2 className="character-modal__title">{consumableModal.type === "create" ? "Novo consumÃ­vel" : "Editar consumÃ­vel"}</h2>
                <p className="character-modal__description">Defina nome, categoria e preÃ§o NPC. A categoria vira filtro para o jogador na tela de hunts.</p>
              </div>
            </div>
            <form onSubmit={handleSubmitConsumable} className="character-modal__form">
              <div className="character-modal__field-grid">
                <div className="character-modal__field character-modal__field--full">
                  <label>Nome</label>
                  <input className="character-modal__input" value={consumableForm.nome} onChange={(event) => setConsumableForm((prev) => ({ ...prev, nome: event.target.value }))} />
                </div>
                <div className="character-modal__field">
                  <label>Categoria</label>
                  <input className="character-modal__input" value={consumableForm.categoria} onChange={(event) => setConsumableForm((prev) => ({ ...prev, categoria: event.target.value }))} placeholder="Ex: poÃ§Ãµes, berries, revive" />
                </div>
                <div className="character-modal__field">
                  <label>PreÃ§o NPC</label>
                  <input className="character-modal__input" type="number" min="0" step="0.01" value={consumableForm.preco_npc} onChange={(event) => setConsumableForm((prev) => ({ ...prev, preco_npc: event.target.value }))} />
                </div>
              </div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setConsumableModal(null)} disabled={isSubmittingConsumable}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingConsumable}>{isSubmittingConsumable ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal character-modal--danger">
            <h2 className="character-modal__title">Remover {deleteModal.type === "task" ? "task" : "quest"}</h2>
            <p className="character-modal__description">VocÃª estÃ¡ prestes a remover permanentemente <strong>{deleteModal.item.name}</strong>.</p>
            <div className="character-modal__notice-list">
              <div className="character-modal__notice character-modal__notice--warning">Essa aÃ§Ã£o apagarÃ¡ o item do sistema inteiro.</div>
              <div className="character-modal__notice character-modal__notice--warning">Ela nÃ£o pode ser desfeita.</div>
            </div>
            <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={closeDeleteModal} disabled={isDeletingItem}>Cancelar</button><button type="button" className="character-modal__button character-modal__button--danger" onClick={handleDeleteConfirmed} disabled={isDeletingItem}>{isDeletingItem ? "Removendo..." : "Remover permanentemente"}</button></div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(userDeleteModal)}
        title="Excluir usuÃ¡rio"
        description={userDeleteModal ? `Excluir o usuÃ¡rio ${userDeleteModal.username || userDeleteModal.userId}? Esta aÃ§Ã£o remove tudo relacionado.` : ""}
        confirmLabel="Excluir"
        confirmTone="danger"
        isLoading={Boolean(deletingUserId)}
        onCancel={() => {
          if (!deletingUserId) setUserDeleteModal(null)
        }}
        onConfirm={handleDeleteUserConfirmed}
      />
    </div>
  )
}

