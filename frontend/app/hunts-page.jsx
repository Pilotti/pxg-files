import { useEffect, useMemo, useState } from "react"
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
import Topbar from "../components/topbar.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { apiRequest } from "../services/api.js"
import { API_URL, getAccessToken } from "../services/session-manager.js"
import "../styles/hunts-page.css"

function formatCompactNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value)
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

function formatCompactDlValue(value) {
  const numeric = Number(value || 0)
  const floorToSingleDecimal = (amount) => Math.floor(amount * 10) / 10

  if (!Number.isFinite(numeric)) {
    return "0 dl"
  }

  const absolute = Math.abs(numeric)
  if (absolute >= 1_000) {
    const magnitude = Math.floor(Math.log10(absolute) / 3)
    const divisor = 1000 ** magnitude
    const compact = floorToSingleDecimal(numeric / divisor)
    const suffix = "k".repeat(magnitude)
    return `${String(compact).replace(/\.0$/, "")}${suffix}`
  }

  const compact = Number.isInteger(numeric) ? String(numeric) : String(floorToSingleDecimal(numeric)).replace(/\.0$/, "")
  return `${compact} dl`
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
  const [viewMode, setViewMode] = useState("overview")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewFile, setPreviewFile] = useState(null)
  const [isUploadingDrops, setIsUploadingDrops] = useState(false)
  const [dropsResult, setDropsResult] = useState(null)
  const [dropsRows, setDropsRows] = useState([])
  const [dropsWarnings, setDropsWarnings] = useState([])
  const [savingPriceMap, setSavingPriceMap] = useState({})
  const [dropsError, setDropsError] = useState("")

  // Hunt metadata
  const [huntDuration, setHuntDuration] = useState("")
  const [huntNotes, setHuntNotes] = useState("")

  // Enemies autocomplete
  const [allEnemies, setAllEnemies] = useState([])
  const [enemySearch, setEnemySearch] = useState("")
  const [enemyList, setEnemyList] = useState([])
  const [showEnemySuggestions, setShowEnemySuggestions] = useState(false)

  // Consumables autocomplete
  const [allConsumables, setAllConsumables] = useState([])
  const [consumableSearch, setConsumableSearch] = useState("")
  const [consumableList, setConsumableList] = useState([])
  const [showConsumableSuggestions, setShowConsumableSuggestions] = useState(false)
  const [isConsumableModalOpen, setIsConsumableModalOpen] = useState(false)
  const [selectedConsumableCategory, setSelectedConsumableCategory] = useState("")

  // Save / history
  const [isSavingHunt, setIsSavingHunt] = useState(false)
  const [huntSaveError, setHuntSaveError] = useState("")
  const [huntSaved, setHuntSaved] = useState(false)
  const [huntSessions, setHuntSessions] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  const [sessionDetail, setSessionDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const summary = useMemo(() => {
    const totalHunts = huntSessions.length
    const totalMinutes = huntSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
    const totalNpcValue = huntSessions.reduce((acc, s) => acc + (s.total_npc_value || 0), 0)
    const totalPlayerValue = huntSessions.reduce((acc, s) => acc + (s.total_player_value || 0), 0)
    const averageNpcPerHour = totalMinutes > 0 ? Math.round((totalNpcValue / totalMinutes) * 60) : 0
    const averagePlayerPerHour = totalMinutes > 0 ? Math.round((totalPlayerValue / totalMinutes) * 60) : 0
    const expectedNpcProfit = huntSessions.reduce((acc, s) => {
      const consumableCost = (s.consumables_json || []).reduce((cAcc, c) => cAcc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
      return acc + (s.total_npc_value || 0) - consumableCost
    }, 0)
    const expectedPlayerProfit = huntSessions.reduce((acc, s) => {
      const playerValue = s.total_player_value || 0
      const npcValue = s.total_npc_value || 0
      const effectiveValue = playerValue > 0 ? playerValue : npcValue
      const consumableCost = (s.consumables_json || []).reduce((cAcc, c) => cAcc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
      return acc + Math.max(0, effectiveValue - consumableCost)
    }, 0)
    return { totalHunts, totalMinutes, averageNpcPerHour, averagePlayerPerHour, expectedNpcProfit, expectedPlayerProfit }
  }, [huntSessions])

  const chartData = useMemo(() => {
    const sorted = [...huntSessions]
      .sort((a, b) => new Date(a.hunt_date) - new Date(b.hunt_date))
      .slice(-20)
    return sorted.map((s, index) => ({
      label: new Date(s.hunt_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      index: index + 1,
      npc: Math.round(s.total_npc_value || 0),
      venda: Math.round(s.total_player_value || 0),
      duracao: s.duration_minutes || 0,
    }))
  }, [huntSessions])

  const statCards = [
    {
      label: "Hunts",
      value: formatCompactNumber(summary.totalHunts),
      helper: "Sessões do personagem ativo.",
    },
    {
      label: "Horas caçadas",
      value: formatHoursAndMinutes(summary.totalMinutes),
      helper: "Tempo total em hunts fechadas.",
    },
    {
      label: "Média por hora",
      value: (
        <div className="hunts-page__stat-split-value">
          <span className="hunts-page__stat-split-line">npc: {formatCompactNumber(summary.averageNpcPerHour)} gp</span>
          <span className="hunts-page__stat-split-line hunts-page__stat-split-line--player">player: {formatCompactNumber(summary.averagePlayerPerHour)} gp</span>
        </div>
      ),
      helper: "Comparativo de npc e player.",
      valueClassName: "hunts-page__stat-value--split",
    },
    {
      label: "Lucro esperado",
      value: (
        <div className="hunts-page__stat-split-value">
          <span className="hunts-page__stat-split-line">npc: {formatCompactDlValue(summary.expectedNpcProfit)}</span>
          <span className="hunts-page__stat-split-line hunts-page__stat-split-line--player">player: {formatCompactDlValue(summary.expectedPlayerProfit)}</span>
        </div>
      ),
      helper: "Lucro NPC e player (descontado supply).",
      valueClassName: "hunts-page__stat-value--split",
    },
  ]

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
    return values.sort((left, right) => left.localeCompare(right, "pt-BR"))
  }, [allConsumables])

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
  const isCompactView = viewMode !== "overview"

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
  }, [isNewHuntOpen])

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
    setIsSavingHunt(true)
    setHuntSaveError("")
    setHuntSaved(false)
    try {
      const body = {
        character_id: activeCharacter?.id || null,
        duration_minutes: huntDuration ? parseInt(huntDuration, 10) : null,
        notes: huntNotes || null,
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
      setHuntSaveError(error.message || "Erro ao salvar hunt.")
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
    try {
      await apiRequest(`/hunts/sessions/${id}`, { method: "DELETE" })
      setHuntSessions((prev) => prev.filter((s) => s.id !== id))
      if (expandedSessionId === id) {
        setExpandedSessionId(null)
        setSessionDetail(null)
      }
    } catch {
      // ignored
    }
  }

  function handleSelectFiles(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const acceptedFiles = files.filter(isAcceptedImageFile)
    const rejectedCount = files.length - acceptedFiles.length

    if (!acceptedFiles.length) {
      setDropsError("Envie apenas imagens JPG ou PNG.")
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
    setDropsError(rejectedCount > 0 ? "Alguns arquivos foram ignorados. Apenas JPG ou PNG sao permitidos." : "")
    setDropsWarnings([])
    setDropsResult(null)
    setDropsRows([])
  }

  function handlePasteImages(event) {
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
      setDropsError("A colagem aceita apenas imagens JPG ou PNG.")
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

    setDropsError(acceptedFiles.length !== pastedFiles.length ? "Alguns itens colados foram ignorados. Apenas JPG ou PNG sao permitidos." : "")
    setDropsWarnings([])
    setDropsResult(null)
    setDropsRows([])
  }

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
      setDropsError(error.message || "Nao foi possivel salvar o preco de venda.")
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
        throw new Error(payload?.detail || "Nao foi possivel processar os drops.")
      }

      setDropsResult(payload)
      setDropsRows(normalizeRows(payload?.rows || []))
      setDropsWarnings(Array.isArray(payload?.warnings) ? payload.warnings : [])
    } catch (error) {
      setDropsError(error.message || "Erro ao enviar imagens para OCR.")
      setDropsWarnings([])
    } finally {
      setIsUploadingDrops(false)
    }
  }

  return (
    <AppShell>
      <Topbar />

      <section className="hunts-page">
        <div className="hunts-page__shell">
          <div className="hunts-page__header">
            <div className="hunts-page__header-copy">
              <h2 className="hunts-page__title">Hunts</h2>
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
                Histórico
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
                Nova Hunt
              </button>
            </div>
          </div>

          <div
            className={
              isCompactView
                ? "hunts-page__stats-grid hunts-page__stats-grid--history"
                : "hunts-page__stats-grid"
            }
          >
            {statCards.map((card, index) => (
              <article
                key={card.label}
                className={
                  [
                    "hunts-page__stat-card",
                    index === statCards.length - 1 ? "hunts-page__stat-card--success" : "",
                    isCompactView ? "hunts-page__stat-card--compact" : "",
                  ].filter(Boolean).join(" ")
                }
              >
                <span className="hunts-page__stat-label">{card.label}</span>
                <strong className={card.valueClassName ? `hunts-page__stat-value ${card.valueClassName}` : "hunts-page__stat-value"}>{card.value}</strong>
              </article>
            ))}
          </div>

          {!isCompactView && chartData.length >= 2 ? (
            <section className="hunts-page__charts-section">
              <div className="hunts-page__chart-card">
                <strong className="hunts-page__chart-title">Lucro por sessão</strong>
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
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: "var(--chart-axis, #888)" }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        new Intl.NumberFormat("pt-BR").format(value) + " gp",
                        name === "npc" ? "NPC" : "Venda",
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
                  <span className="hunts-page__chart-legend-item hunts-page__chart-legend-item--npc">NPC</span>
                  <span className="hunts-page__chart-legend-item hunts-page__chart-legend-item--venda">Venda</span>
                </div>
              </div>

              <div className="hunts-page__chart-card">
                <strong className="hunts-page__chart-title">Duração por sessão (min)</strong>
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
                      formatter={(value) => [`${value} min`, "Duração"]}
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

          {isHistoryOpen ? (
            <section className="hunts-page__history-panel">
              <div className="hunts-page__history-header">
                <div>
                  <h3 className="hunts-page__history-title">Histórico de hunts</h3>
                  <p className="hunts-page__history-subtitle">
                    {huntSessions.length
                      ? `${huntSessions.length} sessão(ões) registradas para o personagem ativo.`
                      : "Nenhuma hunt registrada ainda."}
                  </p>
                </div>
                <button
                  type="button"
                  className="hunts-page__ghost-button"
                  onClick={loadSessions}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "Carregando..." : "Atualizar"}
                </button>
              </div>

              {isLoadingHistory && huntSessions.length === 0 ? (
                <div className="hunts-page__history-placeholder">
                  <p className="hunts-page__history-placeholder-copy">Carregando sessões...</p>
                </div>
              ) : huntSessions.length === 0 ? (
                <div className="hunts-page__history-placeholder">
                  <strong className="hunts-page__history-placeholder-title">Nenhuma hunt registrada</strong>
                  <p className="hunts-page__history-placeholder-copy">
                    Clique em "Nova Hunt" para registrar sua primeira sessão.
                  </p>
                </div>
              ) : (
                <div className="hunts-page__session-list">
                  {huntSessions.map((session) => {
                    const isExpanded = expandedSessionId === session.id
                    return (
                      <article key={session.id} className="hunts-page__session-card">
                        <div className="hunts-page__session-row">
                          <div className="hunts-page__session-info">
                            <span className="hunts-page__session-date">
                              {new Date(session.hunt_date).toLocaleDateString("pt-BR", {
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
                                {formatCompactNumber(session.total_enemies)} inimigos
                              </span>
                            ) : null}
                          </div>
                          <div className="hunts-page__session-values">
                            <span className="hunts-page__session-label">NPC</span>
                            <strong className="hunts-page__session-value">{formatCompactDlValue(session.total_npc_value)}</strong>
                            <span className="hunts-page__session-label">Venda</span>
                            <strong className="hunts-page__session-value hunts-page__session-value--player">{formatCompactDlValue(session.total_player_value)}</strong>
                            {(() => {
                              const consumableCost = (session.consumables_json || []).reduce((acc, c) => acc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
                              return consumableCost > 0 ? (
                                <>
                                  <span className="hunts-page__session-label">Supply</span>
                                  <strong className="hunts-page__session-value hunts-page__session-value--negative">-{formatCompactDlValue(consumableCost)}</strong>
                                </>
                              ) : null
                            })()}
                            {(() => {
                              const sessionProfit = (session.total_player_value || 0) - (session.total_npc_value || 0)
                              const consumableCost = (session.consumables_json || []).reduce((acc, c) => acc + ((c.preco_npc || 0) * (c.quantity || 0)), 0)
                              const netProfit = sessionProfit - consumableCost
                              return (
                                <>
                                  <span className="hunts-page__session-label">Lucro</span>
                                  <strong className={netProfit >= 0 ? "hunts-page__session-value hunts-page__session-value--positive" : "hunts-page__session-value hunts-page__session-value--negative"}>
                                    {netProfit >= 0 ? "+" : "-"}{formatCompactDlValue(Math.abs(netProfit))}
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
                              {isExpanded ? "Ocultar" : "Detalhes"}
                            </button>
                            <button
                              type="button"
                              className="hunts-page__session-delete-btn"
                              onClick={() => deleteSession(session.id)}
                              title="Excluir hunt"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="hunts-page__session-detail">
                            {isLoadingDetail && sessionDetail?.id !== session.id ? (
                              <p className="hunts-page__history-subtitle">Carregando detalhes...</p>
                            ) : sessionDetail?.id === session.id ? (
                              <>
                                {sessionDetail.notes ? (
                                  <p className="hunts-page__session-notes">{sessionDetail.notes}</p>
                                ) : null}

                                {sessionDetail.enemies_json?.length > 0 ? (
                                  <div className="hunts-page__session-detail-block">
                                    <strong className="hunts-page__session-detail-title">Inimigos derrotados</strong>
                                    <div className="hunts-page__session-enemies-list">
                                      {sessionDetail.enemies_json.map((e, i) => (
                                        <span key={i} className="hunts-page__session-enemy-chip">
                                          {e.name.replace(/^\d{4} - /, "")} × {formatCompactNumber(e.quantity)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}


                                {sessionDetail.consumables_json?.length > 0 ? (
                                  <div className="hunts-page__session-detail-block">
                                    <strong className="hunts-page__session-detail-title">Consumíveis</strong>
                                    <ul className="hunts-page__enemy-list">
                                      {sessionDetail.consumables_json.map((c, i) => {
                                        const total = (c.preco_npc || 0) * (c.quantity || 0)
                                        return (
                                          <li key={i} className="hunts-page__enemy-row">
                                            <span className="hunts-page__enemy-name">{c.name}</span>
                                            <span className="hunts-page__session-badge">× {formatCompactNumber(c.quantity)}</span>
                                            {total > 0 ? (
                                              <span className="hunts-page__consumable-total">{formatCompactDlValue(total)}</span>
                                            ) : null}
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  </div>
                                ) : null}
                                {sessionDetail.drops_json?.length > 0 ? (
                                  <div className="hunts-page__session-detail-block">
                                    <strong className="hunts-page__session-detail-title">Drops</strong>
                                    <div className="hunts-page__drops-table-wrap">
                                      <table className="hunts-page__drops-table">
                                        <thead>
                                          <tr>
                                            <th>QTD x ITEM</th>
                                            <th>TOTAL NPC</th>
                                            <th>TOTAL VENDA</th>
                                            <th>LUCRO ITEM</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sessionDetail.drops_json.map((d, i) => (
                                            <tr key={i}>
                                              <td>
                                                <span className="hunts-page__item-inline">
                                                  <strong>{formatCompactNumber(d.quantity || 0)}x</strong>
                                                  <span className="hunts-page__item-name">{d.name || "?"}</span>
                                                </span>
                                              </td>
                                              <td>{d.npcTotalPrice ? formatCompactDlValue(d.npcTotalPrice) : <span className="hunts-page__no-price">—</span>}</td>
                                              <td>{d.playerTotalPrice ? formatCompactDlValue(d.playerTotalPrice) : <span className="hunts-page__no-price">—</span>}</td>
                                              <td>
                                                {(() => {
                                                  const itemProfit = Number(d.playerTotalPrice || 0) - Number(d.npcTotalPrice || 0)
                                                  return (
                                                    <span className={itemProfit >= 0 ? "hunts-page__delta-pill hunts-page__delta-pill--positive" : "hunts-page__delta-pill hunts-page__delta-pill--negative"}>
                                                      {itemProfit >= 0 ? "+" : "-"}
                                                      {formatCompactDlValue(Math.abs(itemProfit))}
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
                </div>
              )}
            </section>
          ) : null}

          {isNewHuntOpen ? (
            <section className="hunts-page__history-panel" onPaste={handlePasteImages}>
              <div className="hunts-page__history-header">
                <div>
                  <h3 className="hunts-page__history-title">Nova hunt</h3>
                </div>
              </div>

              <div className="hunts-page__upload-box">
                <label className="hunts-page__upload-label" htmlFor="hunts-drops-upload">
                  Upload de imagens de drops
                </label>

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
                    Clique para selecionar as imagens
                  </strong>
                  <span className="hunts-page__dropzone-copy">
                    Apenas PNG e JPG. Voce pode enviar varias imagens de uma vez para a analise ou colar com Ctrl+V.
                  </span>
                  <span className="hunts-page__dropzone-action">Escolher arquivos</span>
                </label>

                {selectedFiles.length ? (
                  <>
                    <div className="hunts-page__file-toolbar">
                      <span className="hunts-page__file-toolbar-label">Pré-visualização das imagens</span>
                      <button
                        type="button"
                        className="hunts-page__ghost-button hunts-page__file-clear"
                        onClick={handleClearSelectedFiles}
                      >
                        Remover todas
                      </button>
                    </div>

                    <div className="hunts-page__file-grid" role="status" aria-live="polite">
                      {selectedFiles.map((entry) => (
                        <article key={entry.id} className="hunts-page__file-card">
                          <button
                            type="button"
                            className="hunts-page__file-preview"
                            onClick={() => setPreviewFile(entry)}
                            title="Clique para pré-visualizar"
                          >
                            <img src={entry.previewUrl} alt={entry.file.name} loading="lazy" />
                          </button>

                          <div className="hunts-page__file-meta">
                            <span className="hunts-page__file-name" title={entry.file.name}>{entry.file.name}</span>
                            <button
                              type="button"
                              className="hunts-page__file-remove"
                              onClick={() => handleRemoveSelectedFile(entry.id)}
                            >
                              Remover
                            </button>
                          </div>
                        </article>
                      ))}
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
                    {isUploadingDrops ? "Processando..." : "Processar drops"}
                  </button>

                  <button
                    type="button"
                    className="hunts-page__ghost-button hunts-page__process-button"
                    disabled={isUploadingDrops || (!selectedFiles.length && !dropsResult && !dropsRows.length && !dropsWarnings.length && !dropsError)}
                    onClick={handleResetDropsWorkspace}
                  >
                    Limpar
                  </button>
                </div>

                {dropsError ? (
                  <p className="hunts-page__upload-error" role="alert">
                    {dropsError}
                  </p>
                ) : null}

                {dropsResult?.summary ? (
                  <div className="hunts-page__ocr-summary">
                    <strong className="hunts-page__ocr-summary-title">Resultado OCR</strong>
                    <div className="hunts-page__ocr-summary-grid">
                      <span>Imagens: {dropsResult.summary.processed_images ?? 0}</span>
                      <span>Linhas: {dropsResult.summary.recognized_lines ?? 0}</span>
                      <span>Duplicadas: {dropsResult.summary.duplicates_ignored ?? 0}</span>
                      <span>Drops finais: {dropsResult.summary.final_rows ?? 0}</span>
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
                          <th>QTD x ITEM</th>
                          <th>PREÇO NPC</th>
                          <th>PREÇO VENDA</th>
                          <th>TOTAL NPC</th>
                          <th>TOTAL VENDA</th>
                          <th>LUCRO ITEM</th>
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
                              <td>{row.npcUnitPrice ? formatCompactDlValue(row.npcUnitPrice) : <span className="hunts-page__no-price">—</span>}</td>
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
                                {isSaving ? <span className="hunts-page__saving-pill">Salvando...</span> : null}
                              </td>
                              <td>{row.npcTotalPrice ? formatCompactDlValue(row.npcTotalPrice) : <span className="hunts-page__no-price">—</span>}</td>
                              <td>
                                <div className="hunts-page__total-sale-cell">
                                  <span>{formatCompactDlValue(effectivePlayerTotal)}</span>
                                  {hasNpcReference ? (
                                    <span className={profitClassName}>
                                      +{formatCompactDlValue(profitDelta)}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                {hasNpcReference ? (
                                  <span className={profitClassName}>
                                    +{formatCompactDlValue(profitDelta)}
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
                      Duração (minutos)
                    </label>
                    <input
                      id="hunt-duration"
                      className="hunts-page__table-input"
                      type="number"
                      min="0"
                      placeholder="ex: 60"
                      value={huntDuration}
                      onChange={(e) => setHuntDuration(e.target.value)}
                    />
                  </div>
                  <div className="hunts-page__hunt-meta-row">
                    <label className="hunts-page__upload-label" htmlFor="hunt-notes">
                      Anotações
                    </label>
                    <textarea
                      id="hunt-notes"
                      className="hunts-page__hunt-notes-input"
                      placeholder="Observações sobre a hunt..."
                      value={huntNotes}
                      onChange={(e) => setHuntNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="hunts-page__enemies-section">
                  <strong className="hunts-page__upload-label">Inimigos derrotados</strong>
                  <div className="hunts-page__enemy-search-wrap">
                    <input
                      className="hunts-page__table-input"
                      type="text"
                      placeholder="Buscar Pokémon..."
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
                            title="Remover"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hunts-page__enemy-empty">Nenhum inimigo adicionado ainda.</p>
                  )}
                </div>


                <div className="hunts-page__enemies-section">
                  <div className="hunts-page__consumable-header">
                    <button
                      type="button"
                      className="hunts-page__ghost-button"
                      onClick={() => setIsConsumableModalOpen(true)}
                    >
                      Consumíveis
                      {consumableList.length > 0 ? (
                        <span className="hunts-page__consumable-badge"> ({consumableList.length})</span>
                      ) : null}
                    </button>
                    {consumableList.length > 0 ? (() => {
                      const totalCost = consumableList.reduce((acc, c) => acc + c.preco_npc * c.quantity, 0)
                      return totalCost > 0 ? (
                        <span className="hunts-page__consumable-summary-inline">
                          Supply: <strong>{formatCompactDlValue(totalCost)}</strong>
                        </span>
                      ) : null
                    })() : null}
                  </div>

                  {dropsRows.length > 0 ? (
                    <div className="hunts-page__profit-row">
                      <span className="hunts-page__upload-label">Lucro esperado:</span>
                      <span>
                        <span className="hunts-page__profit-label">npc</span>
                        <strong className={currentExpectedProfit.npc >= 0 ? "hunts-page__profit-value hunts-page__profit-value--positive" : "hunts-page__profit-value hunts-page__profit-value--negative"}>
                          {currentExpectedProfit.npc >= 0 ? "+" : "-"}{formatCompactDlValue(Math.abs(currentExpectedProfit.npc))}
                        </strong>
                      </span>
                      <span>
                        <span className="hunts-page__profit-label">player</span>
                        <strong className="hunts-page__profit-value hunts-page__profit-value--positive">
                          +{formatCompactDlValue(currentExpectedProfit.player)}
                        </strong>
                      </span>
                    </div>
                  ) : null}
                </div>
                {huntSaveError ? (
                  <p className="hunts-page__upload-error" role="alert">{huntSaveError}</p>
                ) : null}
                {huntSaved ? (
                  <p className="hunts-page__hunt-saved-msg" role="status">Hunt salva com sucesso!</p>
                ) : null}

                <button
                  type="button"
                  className="hunts-page__primary-button"
                  onClick={saveHunt}
                  disabled={isSavingHunt}
                >
                  {isSavingHunt ? "Salvando..." : "Salvar Hunt"}
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
              <strong className="hunts-page__preview-title">Consumíveis utilizados</strong>
              <button
                type="button"
                className="hunts-page__ghost-button hunts-page__preview-close"
                onClick={() => setIsConsumableModalOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="hunts-page__consumables-toolbar">
              <select
                className="hunts-page__table-input hunts-page__consumables-select"
                value={selectedConsumableCategory}
                onChange={(event) => setSelectedConsumableCategory(event.target.value)}
              >
                <option value="">Todas as categorias</option>
                {consumableCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              {selectedConsumableCategory ? (
                <button
                  type="button"
                  className="hunts-page__ghost-button"
                  onClick={() => setSelectedConsumableCategory("")}
                >
                  Limpar filtro
                </button>
              ) : null}
            </div>

            <div className="hunts-page__enemy-search-wrap">
              <input
                className="hunts-page__table-input"
                type="text"
                placeholder="Buscar item consumível..."
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
                Adicionar
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
                          {item.preco_npc > 0 ? <span className="hunts-page__consumable-price">{formatCompactDlValue(item.preco_npc)} / un</span> : null}
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
                        <span className="hunts-page__consumable-total">={formatCompactDlValue(totalCost)}</span>
                      ) : null}
                      <button
                        type="button"
                        className="hunts-page__session-delete-btn"
                        onClick={() => removeConsumable(index)}
                        title="Remover"
                      >
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="hunts-page__enemy-empty">Nenhum consumível adicionado ainda.</p>
            )}
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
                Fechar
              </button>
            </div>
            <img
              className="hunts-page__preview-image"
              src={previewFile.previewUrl}
              alt={`Pré-visualização de ${previewFile.file.name}`}
            />
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
