import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import AppShell from "../components/app-shell.jsx"
import AppSelect from "../components/app-select.jsx"
import ConfirmActionModal from "../components/confirm-action-modal.jsx"
import Topbar from "../components/topbar.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { useI18n } from "../context/i18n-context.jsx"
import { apiRequest } from "../services/api.js"
import { API_URL, getAccessToken } from "../services/session-manager.js"
import "../styles/hunts-page.css"

function formatCompactNumber(value, locale = "pt-BR") {
  return new Intl.NumberFormat(locale).format(value)
}

function formatCompactValue(value, locale = "pt-BR") {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) {
    return "0"
  }

  const abs = Math.abs(numeric)
  const formatShort = (val, suffix) => {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: val % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    }).format(val)
    return `${formatted}${suffix}`
  }

  if (abs >= 1_000_000) {
    return formatShort(numeric / 1_000_000, "kk")
  }

  if (abs >= 1_000) {
    return formatShort(numeric / 1_000, "k")
  }

  return new Intl.NumberFormat(locale).format(numeric)
}

function formatHoursAndMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`
}

function parseDecimalInput(raw) {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "")

  const value = Number(normalized)
  if (Number.isNaN(value)) return 0
  return value
}

function formatCompactDlValue(value, locale = "pt-BR") {
  const numeric = Number(value || 0)
  const floorToSingleDecimal = (amount) => Math.floor(amount * 10) / 10

  if (!Number.isFinite(numeric)) {
    return "0"
  }

  const absolute = Math.abs(numeric)
  if (absolute >= 1_000_000) {
    const compact = floorToSingleDecimal(numeric / 1_000_000)
    return `${String(compact).replace(/\.0$/, "")}kk`
  }

  if (absolute >= 1_000) {
    const compact = floorToSingleDecimal(numeric / 1_000)
    return `${String(compact).replace(/\.0$/, "")}k`
  }

  return new Intl.NumberFormat(locale).format(numeric)
}

const ACCEPTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"])

function isAcceptedImageFile(file) {
  const mimeType = String(file?.type || "").toLowerCase()
  if (ACCEPTED_IMAGE_MIME_TYPES.has(mimeType)) return true

  const fileName = String(file?.name || "").toLowerCase()
  return fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")
}

export default function HuntsPage() {
  const { activeCharacter } = useCharacter()
  const { locale, t } = useI18n()
  const [viewMode, setViewMode] = useState("history")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewFile, setPreviewFile] = useState(null)
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false)
  const [isUploadingDrops, setIsUploadingDrops] = useState(false)
  const [dropsResult, setDropsResult] = useState(null)
  const [dropsRows, setDropsRows] = useState([])
  const [dropsWarnings, setDropsWarnings] = useState([])
  const [savingPriceMap, setSavingPriceMap] = useState({})
  const [dropsError, setDropsError] = useState("")

  const [huntDuration, setHuntDuration] = useState("")
  const [huntNotes, setHuntNotes] = useState("")

  const [allEnemies, setAllEnemies] = useState([])
  const [enemySearch, setEnemySearch] = useState("")
  const [enemyList, setEnemyList] = useState([])
  const [showEnemySuggestions, setShowEnemySuggestions] = useState(false)

  const [allConsumables, setAllConsumables] = useState([])
  const [consumableSearch, setConsumableSearch] = useState("")
  const [consumableList, setConsumableList] = useState([])
  const [showConsumableSuggestions, setShowConsumableSuggestions] = useState(false)
  const [isConsumableModalOpen, setIsConsumableModalOpen] = useState(false)
  const [selectedConsumableCategory, setSelectedConsumableCategory] = useState("")

  const [isSavingHunt, setIsSavingHunt] = useState(false)
  const [huntSaveError, setHuntSaveError] = useState("")
  const [huntSaved, setHuntSaved] = useState(false)
  const [huntSessions, setHuntSessions] = useState([])
  const [historyRange, setHistoryRange] = useState("all")
  const [historyPage, setHistoryPage] = useState(1)
  const [chartMode, setChartMode] = useState("day")
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  const [sessionDetail, setSessionDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [deleteSessionConfirm, setDeleteSessionConfirm] = useState(null)
  const [deletingSessionId, setDeletingSessionId] = useState(null)

  const flaggedFileIds = useMemo(() => {
    if (!dropsWarnings.length || !selectedFiles.length) {
      return new Set()
    }

    const flaggedIds = new Set()
    const warningsText = dropsWarnings.join(" ").toLowerCase()

    for (const entry of selectedFiles) {
      if (warningsText.includes(entry.file.name.toLowerCase())) {
        flaggedIds.add(entry.id)
      }
    }

    return flaggedIds
  }, [dropsWarnings, selectedFiles])

  const summary = useMemo(() => {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000)
    const recentSessions = huntSessions.filter((s) => {
      const sessionDate = new Date(s.hunt_date || "").getTime()
      return Number.isFinite(sessionDate) && sessionDate >= cutoff
    })

    const totalHunts = recentSessions.length
    const totalMinutes = recentSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
    const totalNpcValue = recentSessions.reduce((acc, s) => acc + (s.total_npc_value || 0), 0)
    const totalPlayerValue = recentSessions.reduce((acc, s) => acc + (s.total_player_value || 0), 0)
    const averageNpcPerHour = totalMinutes > 0 ? Math.round((totalNpcValue / totalMinutes) * 60) : 0
    const averagePlayerPerHour = totalMinutes > 0 ? Math.round((totalPlayerValue / totalMinutes) * 60) : 0
    const expectedNpcProfit = recentSessions.reduce((acc, s) => {
      const consumableCost = (s.consumables_json || []).reduce((cAcc, c) => cAcc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
      return acc + (s.total_npc_value || 0) - consumableCost
    }, 0)
    const expectedPlayerProfit = recentSessions.reduce((acc, s) => {
      const playerValue = s.total_player_value || 0
      const npcValue = s.total_npc_value || 0
      const effectiveValue = playerValue > 0 ? playerValue : npcValue
      const consumableCost = (s.consumables_json || []).reduce((cAcc, c) => cAcc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
      return acc + Math.max(0, effectiveValue - consumableCost)
    }, 0)
    return { totalHunts, totalMinutes, averageNpcPerHour, averagePlayerPerHour, expectedNpcProfit, expectedPlayerProfit }
  }, [huntSessions])

  const ocrExampleRules = useMemo(() => ([
    t("hunts.example.rule1"),
    t("hunts.example.rule2"),
    t("hunts.example.rule3"),
    t("hunts.example.rule4"),
    t("hunts.example.rule5"),
  ]), [t])

  const filteredHistorySessions = useMemo(() => {
    if (historyRange === "all") {
      return [...huntSessions].sort((a, b) => new Date(b.hunt_date) - new Date(a.hunt_date))
    }

    const days = Number(historyRange)
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000)
    return huntSessions
      .filter((s) => {
        const sessionDate = new Date(s.hunt_date || "").getTime()
        return Number.isFinite(sessionDate) && sessionDate >= cutoff
      })
      .sort((a, b) => new Date(b.hunt_date) - new Date(a.hunt_date))
  }, [historyRange, huntSessions])

  const chartData = useMemo(() => {
    const sortedSessions = [...filteredHistorySessions]
      .sort((a, b) => new Date(a.hunt_date) - new Date(b.hunt_date))

    if (chartMode === "day") {
      const groupedByDay = new Map()

      for (const session of sortedSessions) {
        const date = new Date(session.hunt_date)
        if (Number.isNaN(date.getTime())) continue

        const key = date.toISOString().slice(0, 10)
        const current = groupedByDay.get(key) || {
          label: date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
          npc: 0,
          venda: 0,
          duracao: 0,
        }

        current.npc += Math.round(session.total_npc_value || 0)
        current.venda += Math.round(session.total_player_value || 0)
        current.duracao += session.duration_minutes || 0
        groupedByDay.set(key, current)
      }

      return Array.from(groupedByDay.values()).slice(-20)
    }

    return sortedSessions.slice(-20).map((s) => ({
      label: new Date(s.hunt_date).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
      npc: Math.round(s.total_npc_value || 0),
      venda: Math.round(s.total_player_value || 0),
      duracao: s.duration_minutes || 0,
    }))
  }, [chartMode, filteredHistorySessions, locale])

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistorySessions.length / 6))
  const pagedHistorySessions = useMemo(() => {
    const start = (historyPage - 1) * 6
    return filteredHistorySessions.slice(start, start + 6)
  }, [filteredHistorySessions, historyPage])

  useEffect(() => {
    setHistoryPage(1)
  }, [historyRange])

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages)
    }
  }, [historyPage, historyTotalPages])

  const statCards = useMemo(() => ([
    {
      label: t("hunts.stats.sessions"),
      value: formatCompactNumber(summary.totalHunts, locale),
      helper: t("hunts.stats.sessionsHelper"),
    },
    {
      label: t("hunts.stats.hoursHunted"),
      value: formatHoursAndMinutes(summary.totalMinutes),
      helper: t("hunts.stats.hoursHuntedHelper"),
    },
    {
      label: t("hunts.stats.averagePerHour"),
      value: (
        <div className="hunts-page__stat-split-value">
          <span className="hunts-page__stat-split-line">{t("hunts.session.npc").toLowerCase()}: {formatCompactValue(summary.averageNpcPerHour, locale)}</span>
          <span className="hunts-page__stat-split-line hunts-page__stat-split-line--player">{t("hunts.session.player").toLowerCase()}: {formatCompactValue(summary.averagePlayerPerHour, locale)}</span>
        </div>
      ),
      helper: t("hunts.stats.averagePerHourHelper"),
      valueClassName: "hunts-page__stat-value--split",
    },
    {
      label: t("hunts.stats.expectedProfit"),
      value: (
        <div className="hunts-page__stat-split-value">
          <span className="hunts-page__stat-split-line">{t("hunts.session.npc").toLowerCase()}: {formatCompactValue(summary.expectedNpcProfit, locale)}</span>
          <span className="hunts-page__stat-split-line hunts-page__stat-split-line--player">{t("hunts.session.player").toLowerCase()}: {formatCompactValue(summary.expectedPlayerProfit, locale)}</span>
        </div>
      ),
      helper: t("hunts.stats.expectedProfitHelper"),
      valueClassName: "hunts-page__stat-value--split",
    },
  ]), [locale, summary, t])

  const currentExpectedProfit = useMemo(() => {
    const consumableCost = consumableList.reduce((acc, c) => acc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
    const npcProfit = dropsRows.reduce((acc, row) => acc + Number(row.npcTotalPrice || 0), 0) - consumableCost
    const playerProfit = Math.max(0, dropsRows.reduce((acc, row) => {
      const effective = Number(row.playerUnitPrice || 0) > 0 ? Number(row.playerTotalPrice || 0) : Number(row.npcTotalPrice || 0)
      return acc + effective
    }, 0) - consumableCost)
    return { npc: npcProfit, player: playerProfit }
  }, [dropsRows, consumableList])

  function getConsumableName(item) {
    return String(item?.nome ?? item?.name ?? "").trim()
  }

  function getConsumableCategory(item) {
    return String(item?.categoria ?? item?.category ?? "").trim()
  }

  const consumableCategories = useMemo(() => {
    const values = Array.from(new Set(allConsumables.map((item) => getConsumableCategory(item)).filter(Boolean)))
    return values.sort((left, right) => left.localeCompare(right, locale))
  }, [allConsumables, locale])

  const filteredConsumables = useMemo(() => {
    const query = consumableSearch.trim().toLowerCase()
    const categoryFiltered = selectedConsumableCategory
      ? allConsumables.filter((item) => getConsumableCategory(item) === selectedConsumableCategory)
      : allConsumables

    if (!query) return categoryFiltered.slice(0, 10)
    return categoryFiltered
      .filter((item) => getConsumableName(item).toLowerCase().includes(query))
      .slice(0, 10)
  }, [allConsumables, consumableSearch, selectedConsumableCategory])

  const isHistoryOpen = viewMode === "history"
  const isNewHuntOpen = viewMode === "new-hunt"

  useEffect(() => {
    return () => {
      for (const entry of selectedFiles) {
        URL.revokeObjectURL(entry.previewUrl)
      }
    }
  }, [selectedFiles])

  useEffect(() => {
    apiRequest("/hunts/enemies").then((data) => {
      if (Array.isArray(data)) setAllEnemies(data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    apiRequest("/hunts/consumables").then((data) => {
      if (Array.isArray(data)) setAllConsumables(data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeCharacter?.id) return
    loadSessions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacter?.id])

  async function loadSessions() {
    setIsLoadingHistory(true)
    try {
      const params = activeCharacter?.id ? `?character_id=${activeCharacter.id}` : ""
      const data = await apiRequest(`/hunts/sessions${params}`)
      setHuntSessions(Array.isArray(data) ? data : [])
    } catch {
      setHuntSessions([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  function addEnemy(name) {
    setEnemyList((prev) => {
      const existing = prev.findIndex((e) => e.name.toLowerCase() === name.toLowerCase())
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 }
        return next
      }
      return [...prev, { name, quantity: 1 }]
    })
    setEnemySearch("")
    setShowEnemySuggestions(false)
  }

  function removeEnemy(index) {
    setEnemyList((prev) => prev.filter((_, i) => i !== index))
  }

  function updateEnemyQty(index, qty) {
    const val = Math.max(1, Number(qty) || 1)
    setEnemyList((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], quantity: val }
      return next
    })
  }


  function addConsumable(item) {
    const consumableName = getConsumableName(item)
    if (!consumableName) return

    setConsumableList((prev) => {
      const existing = prev.findIndex((c) => c.name.toLowerCase() === consumableName.toLowerCase())
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 }
        return next
      }
      return [
        ...prev,
        {
          name: consumableName,
          quantity: 1,
          preco_npc: Number(item?.preco_npc ?? 0),
          categoria: getConsumableCategory(item),
        },
      ]
    })
    setConsumableSearch("")
    setShowConsumableSuggestions(false)
  }

  function addConsumableFromInput() {
    if (!filteredConsumables.length) return
    const query = consumableSearch.trim().toLowerCase()
    const exactMatch = filteredConsumables.find((item) => getConsumableName(item).toLowerCase() === query)
    addConsumable(exactMatch || filteredConsumables[0])
  }

  function removeConsumable(index) {
    setConsumableList((prev) => prev.filter((_, i) => i !== index))
  }

  function updateConsumableQty(index, qty) {
    const val = Math.max(1, Number(qty) || 1)
    setConsumableList((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], quantity: val }
      return next
    })
  }
  async function saveHunt() {
    if (isSavingHunt) return
    const parsedDuration = huntDuration ? parseInt(huntDuration, 10) : null
    const hasUsefulHuntData = (
      dropsRows.length > 0
      || enemyList.length > 0
      || consumableList.length > 0
      || (Number.isFinite(parsedDuration) && parsedDuration > 0)
      || huntNotes.trim().length > 0
    )

    if (!hasUsefulHuntData) {
      setHuntSaved(false)
      setHuntSaveError("Informe ao menos um drop, inimigo, consumivel, duracao ou anotacao antes de salvar.")
      return
    }

    setIsSavingHunt(true)
    setHuntSaveError("")
    setHuntSaved(false)
    try {
      const body = {
        character_id: activeCharacter?.id || null,
        duration_minutes: Number.isFinite(parsedDuration) ? parsedDuration : null,
        notes: huntNotes.trim() || null,
        drops: dropsRows.map((row) => {
          const effectivePlayerUnit = Number(row.playerUnitPrice || 0) > 0 ? row.playerUnitPrice : row.npcUnitPrice
          return {
            name: row.name,
            nameNormalized: row.nameNormalized,
            quantity: row.quantity,
            npcUnitPrice: row.npcUnitPrice,
            npcTotalPrice: row.npcTotalPrice,
            playerUnitPrice: effectivePlayerUnit,
            playerTotalPrice: effectivePlayerUnit * row.quantity,
          }
        }),
        enemies: enemyList.map((e) => ({ name: e.name, quantity: e.quantity })),
        consumables: consumableList.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          preco_npc: c.preco_npc,
          categoria: c.categoria || null,
        })),
      }
      await apiRequest("/hunts/sessions", { method: "POST", body: JSON.stringify(body) })
      setHuntSaved(true)
      setDropsResult(null)
      setDropsRows([])
      handleClearSelectedFiles()
      setEnemyList([])
      setHuntDuration("")
      setHuntNotes("")
      await loadSessions()
    } catch (error) {
      setHuntSaveError(error.message || t("hunts.errors.saveHunt"))
    } finally {
      setIsSavingHunt(false)
    }
  }

  async function loadSessionDetail(id) {
    if (expandedSessionId === id) {
      setExpandedSessionId(null)
      setSessionDetail(null)
      return
    }
    setExpandedSessionId(id)
    setIsLoadingDetail(true)
    try {
      const data = await apiRequest(`/hunts/sessions/${id}`)
      setSessionDetail(data)
    } catch {
      setSessionDetail(null)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  async function deleteSession(id) {
    setDeletingSessionId(id)
    try {
      await apiRequest(`/hunts/sessions/${id}`, { method: "DELETE" })
      setHuntSessions((prev) => prev.filter((s) => s.id !== id))
      setDeleteSessionConfirm(null)
      if (expandedSessionId === id) {
        setExpandedSessionId(null)
        setSessionDetail(null)
      }
    } catch {
    } finally {
      setDeletingSessionId(null)
    }
  }

  function handleSelectFiles(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const acceptedFiles = files.filter(isAcceptedImageFile)
    const rejectedCount = files.length - acceptedFiles.length

    if (!acceptedFiles.length) {
      setDropsError(t("hunts.errors.invalidFiles"))
      event.target.value = ""
      return
    }

    setSelectedFiles((current) => {
      const next = [...current]

      for (const file of acceptedFiles) {
        const duplicate = next.some(
          (entry) =>
            entry.file.name === file.name
            && entry.file.lastModified === file.lastModified
            && entry.file.size === file.size,
        )

        if (duplicate) continue

        next.push({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })
      }

      return next
    })

    event.target.value = ""
    setDropsError(rejectedCount > 0 ? t("hunts.errors.ignoredFiles") : "")
    setDropsWarnings([])
    setDropsResult(null)
    setDropsRows([])
  }

  const handlePasteImages = useCallback((event) => {
    const clipboardItems = Array.from(event.clipboardData?.items || [])
    if (!clipboardItems.length) return

    const pastedFiles = clipboardItems
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(Boolean)

    if (!pastedFiles.length) return

    event.preventDefault()

    const acceptedFiles = pastedFiles.filter(isAcceptedImageFile)
    if (!acceptedFiles.length) {
      setDropsError(t("hunts.errors.pasteOnly"))
      return
    }

    const normalizedFiles = acceptedFiles.map((file, index) => {
      if (file.name) return file

      const ext = String(file.type || "").toLowerCase() === "image/jpeg" ? "jpg" : "png"
      return new File([file], `colagem-${Date.now()}-${index}.${ext}`, {
        type: file.type,
        lastModified: Date.now(),
      })
    })

    setSelectedFiles((current) => {
      const next = [...current]

      for (const file of normalizedFiles) {
        const duplicate = next.some(
          (entry) =>
            entry.file.name === file.name
            && entry.file.lastModified === file.lastModified
            && entry.file.size === file.size,
        )

        if (duplicate) continue

        next.push({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })
      }

      return next
    })

    setDropsError(acceptedFiles.length !== pastedFiles.length ? t("hunts.errors.ignoredPaste") : "")
    setDropsWarnings([])
    setDropsResult(null)
    setDropsRows([])
  }, [t])

  useEffect(() => {
    if (!isNewHuntOpen) return undefined

    const handleWindowPaste = (event) => {
      const target = event.target
      const isEditableTarget = target instanceof HTMLElement
        && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)

      if (isEditableTarget) return
      handlePasteImages(event)
    }

    window.addEventListener("paste", handleWindowPaste)
    return () => window.removeEventListener("paste", handleWindowPaste)
  }, [handlePasteImages, isNewHuntOpen])

  function handleRemoveSelectedFile(fileId) {
    setSelectedFiles((current) => {
      const target = current.find((entry) => entry.id === fileId)
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
      }

      const next = current.filter((entry) => entry.id !== fileId)
      if (previewFile?.id === fileId) {
        setPreviewFile(null)
      }
      return next
    })
  }

  function handleClearSelectedFiles() {
    setSelectedFiles((current) => {
      for (const entry of current) {
        URL.revokeObjectURL(entry.previewUrl)
      }
      return []
    })
    setPreviewFile(null)
    setDropsWarnings([])
  }

  function handleResetDropsWorkspace() {
    setSelectedFiles((current) => {
      for (const entry of current) {
        URL.revokeObjectURL(entry.previewUrl)
      }
      return []
    })
    setPreviewFile(null)
    setDropsResult(null)
    setDropsRows([])
    setDropsWarnings([])
    setDropsError("")
    setSavingPriceMap({})
  }

  function normalizeRows(rows = []) {
    return rows.map((row, index) => {
      const quantity = Number(row.quantity || 0)
      const npcUnitPrice = Number(row.npc_unit_price || 0)
      const npcTotalPrice = Number(row.npc_total_price || npcUnitPrice * quantity)
      const playerUnitPrice = Number(row.player_unit_price || 0)

      return {
        id: row.id ?? index + 1,
        name: row.name_display || row.name || "",
        nameNormalized: row.name_normalized || row.name || "",
        quantity,
        npcUnitPrice,
        npcTotalPrice,
        playerUnitPrice,
        playerTotalPrice: playerUnitPrice * quantity,
      }
    })
  }

  function updateRowAt(index, patch) {
    setDropsRows((current) => {
      const next = [...current]
      const row = next[index]
      if (!row) return current

      const merged = { ...row, ...patch }
      merged.npcTotalPrice = merged.npcUnitPrice * merged.quantity
      merged.playerTotalPrice = merged.playerUnitPrice * merged.quantity
      next[index] = merged
      return next
    })
  }

  async function savePlayerPriceForRow(index) {
    const row = dropsRows[index]
    if (!row) return

    const key = `${row.nameNormalized}-${index}`
    setSavingPriceMap((prev) => ({ ...prev, [key]: true }))

    try {
      await apiRequest("/hunts/player-prices", {
        method: "PUT",
        body: JSON.stringify({
          item_name: row.name,
          player_unit_price: Number(row.playerUnitPrice || 0),
        }),
      })
    } catch (error) {
      setDropsError(error.message || t("hunts.errors.saveSalePrice"))
    } finally {
      setSavingPriceMap((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  async function handleProcessDrops() {
    if (!selectedFiles.length || isUploadingDrops) return

    setIsUploadingDrops(true)
    setDropsError("")
    setDropsWarnings([])
    setDropsResult(null)

    try {
      const formData = new FormData()

      if (activeCharacter?.id) {
        formData.append("character_id", String(activeCharacter.id))
      }

      for (const entry of selectedFiles) {
        formData.append("files", entry.file)
      }

      const token = getAccessToken()
      const response = await fetch(`${API_URL}/hunts/ocr/drops`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.detail || t("hunts.errors.processDrops"))
      }

      setDropsResult(payload)
      setDropsRows(normalizeRows(payload?.rows || []))
      setDropsWarnings(Array.isArray(payload?.warnings) ? payload.warnings : [])
    } catch (error) {
      setDropsError(error.message || t("hunts.errors.sendToOcr"))
      setDropsWarnings([])
    } finally {
      setIsUploadingDrops(false)
    }
  }

  return (
    <AppShell>
      <ConfirmActionModal
        open={Boolean(deleteSessionConfirm)}
        title={t("hunts.history.deleteConfirmTitle")}
        description={
          deleteSessionConfirm
            ? t("hunts.history.deleteConfirmDescription", {
                date: new Date(deleteSessionConfirm.hunt_date).toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            : ""
        }
        confirmLabel={t("hunts.history.deleteConfirmButton")}
        cancelLabel={t("common.cancel")}
        confirmTone="danger"
        isLoading={Boolean(deletingSessionId)}
        onCancel={() => {
          if (deletingSessionId) return
          setDeleteSessionConfirm(null)
        }}
        onConfirm={() => {
          if (!deleteSessionConfirm) return
          deleteSession(deleteSessionConfirm.id)
        }}
      />

      <Topbar />

      <section className="hunts-page">
        <div className="hunts-page__shell">
          <div className="hunts-page__header">
            <div className="hunts-page__header-copy">
              <h2 className="hunts-page__title">{t("hunts.title")}</h2>
            </div>

            <div className="hunts-page__header-actions">
              <button
                type="button"
                className={
                  isHistoryOpen
                    ? "hunts-page__ghost-button hunts-page__button--selected"
                    : "hunts-page__ghost-button"
                }
                onClick={() => setViewMode("history")}
              >
                {t("hunts.tabs.history")}
              </button>
              <button
                type="button"
                className={
                  isNewHuntOpen
                    ? "hunts-page__primary-button hunts-page__button--selected"
                    : "hunts-page__primary-button"
                }
                onClick={() => setViewMode("new-hunt")}
              >
                {t("hunts.tabs.new")}
              </button>
            </div>
          </div>

          {isHistoryOpen ? (
            <section className="hunts-page__history-panel">
              <div className="hunts-page__history-header">
                <div>
                  <h3 className="hunts-page__history-title">{t("hunts.history.title")}</h3>
                  <p className="hunts-page__history-subtitle">
                    {t("hunts.stats.last30Days")}
                  </p>
                </div>
                <div className="hunts-page__history-actions">
                  <label className="hunts-page__history-filter">
                    <span>{t("hunts.history.filterLabel")}</span>
                    <AppSelect
                      className="hunts-page__history-select"
                      value={historyRange}
                      options={[
                        { value: "all", label: t("hunts.history.filterAll") },
                        { value: "7", label: t("hunts.history.filter7") },
                        { value: "30", label: t("hunts.history.filter30") },
                        { value: "90", label: t("hunts.history.filter90") },
                      ]}
                      onChange={setHistoryRange}
                    />
                  </label>
                  <button
                    type="button"
                    className="hunts-page__ghost-button"
                    onClick={loadSessions}
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? t("common.loading") : t("hunts.history.refresh")}
                  </button>
                </div>
              </div>

              <div className="hunts-page__stats-grid hunts-page__stats-grid--history">
                {statCards.map((card, index) => (
                  <article
                    key={card.label}
                    className={
                      [
                        "hunts-page__stat-card",
                        "hunts-page__stat-card--compact",
                        index === statCards.length - 1 ? "hunts-page__stat-card--success" : "",
                      ].filter(Boolean).join(" ")
                    }
                  >
                    <span className="hunts-page__stat-label">{card.label}</span>
                    <strong className={card.valueClassName ? `hunts-page__stat-value ${card.valueClassName}` : "hunts-page__stat-value"}>{card.value}</strong>
                  </article>
                ))}
              </div>

              {chartData.length > 0 ? (
                <section className="hunts-page__charts-section hunts-page__charts-section--history">
                  <div className="hunts-page__charts-toolbar">
                    <span className="hunts-page__charts-toolbar-label">{t("hunts.chart.groupBy")}</span>
                    <div className="hunts-page__chart-switch" role="group" aria-label={t("hunts.chart.groupBy")}>
                      <button
                        type="button"
                        className={chartMode === "day" ? "hunts-page__chart-switch-button hunts-page__chart-switch-button--active" : "hunts-page__chart-switch-button"}
                        onClick={() => setChartMode("day")}
                      >
                        {t("hunts.chart.byDay")}
                      </button>
                      <button
                        type="button"
                        className={chartMode === "hunt" ? "hunts-page__chart-switch-button hunts-page__chart-switch-button--active" : "hunts-page__chart-switch-button"}
                        onClick={() => setChartMode("hunt")}
                      >
                        {t("hunts.chart.byHunt")}
                      </button>
                    </div>
                  </div>
                  <div className="hunts-page__chart-card">
                    <strong className="hunts-page__chart-title">
                      {chartMode === "day" ? t("hunts.chart.profitPerDay") : t("hunts.chart.profitPerHunt")}
                    </strong>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #2a2a3a)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "var(--chart-axis, #888)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => formatCompactValue(v, locale)}
                          tick={{ fontSize: 11, fill: "var(--chart-axis, #888)" }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            formatCompactValue(value, locale),
                            name === "npc" ? t("hunts.session.npc") : t("hunts.chart.sale"),
                          ]}
                          contentStyle={{
                            background: "var(--chart-tooltip-bg, #1a1a2e)",
                            border: "1px solid var(--chart-tooltip-border, #333)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "var(--chart-axis, #888)", marginBottom: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="npc"
                          stroke="var(--chart-line-npc, #7c6af5)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "var(--chart-line-npc, #7c6af5)" }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="venda"
                          stroke="var(--chart-line-venda, #3ec97c)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "var(--chart-line-venda, #3ec97c)" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="hunts-page__chart-legend">
                      <span className="hunts-page__chart-legend-item hunts-page__chart-legend-item--npc">{t("hunts.session.npc")}</span>
                      <span className="hunts-page__chart-legend-item hunts-page__chart-legend-item--venda">{t("hunts.chart.sale")}</span>
                    </div>
                  </div>

                  <div className="hunts-page__chart-card">
                    <strong className="hunts-page__chart-title">
                      {chartMode === "day" ? t("hunts.chart.durationPerDay") : t("hunts.chart.durationPerHunt")}
                    </strong>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #2a2a3a)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "var(--chart-axis, #888)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `${v}m`}
                          tick={{ fontSize: 11, fill: "var(--chart-axis, #888)" }}
                          tickLine={false}
                          axisLine={false}
                          width={36}
                        />
                        <Tooltip
                          formatter={(value) => [`${value} min`, t("hunts.chart.duration")]}
                          contentStyle={{
                            background: "var(--chart-tooltip-bg, #1a1a2e)",
                            border: "1px solid var(--chart-tooltip-border, #333)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "var(--chart-axis, #888)", marginBottom: 4 }}
                        />
                        <Bar
                          dataKey="duracao"
                          fill="var(--chart-bar, #7c6af5)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : null}

              {isLoadingHistory && huntSessions.length === 0 ? (
                <div className="hunts-page__history-placeholder">
                  <p className="hunts-page__history-placeholder-copy">{t("hunts.history.loadingSessions")}</p>
                </div>
              ) : filteredHistorySessions.length === 0 ? (
                <div className="hunts-page__history-placeholder">
                  <strong className="hunts-page__history-placeholder-title">{t("hunts.history.emptyTitle")}</strong>
                  <p className="hunts-page__history-placeholder-copy">
                    {t("hunts.history.emptyDescription")}
                  </p>
                </div>
              ) : (
                <div className="hunts-page__session-list">
                  {pagedHistorySessions.map((session) => {
                    const isExpanded = expandedSessionId === session.id
                    return (
                      <article key={session.id} className="hunts-page__session-card">
                        <div className="hunts-page__session-row">
                          <div className="hunts-page__session-info">
                            <span className="hunts-page__session-date">
                              {new Date(session.hunt_date).toLocaleDateString(locale, {
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                            {session.duration_minutes ? (
                              <span className="hunts-page__session-badge">
                                {formatHoursAndMinutes(session.duration_minutes)}
                              </span>
                            ) : null}
                            {session.total_enemies > 0 ? (
                              <span className="hunts-page__session-badge hunts-page__session-badge--enemies">
                                {t("hunts.history.enemiesCount", { count: formatCompactNumber(session.total_enemies, locale) })}
                              </span>
                            ) : null}
                          </div>
                          <div className="hunts-page__session-values">
                            <span className="hunts-page__session-label">{t("hunts.session.npc")}</span>
                            <strong className="hunts-page__session-value">{formatCompactDlValue(session.total_npc_value, locale)}</strong>
                            <span className="hunts-page__session-label">{t("hunts.session.sale")}</span>
                            <strong className="hunts-page__session-value hunts-page__session-value--player">{formatCompactDlValue(session.total_player_value, locale)}</strong>
                            {(() => {
                              const consumableCost = (session.consumables_json || []).reduce((acc, c) => acc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
                              return consumableCost > 0 ? (
                                <>
                                  <span className="hunts-page__session-label">{t("hunts.session.supply")}</span>
                                  <strong className="hunts-page__session-value hunts-page__session-value--negative">-{formatCompactDlValue(consumableCost, locale)}</strong>
                                </>
                              ) : null
                            })()}
                            {(() => {
                              const sessionProfit = (session.total_player_value || 0) - (session.total_npc_value || 0)
                              const consumableCost = (session.consumables_json || []).reduce((acc, c) => acc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
                              const netProfit = sessionProfit - consumableCost
                              return (
                                <>
                                  <span className="hunts-page__session-label">{t("hunts.session.profit")}</span>
                                  <strong className={netProfit >= 0 ? "hunts-page__session-value hunts-page__session-value--positive" : "hunts-page__session-value hunts-page__session-value--negative"}>
                                    {netProfit >= 0 ? "+" : "-"}{formatCompactDlValue(Math.abs(netProfit), locale)}
                                  </strong>
                                </>
                              )
                            })()}
                          </div>
                          <div className="hunts-page__session-actions">
                            <button
                              type="button"
                              className="hunts-page__ghost-button hunts-page__session-action-btn"
                              onClick={() => loadSessionDetail(session.id)}
                            >
                              {isExpanded ? t("hunts.history.hide") : t("hunts.history.details")}
                            </button>
                            <button
                              type="button"
                              className="hunts-page__session-delete-btn"
                              onClick={() => setDeleteSessionConfirm(session)}
                              disabled={deletingSessionId === session.id}
                              title={t("hunts.history.delete")}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="hunts-page__session-detail">
                            {isLoadingDetail && sessionDetail?.id !== session.id ? (
                              <p className="hunts-page__history-subtitle">{t("hunts.history.loadingDetails")}</p>
                            ) : sessionDetail?.id === session.id ? (
                              <>
                                {sessionDetail.notes ? (
                                  <p className="hunts-page__session-notes">{sessionDetail.notes}</p>
                                ) : null}

                                {sessionDetail.enemies_json?.length > 0 ? (
                                  <div className="hunts-page__session-detail-block">
                                    <strong className="hunts-page__session-detail-title">{t("hunts.session.enemiesDefeated")}</strong>
                                    <div className="hunts-page__session-enemies-list">
                                      {sessionDetail.enemies_json.map((e, i) => (
                                        <span key={i} className="hunts-page__session-enemy-chip">
                                          {e.name.replace(/^\d{4} - /, "")} &times; {formatCompactNumber(e.quantity, locale)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}


                                {sessionDetail.consumables_json?.length > 0 ? (
                                  <div className="hunts-page__session-detail-block">
                                    <strong className="hunts-page__session-detail-title">{t("hunts.session.consumables")}</strong>
                                    <ul className="hunts-page__enemy-list">
                                      {sessionDetail.consumables_json.map((c, i) => {
                                        const total = (c.preco_npc || 0) * (c.quantity || 0)
                                        return (
                                          <li key={i} className="hunts-page__enemy-row">
                                            <span className="hunts-page__enemy-name">{c.name}</span>
                                            <span className="hunts-page__session-badge">&times; {formatCompactNumber(c.quantity, locale)}</span>
                                            {total > 0 ? (
                                              <span className="hunts-page__consumable-total">{formatCompactDlValue(total, locale)}</span>
                                            ) : null}
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  </div>
                                ) : null}
                                {sessionDetail.drops_json?.length > 0 ? (
                                  <div className="hunts-page__session-detail-block">
                                    <strong className="hunts-page__session-detail-title">{t("hunts.session.drops")}</strong>
                                    <div className="hunts-page__drops-table-wrap">
                                      <table className="hunts-page__drops-table">
                                        <thead>
                                          <tr>
                                            <th>{t("hunts.table.qtyItem")}</th>
                                            <th>{t("hunts.table.npcTotal")}</th>
                                            <th>{t("hunts.table.saleTotal")}</th>
                                            <th>{t("hunts.table.itemProfit")}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sessionDetail.drops_json.map((d, i) => (
                                            <tr key={i}>
                                              <td>
                                                <span className="hunts-page__item-inline">
                                                  <strong>{formatCompactNumber(d.quantity || 0, locale)}x</strong>
                                                  <span className="hunts-page__item-name">{d.name || "?"}</span>
                                                </span>
                                              </td>
                                              <td>{d.npcTotalPrice ? formatCompactDlValue(d.npcTotalPrice, locale) : <span className="hunts-page__no-price">—</span>}</td>
                                              <td>{d.playerTotalPrice ? formatCompactDlValue(d.playerTotalPrice, locale) : <span className="hunts-page__no-price">—</span>}</td>
                                              <td>
                                                {(() => {
                                                  const itemProfit = Number(d.playerTotalPrice || 0) - Number(d.npcTotalPrice || 0)
                                                  return (
                                                    <span className={itemProfit >= 0 ? "hunts-page__delta-pill hunts-page__delta-pill--positive" : "hunts-page__delta-pill hunts-page__delta-pill--negative"}>
                                                      {itemProfit >= 0 ? "+" : "-"}
                                                      {formatCompactDlValue(Math.abs(itemProfit), locale)}
                                                    </span>
                                                  )
                                                })()}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                  <div className="hunts-page__history-pagination">
                    <button
                      type="button"
                      className="hunts-page__ghost-button"
                      onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={historyPage <= 1}
                    >
                      {t("hunts.history.prev")}
                    </button>
                    <span className="hunts-page__history-page">
                      {t("hunts.history.page", { page: historyPage, total: historyTotalPages })}
                    </span>
                    <button
                      type="button"
                      className="hunts-page__ghost-button"
                      onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))}
                      disabled={historyPage >= historyTotalPages}
                    >
                      {t("hunts.history.next")}
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {isNewHuntOpen ? (
            <section className="hunts-page__history-panel">
              <div className="hunts-page__history-header">
                <div>
                  <h3 className="hunts-page__history-title">{t("hunts.new.title")}</h3>
                </div>
              </div>

              <div className="hunts-page__upload-box">
                <div className="hunts-page__upload-header">
                  <label className="hunts-page__upload-label" htmlFor="hunts-drops-upload">
                    {t("hunts.new.uploadLabel")}
                  </label>

                  <button
                    type="button"
                    className="hunts-page__ghost-button hunts-page__upload-example-button"
                    onClick={() => setIsExampleModalOpen(true)}
                  >
                    {t("hunts.new.viewExample")}
                  </button>
                </div>

                <input
                  id="hunts-drops-upload"
                  className="hunts-page__upload-input"
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleSelectFiles}
                />

                <label className="hunts-page__dropzone" htmlFor="hunts-drops-upload">
                  <span className="hunts-page__dropzone-icon" aria-hidden="true">↑</span>
                  <strong className="hunts-page__dropzone-title">
                    {t("hunts.new.dropzoneTitle")}
                  </strong>
                  <span className="hunts-page__dropzone-copy">
                    {t("hunts.new.dropzoneCopy")}
                  </span>
                  <span className="hunts-page__dropzone-action">{t("hunts.new.chooseFiles")}</span>
                </label>

                {selectedFiles.length ? (
                  <>
                    <div className="hunts-page__file-toolbar">
                      <span className="hunts-page__file-toolbar-label">{t("hunts.new.previews")}</span>
                      <button
                        type="button"
                        className="hunts-page__ghost-button hunts-page__file-clear"
                        onClick={handleClearSelectedFiles}
                      >
                        {t("hunts.new.removeAll")}
                      </button>
                    </div>

                    <div className="hunts-page__file-grid" role="status" aria-live="polite">
                      {selectedFiles.map((entry) => {
                        const isFlagged = flaggedFileIds.has(entry.id)
                        return (
                        <article
                          key={entry.id}
                          className={`hunts-page__file-card${isFlagged ? " hunts-page__file-card--warning" : ""}`}
                        >
                          <button
                            type="button"
                            className="hunts-page__file-preview"
                            onClick={() => setPreviewFile(entry)}
                            title={t("hunts.new.previewHint")}
                          >
                            <Image
                              src={entry.previewUrl}
                              alt={entry.file.name}
                              className="hunts-page__file-preview-image"
                              width={320}
                              height={200}
                              loading="lazy"
                              unoptimized
                            />
                          </button>

                          <div className="hunts-page__file-meta">
                            <div className="hunts-page__file-meta-main">
                              <span className="hunts-page__file-name" title={entry.file.name}>{entry.file.name}</span>
                              {isFlagged ? (
                                <span className="hunts-page__file-badge" role="status">
                                  Revisar OCR
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="hunts-page__file-remove"
                              onClick={() => handleRemoveSelectedFile(entry.id)}
                            >
                              {t("common.remove")}
                            </button>
                          </div>
                        </article>
                      )})}
                    </div>
                  </>
                ) : null}

                <div className="hunts-page__ocr-actions">
                  <button
                    type="button"
                    className="hunts-page__primary-button hunts-page__process-button"
                    disabled={!selectedFiles.length || isUploadingDrops}
                    onClick={handleProcessDrops}
                  >
                    {isUploadingDrops ? t("hunts.new.processing") : t("hunts.new.process")}
                  </button>

                  <button
                    type="button"
                    className="hunts-page__ghost-button hunts-page__process-button"
                    disabled={isUploadingDrops || (!selectedFiles.length && !dropsResult && !dropsRows.length && !dropsWarnings.length && !dropsError)}
                    onClick={handleResetDropsWorkspace}
                  >
                    {t("hunts.new.clear")}
                  </button>
                </div>

                {dropsError ? (
                  <p className="hunts-page__upload-error" role="alert">
                    {dropsError}
                  </p>
                ) : null}

                {dropsResult?.summary ? (
                  <div className="hunts-page__ocr-summary">
                    <strong className="hunts-page__ocr-summary-title">{t("hunts.new.ocrResult")}</strong>
                    <div className="hunts-page__ocr-summary-grid">
                      <span>{t("hunts.new.summaryImages")}: {dropsResult.summary.processed_images ?? 0}</span>
                      <span>{t("hunts.new.summaryLines")}: {dropsResult.summary.recognized_lines ?? 0}</span>
                      <span>{t("hunts.new.summaryDuplicates")}: {dropsResult.summary.duplicates_ignored ?? 0}</span>
                      <span>{t("hunts.new.summaryFinalDrops")}: {dropsResult.summary.final_rows ?? 0}</span>
                    </div>
                  </div>
                ) : null}

                {dropsWarnings.length ? (
                  <p className="hunts-page__upload-error" role="status">
                    {dropsWarnings.join(" | ")}
                  </p>
                ) : null}

                {dropsRows.length ? (
                  <div className="hunts-page__drops-table-wrap">
                    <table className="hunts-page__drops-table">
                      <thead>
                        <tr>
                          <th>{t("hunts.table.qtyItem")}</th>
                          <th>{t("hunts.table.npcPrice")}</th>
                          <th>{t("hunts.table.salePrice")}</th>
                          <th>{t("hunts.table.npcTotal")}</th>
                          <th>{t("hunts.table.saleTotal")}</th>
                          <th>{t("hunts.table.itemProfit")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dropsRows.map((row, index) => {
                          const savingKey = `${row.nameNormalized}-${index}`
                          const isSaving = Boolean(savingPriceMap[savingKey])
                          const effectivePlayerTotal = Number(row.playerUnitPrice || 0) > 0
                            ? Number(row.playerTotalPrice || 0)
                            : Number(row.npcTotalPrice || 0)
                          const profitDelta = Math.max(0, effectivePlayerTotal - Number(row.npcTotalPrice || 0))
                          const hasNpcReference = Number(row.npcUnitPrice || 0) > 0
                          const profitClassName = "hunts-page__delta-pill hunts-page__delta-pill--positive"

                          return (
                            <tr key={`${row.nameNormalized}-${index}`}>
                              <td>
                                <div className="hunts-page__item-inline hunts-page__item-inline--editable">
                                  <input
                                    className="hunts-page__table-input hunts-page__table-input--qty"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={row.quantity}
                                    onChange={(event) => {
                                      updateRowAt(index, {
                                        quantity: Math.max(0, Number(event.target.value || 0)),
                                      })
                                    }}
                                  />
                                  <span className="hunts-page__item-name">{row.name}</span>
                                </div>
                              </td>
                              <td>{row.npcUnitPrice ? formatCompactDlValue(row.npcUnitPrice, locale) : <span className="hunts-page__no-price">—</span>}</td>
                              <td>
                                <input
                                  className="hunts-page__table-input"
                                  type="text"
                                  inputMode="decimal"
                                  value={String(row.playerUnitPrice).replace(".", ",")}
                                  onChange={(event) => {
                                    updateRowAt(index, {
                                      playerUnitPrice: Math.max(0, parseDecimalInput(event.target.value)),
                                    })
                                  }}
                                  onBlur={() => savePlayerPriceForRow(index)}
                                />
                                {isSaving ? <span className="hunts-page__saving-pill">{t("tasks.saving")}</span> : null}
                              </td>
                              <td>{row.npcTotalPrice ? formatCompactDlValue(row.npcTotalPrice, locale) : <span className="hunts-page__no-price">—</span>}</td>
                              <td>
                                <div className="hunts-page__total-sale-cell">
                                  <span>{formatCompactDlValue(effectivePlayerTotal, locale)}</span>
                                  {hasNpcReference ? (
                                    <span className={profitClassName}>
                                      +{formatCompactDlValue(profitDelta, locale)}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                {hasNpcReference ? (
                                  <span className={profitClassName}>
                                    +{formatCompactDlValue(profitDelta, locale)}
                                  </span>
                                ) : <span className="hunts-page__no-price">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              <div className="hunts-page__hunt-save-section">
                <div className="hunts-page__hunt-meta">
                  <div className="hunts-page__hunt-meta-row">
                    <label className="hunts-page__upload-label" htmlFor="hunt-duration">
                      {t("hunts.new.durationMinutes")}
                    </label>
                    <input
                      id="hunt-duration"
                      className="hunts-page__table-input"
                      type="number"
                      min="0"
                      placeholder={t("hunts.new.durationPlaceholder")}
                      value={huntDuration}
                      onChange={(e) => setHuntDuration(e.target.value)}
                    />
                  </div>
                  <div className="hunts-page__hunt-meta-row">
                    <label className="hunts-page__upload-label" htmlFor="hunt-notes">
                      {t("hunts.new.notes")}
                    </label>
                    <textarea
                      id="hunt-notes"
                      className="hunts-page__hunt-notes-input"
                      placeholder={t("hunts.new.notesPlaceholder")}
                      value={huntNotes}
                      onChange={(e) => setHuntNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="hunts-page__enemies-section">
                  <strong className="hunts-page__upload-label">{t("hunts.new.enemiesDefeated")}</strong>
                  <div className="hunts-page__enemy-search-wrap">
                    <input
                      className="hunts-page__table-input"
                      type="text"
                      placeholder={t("hunts.new.enemySearch")}
                      value={enemySearch}
                      onChange={(e) => {
                        setEnemySearch(e.target.value)
                        setShowEnemySuggestions(true)
                      }}
                      onFocus={() => setShowEnemySuggestions(true)}
                      onBlur={() => setTimeout(() => setShowEnemySuggestions(false), 150)}
                    />
                    {showEnemySuggestions && enemySearch.length >= 1 ? (
                      <ul className="hunts-page__enemy-suggestions">
                        {allEnemies
                          .filter((name) => name.toLowerCase().includes(enemySearch.toLowerCase()))
                          .slice(0, 8)
                          .map((name) => (
                            <li key={name}>
                              <button
                                type="button"
                                className="hunts-page__enemy-suggestion-btn"
                                onMouseDown={() => addEnemy(name)}
                              >
                                  {name.replace(/^\d{4} - /, "")}
                              </button>
                            </li>
                            ))}
                      </ul>
                    ) : null}
                  </div>
                  {enemyList.length > 0 ? (
                    <ul className="hunts-page__enemy-list">
                      {enemyList.map((enemy, index) => (
                        <li key={index} className="hunts-page__enemy-row">
                          <span className="hunts-page__enemy-name">{enemy.name.replace(/^\d{4} - /, "")}</span>
                          <input
                            className="hunts-page__table-input hunts-page__table-input--qty"
                            type="number"
                            min="1"
                            step="1"
                            value={enemy.quantity}
                            onChange={(e) => updateEnemyQty(index, e.target.value)}
                          />
                          <button
                            type="button"
                            className="hunts-page__session-delete-btn"
                            onClick={() => removeEnemy(index)}
                            title={t("common.remove")}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hunts-page__enemy-empty">{t("hunts.new.noEnemies")}</p>
                  )}
                </div>


                <div className="hunts-page__enemies-section">
                  <div className="hunts-page__consumable-header">
                    <button
                      type="button"
                      className="hunts-page__ghost-button"
                      onClick={() => setIsConsumableModalOpen(true)}
                    >
                      {t("hunts.new.consumables")}
                      {consumableList.length > 0 ? (
                        <span className="hunts-page__consumable-badge"> ({consumableList.length})</span>
                      ) : null}
                    </button>
                    {consumableList.length > 0 ? (() => {
                      const totalCost = consumableList.reduce((acc, c) => acc + c.preco_npc * c.quantity, 0)
                      return totalCost > 0 ? (
                        <span className="hunts-page__consumable-summary-inline">
                          {t("hunts.session.supply")}: <strong>{formatCompactDlValue(totalCost, locale)}</strong>
                        </span>
                      ) : null
                    })() : null}
                  </div>

                  {dropsRows.length > 0 ? (
                    <div className="hunts-page__profit-row">
                      <span className="hunts-page__upload-label">{t("hunts.new.expectedProfitLabel")}</span>
                      <span>
                        <span className="hunts-page__profit-label">{t("hunts.session.npc").toLowerCase()}</span>
                        <strong className={currentExpectedProfit.npc >= 0 ? "hunts-page__profit-value hunts-page__profit-value--positive" : "hunts-page__profit-value hunts-page__profit-value--negative"}>
                          {currentExpectedProfit.npc >= 0 ? "+" : "-"}{formatCompactDlValue(Math.abs(currentExpectedProfit.npc), locale)}
                        </strong>
                      </span>
                      <span>
                        <span className="hunts-page__profit-label">{t("hunts.session.player").toLowerCase()}</span>
                        <strong className="hunts-page__profit-value hunts-page__profit-value--positive">
                          +{formatCompactDlValue(currentExpectedProfit.player, locale)}
                        </strong>
                      </span>
                    </div>
                  ) : null}
                </div>
                {huntSaveError ? (
                  <p className="hunts-page__upload-error" role="alert">{huntSaveError}</p>
                ) : null}
                {huntSaved ? (
                  <p className="hunts-page__hunt-saved-msg" role="status">{t("hunts.new.huntSaved")}</p>
                ) : null}

                <button
                  type="button"
                  className="hunts-page__primary-button"
                  onClick={saveHunt}
                  disabled={isSavingHunt}
                >
                  {isSavingHunt ? t("tasks.saving") : t("hunts.new.saveHunt")}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      {isConsumableModalOpen ? (
        <div className="hunts-page__preview-backdrop" role="dialog" aria-modal="true" onClick={() => setIsConsumableModalOpen(false)}>
          <div className="hunts-page__preview-modal hunts-page__consumables-modal" onClick={(event) => event.stopPropagation()}>
            <div className="hunts-page__preview-header">
              <strong className="hunts-page__preview-title">{t("hunts.new.usedConsumables")}</strong>
              <button
                type="button"
                className="hunts-page__ghost-button hunts-page__preview-close"
                onClick={() => setIsConsumableModalOpen(false)}
              >
                {t("common.close")}
              </button>
            </div>

            <div className="hunts-page__consumables-toolbar">
              <AppSelect
                className="hunts-page__consumables-select"
                value={selectedConsumableCategory}
                options={[
                  { value: "", label: t("hunts.new.allCategories") },
                  ...consumableCategories.map((category) => ({ value: category, label: category })),
                ]}
                onChange={setSelectedConsumableCategory}
              />
              {selectedConsumableCategory ? (
                <button
                  type="button"
                  className="hunts-page__ghost-button"
                  onClick={() => setSelectedConsumableCategory("")}
                >
                  {t("hunts.new.clearFilter")}
                </button>
              ) : null}
            </div>

            <div className="hunts-page__enemy-search-wrap">
              <input
                className="hunts-page__table-input"
                type="text"
                placeholder={t("hunts.new.consumableSearch")}
                value={consumableSearch}
                onChange={(e) => {
                  setConsumableSearch(e.target.value)
                  setShowConsumableSuggestions(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addConsumableFromInput()
                  }
                }}
                onFocus={() => setShowConsumableSuggestions(true)}
                onBlur={() => setTimeout(() => setShowConsumableSuggestions(false), 150)}
              />
              <button
                type="button"
                className="hunts-page__ghost-button hunts-page__consumable-add-btn"
                onMouseDown={(e) => {
                  e.preventDefault()
                  addConsumableFromInput()
                }}
                disabled={!filteredConsumables.length}
              >
                {t("hunts.new.addConsumable")}
              </button>
              {showConsumableSuggestions && filteredConsumables.length > 0 ? (
                <ul className="hunts-page__enemy-suggestions">
                  {filteredConsumables.map((item) => {
                    const consumableName = getConsumableName(item)
                    return (
                      <li key={consumableName}>
                        <button
                          type="button"
                          className="hunts-page__enemy-suggestion-btn"
                          onMouseDown={() => addConsumable(item)}
                        >
                          <span className="hunts-page__consumable-suggestion-main">
                            <span>{consumableName}</span>
                            {getConsumableCategory(item) ? (
                              <span className="hunts-page__consumable-chip">{getConsumableCategory(item)}</span>
                            ) : null}
                          </span>
                          {item.preco_npc > 0 ? <span className="hunts-page__consumable-price">{formatCompactDlValue(item.preco_npc, locale)} / {t("hunts.new.unitShort")}</span> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>

            {consumableList.length > 0 ? (
              <ul className="hunts-page__enemy-list">
                {consumableList.map((item, index) => {
                  const totalCost = item.preco_npc * item.quantity
                  return (
                    <li key={index} className="hunts-page__enemy-row">
                      <span className="hunts-page__enemy-name">
                        {item.name}
                        {item.categoria ? <span className="hunts-page__consumable-inline-category">{item.categoria}</span> : null}
                      </span>
                      <input
                        className="hunts-page__table-input hunts-page__table-input--qty"
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateConsumableQty(index, e.target.value)}
                      />
                      {item.preco_npc > 0 ? (
                        <span className="hunts-page__consumable-total">={formatCompactDlValue(totalCost, locale)}</span>
                      ) : null}
                      <button
                        type="button"
                        className="hunts-page__session-delete-btn"
                        onClick={() => removeConsumable(index)}
                        title={t("common.remove")}
                      >
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="hunts-page__enemy-empty">{t("hunts.new.noConsumables")}</p>
            )}
          </div>
        </div>
      ) : null}

      {isExampleModalOpen ? (
        <div
          className="hunts-page__preview-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsExampleModalOpen(false)}
        >
          <div
            className="hunts-page__preview-modal hunts-page__example-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hunts-page__preview-header">
              <strong className="hunts-page__preview-title">{t("hunts.example.title")}</strong>
              <button
                type="button"
                className="hunts-page__ghost-button hunts-page__preview-close"
                onClick={() => setIsExampleModalOpen(false)}
              >
                {t("common.close")}
              </button>
            </div>

            <div className="hunts-page__example-body">
              <Image
                className="hunts-page__example-image"
                src="/hunt-ocr-example.svg"
                alt={t("hunts.example.alt")}
                width={1280}
                height={720}
                unoptimized
              />

              <ul className="hunts-page__example-rules">
                {ocrExampleRules.map((rule) => (
                  <li key={rule} className="hunts-page__example-rule">
                    <span className="hunts-page__example-check" aria-hidden="true">✓</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {previewFile ? (
        <div
          className="hunts-page__preview-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="hunts-page__preview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hunts-page__preview-header">
              <strong className="hunts-page__preview-title">{previewFile.file.name}</strong>
              <button
                type="button"
                className="hunts-page__ghost-button hunts-page__preview-close"
                onClick={() => setPreviewFile(null)}
              >
                {t("common.close")}
              </button>
            </div>
            <Image
              className="hunts-page__preview-image"
              src={previewFile.previewUrl}
              alt={t("hunts.preview.alt", { name: previewFile.file.name })}
              width={1600}
              height={1000}
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}

