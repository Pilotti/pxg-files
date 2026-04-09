'use client'

import { useCallback, useEffect, useState } from "react"
import { adminRequest } from "@/services/admin-api.js"
import { CONSUMABLE_INITIAL_FORM, CONSUMABLE_PAGE_SIZE } from "../admin-constants.js"
import { buildQuery } from "../admin-utils.js"
import { useDebouncedValue } from "../use-debounced-value.js"

export default function ConsumablesAdminTab({ showError, showSuccess }) {
  const [consumables, setConsumables] = useState([])
  const [consumablePage, setConsumablePage] = useState(1)
  const [consumableTotal, setConsumableTotal] = useState(0)
  const [consumableTotalPages, setConsumableTotalPages] = useState(1)
  const [consumableFilters, setConsumableFilters] = useState({ search: "", category: "" })
  const [consumableCategories, setConsumableCategories] = useState([])
  const [consumableModal, setConsumableModal] = useState(null)
  const [consumableForm, setConsumableForm] = useState(CONSUMABLE_INITIAL_FORM)
  const [isLoadingConsumables, setIsLoadingConsumables] = useState(true)
  const [isSubmittingConsumable, setIsSubmittingConsumable] = useState(false)
  const debouncedConsumableFilters = useDebouncedValue(consumableFilters, 250)

  const loadConsumables = useCallback(async (nextFilters = debouncedConsumableFilters, nextPage = consumablePage) => {
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
      showError(err.message || "Erro ao carregar consumíveis")
    } finally {
      setIsLoadingConsumables(false)
    }
  }, [consumablePage, debouncedConsumableFilters, showError])

  useEffect(() => {
    loadConsumables(debouncedConsumableFilters, consumablePage)
  }, [consumablePage, debouncedConsumableFilters, loadConsumables])

  function updateConsumableFilters(updater) {
    setConsumablePage(1)
    setConsumableFilters((prev) => {
      if (typeof updater === "function") return updater(prev)
      return { ...prev, ...updater }
    })
  }

  function openCreateConsumable() {
    setConsumableForm(CONSUMABLE_INITIAL_FORM)
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
        showSuccess("Consumível criado com sucesso.")
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
        showSuccess("Consumível atualizado com sucesso.")
      }
      setConsumableModal(null)
      await loadConsumables(debouncedConsumableFilters, consumablePage)
    } catch (err) {
      showError(err.message || "Erro ao salvar consumível")
    } finally {
      setIsSubmittingConsumable(false)
    }
  }

  async function handleDeleteConsumable(nome) {
    try {
      await adminRequest(`/admin/consumables/${encodeURIComponent(nome)}`, { method: "DELETE" })
      showSuccess("Consumível removido com sucesso.")
      await loadConsumables(debouncedConsumableFilters, consumablePage)
    } catch (err) {
      showError(err.message || "Erro ao remover consumível")
    }
  }

  return (
    <>
      <section className="admin-page__panel">
        <div className="admin-page__section-header">
          <div>
            <h2 className="admin-page__section-title">Consumíveis</h2>
            <p className="admin-page__section-subtitle">Monte um catálogo organizado por categoria para o jogador filtrar supplies com mais rapidez na tela de hunts.</p>
          </div>
          <button type="button" className="admin-page__primary-button" onClick={openCreateConsumable}>Novo consumível</button>
        </div>

        <div className="admin-page__filters-card">
          <div className="admin-page__filters-grid admin-page__filters-grid--aliases">
            <input
              className="admin-page__input"
              placeholder="Buscar consumível por nome"
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
          <span className="admin-page__stat">Página: {consumablePage} / {consumableTotalPages}</span>
          <span className="admin-page__stat">Categorias: {consumableCategories.length}</span>
          {consumableFilters.category ? <span className="admin-page__stat admin-page__stat--location">Filtro: {consumableFilters.category}</span> : null}
        </div>

        <div className="admin-page__pagination">
          <button type="button" className="admin-page__ghost-button" onClick={() => setConsumablePage((prev) => Math.max(1, prev - 1))} disabled={isLoadingConsumables || consumablePage <= 1}>Anterior</button>
          <button type="button" className="admin-page__ghost-button" onClick={() => setConsumablePage((prev) => Math.min(consumableTotalPages, prev + 1))} disabled={isLoadingConsumables || consumablePage >= consumableTotalPages}>Próxima</button>
        </div>

        {isLoadingConsumables ? (
          <div className="admin-page__empty admin-page__empty--full">Carregando consumíveis...</div>
        ) : !consumables.length ? (
          <div className="admin-page__empty admin-page__empty--full">Nenhum consumível encontrado.</div>
        ) : (
          <div className="admin-page__users-table-wrap">
            <div className="admin-page__users-table">
              <div className="admin-page__npc-row admin-page__npc-row admin-page__npc-row--consumable admin-page__npc-row--head">
                <span>Nome</span>
                <span>Categoria</span>
                <span>Preço NPC</span>
                <span>Ações</span>
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

      {consumableModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal character-modal--consumable">
            <div className="character-modal__header">
              <div>
                <span className="character-modal__eyebrow">Catálogo de supply</span>
                <h2 className="character-modal__title">{consumableModal.type === "create" ? "Novo consumível" : "Editar consumível"}</h2>
                <p className="character-modal__description">Defina nome, categoria e preço NPC. A categoria vira filtro para o jogador na tela de hunts.</p>
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
                  <input className="character-modal__input" value={consumableForm.categoria} onChange={(event) => setConsumableForm((prev) => ({ ...prev, categoria: event.target.value }))} placeholder="Ex: poções, berries, revive" />
                </div>
                <div className="character-modal__field">
                  <label>Preço NPC</label>
                  <input className="character-modal__input" type="number" min="0" step="0.01" value={consumableForm.preco_npc} onChange={(event) => setConsumableForm((prev) => ({ ...prev, preco_npc: event.target.value }))} />
                </div>
              </div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setConsumableModal(null)} disabled={isSubmittingConsumable}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingConsumable}>{isSubmittingConsumable ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
