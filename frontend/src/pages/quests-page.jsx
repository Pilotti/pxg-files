import { useEffect, useMemo, useState } from "react"
import useStableScroll from "../hooks/use-stable-scroll.js"
import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import ConfirmActionModal from "../components/confirm-action-modal.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { apiRequest } from "../services/api.js"
import { readAppPreferences } from "../services/app-preferences.js"
import "../styles/quests-page.css"

const continents = [
  { value: "", label: "Todos os continentes" },
  { value: "kanto", label: "Kanto" },
  { value: "johto", label: "Johto" },
  { value: "orange_islands", label: "Ilhas Laranjas" },
  { value: "outland", label: "Outland" },
  { value: "nightmare_world", label: "Nightmare World" },
  { value: "orre", label: "Orre" },
]

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
          ? "quests-toast quests-toast--success"
          : "quests-toast quests-toast--error"
      }
    >
      <div className="quests-toast__content">
        <strong className="quests-toast__title">
          {feedback.type === "success" ? "Sucesso" : "Erro"}
        </strong>
        <span className="quests-toast__message">{feedback.message}</span>
      </div>

      <button
        type="button"
        className="quests-toast__close"
        onClick={onClose}
        aria-label="Fechar aviso"
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
  const preferences = useMemo(() => readAppPreferences(), [])

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
    min_level: "",
    max_level: "",
  })

  const [listFilters, setListFilters] = useState({
    search: "",
    status: "",
    continent: "",
  })

  const debouncedCatalogFilters = useDebouncedValue(catalogFilters, 250)
  const debouncedListFilters = useDebouncedValue(listFilters, 150)

  useEffect(() => {
    if (!feedback) return

    const timer = setTimeout(() => {
      setFeedback(null)
    }, 3200)

    return () => clearTimeout(timer)
  }, [feedback])

  useEffect(() => {
    if (!activeCharacter?.id) {
      setQuests([])
      setIsLoadingQuests(false)
      return
    }

    loadQuests()
  }, [activeCharacter?.id])

  useEffect(() => {
    if (!isCatalogOpen || !activeCharacter?.id) return
    loadCatalog(debouncedCatalogFilters)
  }, [isCatalogOpen, debouncedCatalogFilters, activeCharacter?.id])

  async function loadQuests() {
    if (!activeCharacter?.id) return

    setIsLoadingQuests(true)

    try {
      const data = await apiRequest(`/quests?character_id=${activeCharacter.id}`)
      setQuests(data)
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível carregar as quests.",
      })
    } finally {
      setIsLoadingQuests(false)
    }
  }

  function buildCatalogQuery(nextFilters) {
    const params = new URLSearchParams()
    params.append("character_id", String(activeCharacter.id))

    if (nextFilters.continent) params.append("continent", nextFilters.continent)
    if (nextFilters.min_level) params.append("min_level", String(nextFilters.min_level))
    if (nextFilters.max_level) params.append("max_level", String(nextFilters.max_level))

    return params.toString()
  }

  async function loadCatalog(nextFilters = catalogFilters) {
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
        message: err.message || "Não foi possível carregar o catálogo de quests.",
      })
    } finally {
      setIsLoadingCatalog(false)
    }
  }

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
          message: "Quest voltou para pendente.",
        })

        await Promise.all([
          loadQuests(),
          isCatalogOpen ? loadCatalog(debouncedCatalogFilters) : Promise.resolve(),
        ])
      } catch (err) {
        setFeedback({
          type: "error",
          message: err.message || "Não foi possível desconcluir a quest.",
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
        message: "Quest ativada com sucesso.",
      })

      await Promise.all([loadQuests(), loadCatalog(debouncedCatalogFilters)])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível ativar a quest.",
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
        message: "Quest concluída com sucesso.",
      })

      await Promise.all([
        loadQuests(),
        isCatalogOpen ? loadCatalog(debouncedCatalogFilters) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível concluir a quest.",
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
        message: "Quest removida da lista ativa.",
      })
      setRemoveConfirm(null)

      await Promise.all([
        loadQuests(),
        isCatalogOpen ? loadCatalog(debouncedCatalogFilters) : Promise.resolve(),
      ])
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível remover a quest.",
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
      return a.name.localeCompare(b.name, "pt-BR")
    })
  }, [quests])

  const filteredQuests = useMemo(() => {
    const search = debouncedListFilters.search.trim().toLowerCase()

    return sortedQuests.filter((quest) => {
      if (search && !quest.name.toLowerCase().includes(search)) return false

      if (debouncedListFilters.status === "pending" && quest.is_completed) return false
      if (debouncedListFilters.status === "completed" && !quest.is_completed) return false

      if (debouncedListFilters.continent && quest.continent !== debouncedListFilters.continent) {
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
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />

      <ConfirmActionModal
        open={isConfirmingRemove}
        title="Remover quest ativa?"
        description={
          removeConfirm
            ? `A quest "${removeConfirm.name}" será removida da lista ativa deste personagem. Você poderá ativá-la novamente depois.`
            : ""
        }
        confirmLabel="Remover quest"
        cancelLabel="Cancelar"
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
            <h2 className="quests-page__title">Quests ativas</h2>
          </div>

          <button
            type="button"
            className="quests-page__primary-button"
            onClick={openCatalog}
            disabled={!activeCharacter}
          >
            Nova Quest
          </button>
        </div>

        <div className="quests-page__stats">
          <div className="quests-page__stat-card">
            <span className="quests-page__stat-label">Total</span>
            <strong className="quests-page__stat-value">{stats.total}</strong>
          </div>

          <div className="quests-page__stat-card">
            <span className="quests-page__stat-label">Pendentes</span>
            <strong className="quests-page__stat-value">{stats.pending}</strong>
          </div>

          <div className="quests-page__stat-card quests-page__stat-card--success">
            <span className="quests-page__stat-label">Concluídas</span>
            <strong className="quests-page__stat-value">{stats.completed}</strong>
          </div>
        </div>

        <div className="quests-page__filters-card">
          <div className="quests-page__filters-grid">
            <input
              className="quests-page__input"
              placeholder="Buscar quest ativa"
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
              <option value="">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="completed">Concluídas</option>
            </select>

            <select
              className="quests-page__input"
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
              Nenhuma quest encontrada para os filtros atuais.
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
                        {quest.is_completed ? "Concluída" : "Pendente"}
                      </span>
                    </div>

                    <p className="quests-page__card-description">
                      {quest.description || "Sem descrição."}
                    </p>

                    <div className="quests-page__meta">
                      <span>Continente: {formatContinent(quest.continent)}</span>
                      <span>Nível mínimo: {quest.min_level}</span>
                      {quest.continent === "nightmare_world" && quest.nw_level !== null && quest.nw_level !== undefined ? <span>NW Level: {quest.nw_level}</span> : null}
                    </div>

                    <div className="quests-page__reward">
                      Recompensa: {quest.reward_text || "Não informada"}
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
                          {isProcessing ? "Salvando..." : "Concluir"}
                        </button>

                        <button
                          type="button"
                          className="quests-page__danger-button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => requestRemoveQuest(quest)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? "Salvando..." : "Remover"}
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
                          {isProcessing ? "Salvando..." : "Desconcluir"}
                        </button>

                        <div className="quests-page__completed-note">
                          Quest concluída.
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
                <h2 className="quests-catalog-modal__title">Nova Quest</h2>
                <p className="quests-catalog-modal__subtitle">
                  Ative novas quests para o personagem atual.
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
                placeholder="Buscar por nome"
                value={catalogFilters.search}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, search: e.target.value }))
                }
              />

              <select
                className="quests-page__input"
                value={catalogFilters.continent}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, continent: e.target.value }))
                }
              >
                {continents.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <input
                className="quests-page__input"
                type="number"
                placeholder="Nível mín."
                value={catalogFilters.min_level}
                onChange={(e) =>
                  setCatalogFilters((prev) => ({ ...prev, min_level: e.target.value }))
                }
              />

              <input
                className="quests-page__input"
                type="number"
                placeholder="Nível máx."
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
                    Nenhuma quest encontrada para os filtros atuais.
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
                                ? "Concluída"
                                : quest.status === "active"
                                  ? "Ativa"
                                  : "Disponível"}
                            </span>
                          </div>

                          <p className="quests-page__card-description">
                            {quest.description || "Sem descrição."}
                          </p>

                          <div className="quests-page__meta">
                            <span>Continente: {formatContinent(quest.continent)}</span>
                            <span>Nível mínimo: {quest.min_level}</span>
                            {quest.continent === "nightmare_world" && quest.nw_level !== null && quest.nw_level !== undefined ? <span>NW Level: {quest.nw_level}</span> : null}
                          </div>

                          <div className="quests-page__reward">
                            Recompensa: {quest.reward_text || "Não informada"}
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
                              {isProcessing ? "Ativando..." : "Ativar"}
                            </button>
                          ) : quest.status === "active" ? (
                            <div className="quests-page__active-note">
                              Essa quest já está ativa.
                            </div>
                          ) : (
                            <div className="quests-page__completed-note">
                              Essa quest já foi concluída por este personagem.
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