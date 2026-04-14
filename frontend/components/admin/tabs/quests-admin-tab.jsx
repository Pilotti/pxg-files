'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminRequest } from "@/services/admin-api.js"
import AppSelect from "@/components/app-select.jsx"
import { CONTINENTS, QUEST_INITIAL_FORM } from "../admin-constants.js"
import { buildQuery, formatCity, formatContinent, normalizeMinLevelInput } from "../admin-utils.js"
import { useDebouncedValue } from "../use-debounced-value.js"

export default function QuestsAdminTab({ confirmBeforeRemoving, showError, showSuccess }) {
  const [quests, setQuests] = useState([])
  const [questFilters, setQuestFilters] = useState({
    search: "",
    continent: "",
    city: "",
    nw_level: "",
    min_level: "",
    max_level: "",
    is_active: "",
  })
  const [questModal, setQuestModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [questForm, setQuestForm] = useState(QUEST_INITIAL_FORM)
  const [isLoadingQuests, setIsLoadingQuests] = useState(true)
  const [isSubmittingQuest, setIsSubmittingQuest] = useState(false)
  const [isTogglingQuestId, setIsTogglingQuestId] = useState(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)
  const debouncedQuestFilters = useDebouncedValue(questFilters, 250)

  const questCityOptions = useMemo(() => {
    const filteredByContinent = questFilters.continent
      ? quests.filter((quest) => quest.continent === questFilters.continent)
      : quests

    const citySet = new Set(
      filteredByContinent
        .map((quest) => String(quest.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase()),
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [quests, questFilters.continent])

  const questStats = useMemo(() => ({
    active: quests.filter((quest) => quest.is_active).length,
    inactive: quests.filter((quest) => !quest.is_active).length,
    continent: questFilters.continent ? quests.filter((quest) => quest.continent === questFilters.continent).length : null,
    city: questFilters.city
      ? quests.filter((quest) => String(quest.city || "").trim().toLowerCase() === questFilters.city).length
      : null,
  }), [quests, questFilters.continent, questFilters.city])

  const loadQuests = useCallback(async (nextFilters = debouncedQuestFilters) => {
    setIsLoadingQuests(true)
    try {
      setQuests(await adminRequest(`/admin/quests${buildQuery(nextFilters)}`))
    } catch (err) {
      showError(err.message || "Erro ao carregar quests")
    } finally {
      setIsLoadingQuests(false)
    }
  }, [debouncedQuestFilters, showError])

  useEffect(() => {
    loadQuests(debouncedQuestFilters)
  }, [debouncedQuestFilters, loadQuests])

  function openCreateQuest() {
    setQuestForm(QUEST_INITIAL_FORM)
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

  function openDeleteModal(item) {
    if (confirmBeforeRemoving) {
      setDeleteModal({ item })
      return
    }

    handleDeleteDirect(item)
  }

  function closeDeleteModal() {
    if (!isDeletingItem) {
      setDeleteModal(null)
    }
  }

  async function handleSubmitQuest(event) {
    event.preventDefault()
    setIsSubmittingQuest(true)

    try {
      if (!String(questForm.city || "").trim()) {
        throw new Error("Cidade é obrigatória para salvar a quest.")
      }
      if (questForm.continent === "nightmare_world" && !String(questForm.nw_level || "").trim()) {
        throw new Error("NW Level é obrigatório para quests em Nightmare World.")
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

  async function handleDeleteDirect(item) {
    setIsDeletingItem(true)

    try {
      await adminRequest(`/admin/quests/${item.id}`, { method: "DELETE" })
      showSuccess("Quest removida permanentemente.")
      await loadQuests(debouncedQuestFilters)
    } catch (err) {
      showError(err.message || "Erro ao remover item")
    } finally {
      setIsDeletingItem(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteModal) return
    await handleDeleteDirect(deleteModal.item)
    setDeleteModal(null)
  }

  return (
    <>
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
            <AppSelect className="admin-page__select" value={questFilters.continent} options={CONTINENTS} onChange={(value) => setQuestFilters((prev) => ({ ...prev, continent: value, city: "", nw_level: value === "nightmare_world" ? prev.nw_level : "" }))} />
            {questFilters.continent === "nightmare_world" ? <input className="admin-page__input" type="number" min="1" max="999" placeholder="NW Level" value={questFilters.nw_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, nw_level: event.target.value }))} /> : null}
            <AppSelect className="admin-page__select" value={questFilters.city} options={[{ value: "", label: "Todas as cidades" }, ...questCityOptions]} onChange={(value) => setQuestFilters((prev) => ({ ...prev, city: value }))} />
            <input className="admin-page__input" type="number" placeholder="Nível mín." value={questFilters.min_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, min_level: event.target.value }))} />
            <input className="admin-page__input" type="number" placeholder="Nível máx." value={questFilters.max_level} onChange={(event) => setQuestFilters((prev) => ({ ...prev, max_level: event.target.value }))} />
            <AppSelect className="admin-page__select" value={questFilters.is_active} options={[{ value: "", label: "Todos os status" }, { value: "true", label: "Ativas" }, { value: "false", label: "Inativas" }]} onChange={(value) => setQuestFilters((prev) => ({ ...prev, is_active: value }))} />
          </div>
        </div>

        <div className="admin-page__stats-row">
          <span className="admin-page__stat">Total: {quests.length}</span>
          <span className="admin-page__stat admin-page__stat--active">Ativas: {questStats.active}</span>
          <span className="admin-page__stat admin-page__stat--inactive">Inativas: {questStats.inactive}</span>
          {questFilters.continent && questStats.continent !== null ? <span className="admin-page__stat admin-page__stat--location">{formatContinent(questFilters.continent)}: {questStats.continent}</span> : null}
          {questFilters.city && questStats.city !== null ? <span className="admin-page__stat admin-page__stat--location">{formatCity(questFilters.city)}: {questStats.city}</span> : null}
          {questFilters.continent === "nightmare_world" && questFilters.nw_level ? <span className="admin-page__stat admin-page__stat--location">Filtro NW ativo: {questFilters.nw_level}</span> : null}
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
                  <span className="admin-page__chip">Cidade: {formatCity(quest.city) || "—"}</span>
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
                  <button type="button" className="admin-page__icon-button admin-page__icon-button--danger" onClick={() => openDeleteModal(quest)} title="Remover" aria-label="Remover quest">🗑</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {questModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal">
            <h2 className="character-modal__title">{questModal.type === "create" ? "Nova quest" : "Editar quest"}</h2>
            <form onSubmit={handleSubmitQuest}>
              <div className="character-modal__field"><label>Nome</label><input className="character-modal__input" value={questForm.name} onChange={(event) => setQuestForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Descrição</label><input className="character-modal__input" value={questForm.description} onChange={(event) => setQuestForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Continente</label><AppSelect className="character-modal__select" value={questForm.continent} options={CONTINENTS.filter((item) => item.value)} onChange={(value) => setQuestForm((prev) => ({ ...prev, continent: value }))} /></div>
              <div className="character-modal__field"><label>Cidade</label><input className="character-modal__input" required value={questForm.city} onChange={(event) => setQuestForm((prev) => ({ ...prev, city: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Nível mínimo</label><input className="character-modal__input" type="number" min="0" max="625" value={questForm.min_level} onChange={(event) => setQuestForm((prev) => ({ ...prev, min_level: event.target.value }))} /></div>
              {questForm.continent === "nightmare_world" ? <div className="character-modal__field"><label>Nightmare Level (NW Level)</label><input className="character-modal__input" type="number" min="1" max="999" value={questForm.nw_level} onChange={(event) => setQuestForm((prev) => ({ ...prev, nw_level: event.target.value }))} /></div> : null}
              <div className="character-modal__field"><label>Recompensa</label><input className="character-modal__input" value={questForm.reward_text} onChange={(event) => setQuestForm((prev) => ({ ...prev, reward_text: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Ativa</label><AppSelect className="character-modal__select" value={String(questForm.is_active)} options={[{ value: "true", label: "Sim" }, { value: "false", label: "Não" }]} onChange={(value) => setQuestForm((prev) => ({ ...prev, is_active: value === "true" }))} /></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setQuestModal(null)} disabled={isSubmittingQuest}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingQuest}>{isSubmittingQuest ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal character-modal--danger">
            <h2 className="character-modal__title">Remover quest</h2>
            <p className="character-modal__description">Você está prestes a remover permanentemente <strong>{deleteModal.item.name}</strong>.</p>
            <div className="character-modal__notice-list">
              <div className="character-modal__notice character-modal__notice--warning">Essa ação apagará o item do sistema inteiro.</div>
              <div className="character-modal__notice character-modal__notice--warning">Ela não pode ser desfeita.</div>
            </div>
            <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={closeDeleteModal} disabled={isDeletingItem}>Cancelar</button><button type="button" className="character-modal__button character-modal__button--danger" onClick={handleDeleteConfirmed} disabled={isDeletingItem}>{isDeletingItem ? "Removendo..." : "Remover permanentemente"}</button></div>
          </div>
        </div>
      ) : null}
    </>
  )
}
