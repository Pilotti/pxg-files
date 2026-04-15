import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import AppSelect from "@/components/app-select.jsx"
import { adminRequest, getAdminToken } from "@/services/admin-api.js"
import { API_URL } from "@/services/session-manager.js"

const STATUS_FILTER_OPTIONS = [
  { value: "pending", label: "Sem análise" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Reprovadas" },
  { value: "all", label: "Todas" },
]

const REVIEW_STATUS_OPTIONS = [
  { value: "pending", label: "Sem análise" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Reprovada" },
]

const TRAINING_FILTER_OPTIONS = [
  { value: "all", label: "Treino: todos" },
  { value: "training", label: "No conjunto de treino" },
  { value: "non-training", label: "Fora do treino" },
]

function buildDraft(item) {
  return {
    status: item.status || "pending",
    notes: item.notes || "",
    include_in_training: Boolean(item.include_in_training),
  }
}

function getStatusLabel(status) {
  if (status === "approved") return "Aprovada"
  if (status === "rejected") return "Reprovada"
  return "Sem análise"
}

function getStatusClassName(status) {
  if (status === "approved") return "admin-page__status admin-page__status--active"
  if (status === "rejected") return "admin-page__status admin-page__status--inactive"
  return "admin-page__status admin-page__status--pending"
}

function getOutcomeChip(item) {
  if (item.last_reprocess_outcome === "success") {
    return `Reprocessada: ${item.last_reprocess_rows || 0} linha(s)`
  }
  if (item.last_reprocess_outcome === "empty") {
    return "Reprocessada sem linhas reconhecidas"
  }
  if (item.last_reprocess_outcome === "table_not_found") {
    return "Tabela ainda não detectada"
  }
  if (item.last_reprocess_outcome === "error") {
    return "Erro no reprocessamento"
  }
  return null
}

export default function OcrReviewAdminTab({ showError }) {
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [savingName, setSavingName] = useState("")
  const [openingName, setOpeningName] = useState("")
  const [reprocessingName, setReprocessingName] = useState("")
  const [previewImage, setPreviewImage] = useState(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("pending")
  const [trainingFilter, setTrainingFilter] = useState("all")

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return [...items]
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false
        }

        if (trainingFilter === "training" && !item.include_in_training) {
          return false
        }

        if (trainingFilter === "non-training" && item.include_in_training) {
          return false
        }

        if (!normalizedSearch) {
          return true
        }

        const haystack = [
          item.filename,
          item.notes,
          item.last_reprocess_message,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        return haystack.includes(normalizedSearch)
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [items, search, statusFilter, trainingFilter])

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await adminRequest("/admin/ocr-review")
      const nextItems = Array.isArray(data?.items) ? data.items : []
      setItems(nextItems)
      setDrafts((current) => {
        const next = { ...current }
        for (const item of nextItems) {
          next[item.filename] = buildDraft(item)
        }
        return next
      })
    } catch (error) {
      showError(error?.message || "Erro ao carregar imagens OCR")
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    return () => {
      if (previewImage?.url) {
        URL.revokeObjectURL(previewImage.url)
      }
    }
  }, [previewImage])

  const handleOpenImage = useCallback(async (filename) => {
    setOpeningName(filename)
    try {
      if (previewImage?.url) {
        URL.revokeObjectURL(previewImage.url)
      }

      const token = getAdminToken()
      const response = await fetch(`${API_URL}/admin/ocr-review/${encodeURIComponent(filename)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error("Falha ao abrir a imagem")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setPreviewImage({ filename, url })
    } catch (error) {
      showError(error?.message || "Falha ao abrir a imagem")
    } finally {
      setOpeningName("")
    }
  }, [previewImage, showError])

  const handleClosePreview = useCallback(() => {
    setPreviewImage((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url)
      }
      return null
    })
  }, [])

  const handleUpdateDraft = useCallback((filename, patch) => {
    setDrafts((current) => ({
      ...current,
      [filename]: {
        ...(current[filename] || {}),
        ...patch,
      },
    }))
  }, [])

  const handleSaveReview = useCallback(async (filename, item) => {
    const draft = drafts[filename] || buildDraft(item)
    setSavingName(filename)
    try {
      await adminRequest(`/admin/ocr-review/${encodeURIComponent(filename)}/decision`, {
        method: "PUT",
        body: JSON.stringify({
          status: draft.status,
          notes: draft.notes,
          include_in_training: draft.include_in_training,
        }),
      })

      setItems((current) =>
        current.map((currentItem) => (
          currentItem.filename === filename
            ? {
                ...currentItem,
                status: draft.status,
                notes: draft.notes.trim() || null,
                include_in_training: Boolean(draft.include_in_training),
                updated_at: new Date().toISOString(),
              }
            : currentItem
        ))
      )
    } catch (error) {
      showError(error?.message || "Falha ao salvar a revisão")
    } finally {
      setSavingName("")
    }
  }, [drafts, showError])

  const handleReprocess = useCallback(async (filename) => {
    setReprocessingName(filename)
    try {
      const payload = await adminRequest(`/admin/ocr-review/${encodeURIComponent(filename)}/reprocess`, {
        method: "POST",
      })

      setItems((current) =>
        current.map((item) => (
          item.filename === filename
            ? {
                ...item,
                last_reprocessed_at: new Date().toISOString(),
                last_reprocess_outcome: payload.outcome,
                last_reprocess_rows: payload.recognized_rows,
                last_reprocess_duplicates: payload.duplicates_ignored,
                last_reprocess_message: payload.detail,
              }
            : item
        ))
      )
    } catch (error) {
      showError(error?.message || "Falha ao reprocessar a imagem")
    } finally {
      setReprocessingName("")
    }
  }, [showError])

  return (
    <section className="admin-page__panel">
      <div className="admin-page__section-header">
        <div>
          <h2 className="admin-page__section-title">OCR revisões</h2>
          <p className="admin-page__section-subtitle">
            Revise imagens não lidas, registre o motivo da recusa, tente reprocessar e separe o que entra no conjunto de treino.
          </p>
        </div>
        <button
          type="button"
          className="admin-page__ghost-button"
          onClick={loadItems}
          disabled={isLoading}
        >
          Atualizar
        </button>
      </div>

      <div className="admin-page__stats-row">
        <span className="admin-page__stat">Total: {items.length}</span>
        <span className="admin-page__stat">Filtradas: {filteredItems.length}</span>
        <span className="admin-page__stat">Sem análise: {items.filter((item) => item.status === "pending").length}</span>
      </div>

      <div className="admin-page__filters-card">
        <div className="admin-page__filters-grid admin-page__filters-grid--ocr-review">
          <input
            className="admin-page__input"
            type="text"
            placeholder="Buscar por arquivo, motivo ou resultado"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <AppSelect
            className="admin-page__select"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
          />
          <AppSelect
            className="admin-page__select"
            value={trainingFilter}
            options={TRAINING_FILTER_OPTIONS}
            onChange={setTrainingFilter}
          />
          <button
            type="button"
            className="admin-page__ghost-button"
            onClick={() => {
              setSearch("")
              setStatusFilter("pending")
              setTrainingFilter("all")
            }}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="admin-page__empty admin-page__empty--full">Carregando imagens...</div>
      ) : !filteredItems.length ? (
        <div className="admin-page__empty admin-page__empty--full">Nenhuma imagem encontrada com esse filtro.</div>
      ) : (
        <div className="admin-page__cards-grid">
          {filteredItems.map((item) => {
            const draft = drafts[item.filename] || buildDraft(item)
            const outcomeChip = getOutcomeChip(item)

            return (
              <article key={item.filename} className="admin-page__tile admin-page__tile--ocr-review">
                <div className="admin-page__tile-main">
                  <div className="admin-page__tile-top">
                    <strong className="admin-page__tile-title">{item.filename}</strong>
                    <span className={getStatusClassName(item.status)}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="admin-page__chip-row">
                    <span className="admin-page__chip">Tamanho: {Math.round(item.size_bytes / 1024)} KB</span>
                    <span className="admin-page__chip">Data: {new Date(item.created_at).toLocaleString("pt-BR")}</span>
                    {item.include_in_training ? (
                      <span className="admin-page__chip admin-page__chip--consumable">Conjunto de treino</span>
                    ) : null}
                    {outcomeChip ? <span className="admin-page__chip">{outcomeChip}</span> : null}
                  </div>

                  <div className="admin-page__ocr-review-form">
                    <AppSelect
                      className="admin-page__select"
                      value={draft.status}
                      options={REVIEW_STATUS_OPTIONS}
                      onChange={(value) => handleUpdateDraft(item.filename, { status: value })}
                    />

                    <textarea
                      className="admin-page__textarea admin-page__ocr-review-notes"
                      rows={4}
                      placeholder={draft.status === "rejected" ? "Por que essa imagem foi recusada?" : "Observações da revisão"}
                      value={draft.notes}
                      onChange={(event) => handleUpdateDraft(item.filename, { notes: event.target.value })}
                    />

                    <label className="admin-page__ocr-training-toggle">
                      <input
                        type="checkbox"
                        checked={draft.include_in_training}
                        onChange={(event) => handleUpdateDraft(item.filename, { include_in_training: event.target.checked })}
                      />
                      <span>Adicionar ao conjunto de treino</span>
                    </label>

                    {item.last_reprocess_message ? (
                      <p className="admin-page__ocr-review-message">{item.last_reprocess_message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="admin-page__tile-actions admin-page__tile-actions--row">
                  <button
                    type="button"
                    className="admin-page__ghost-button"
                    onClick={() => handleOpenImage(item.filename)}
                    disabled={openingName === item.filename}
                  >
                    {openingName === item.filename ? "Abrindo..." : "Ver imagem"}
                  </button>
                  <button
                    type="button"
                    className="admin-page__ghost-button"
                    onClick={() => handleReprocess(item.filename)}
                    disabled={reprocessingName === item.filename}
                  >
                    {reprocessingName === item.filename ? "Reprocessando..." : "Tentar reprocessar"}
                  </button>
                  <button
                    type="button"
                    className="admin-page__primary-button"
                    onClick={() => handleSaveReview(item.filename, item)}
                    disabled={savingName === item.filename}
                  >
                    {savingName === item.filename ? "Salvando..." : "Salvar revisão"}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {previewImage ? (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Visualizar ${previewImage.filename}`}
          onClick={handleClosePreview}
        >
          <div
            className="admin-modal admin-modal--image"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal__header">
              <strong className="admin-modal__title">{previewImage.filename}</strong>
              <p className="admin-modal__subtitle">
                Confira a captura original para decidir se aprova, reprova ou envia para treino.
              </p>
            </div>

            <div className="admin-page__ocr-preview-wrap">
              <Image
                className="admin-page__ocr-preview-full"
                src={previewImage.url}
                alt={previewImage.filename}
                width={1600}
                height={1200}
                unoptimized
              />
            </div>

            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-page__ghost-button"
                onClick={handleClosePreview}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
