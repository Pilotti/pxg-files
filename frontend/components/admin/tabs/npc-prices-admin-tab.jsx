'use client'

import { useCallback, useEffect, useState } from "react"
import { adminRequest } from "@/services/admin-api.js"
import { NPC_PRICE_INITIAL_FORM, NPC_PRICE_PAGE_SIZE } from "../admin-constants.js"
import { buildQuery } from "../admin-utils.js"
import { useDebouncedValue } from "../use-debounced-value.js"

export default function NpcPricesAdminTab({ showError, showSuccess }) {
  const [npcPrices, setNpcPrices] = useState([])
  const [npcPricePage, setNpcPricePage] = useState(1)
  const [npcPriceTotal, setNpcPriceTotal] = useState(0)
  const [npcPriceTotalPages, setNpcPriceTotalPages] = useState(1)
  const [npcPriceFilters, setNpcPriceFilters] = useState({ search: "" })
  const [npcPriceModal, setNpcPriceModal] = useState(null)
  const [npcPriceForm, setNpcPriceForm] = useState(NPC_PRICE_INITIAL_FORM)
  const [isLoadingNpcPrices, setIsLoadingNpcPrices] = useState(true)
  const [isSubmittingNpcPrice, setIsSubmittingNpcPrice] = useState(false)
  const debouncedNpcPriceFilters = useDebouncedValue(npcPriceFilters, 250)

  const loadNpcPrices = useCallback(async (nextFilters = debouncedNpcPriceFilters, nextPage = npcPricePage) => {
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
      showError(err.message || "Erro ao carregar preços NPC")
    } finally {
      setIsLoadingNpcPrices(false)
    }
  }, [debouncedNpcPriceFilters, npcPricePage, showError])

  useEffect(() => {
    loadNpcPrices(debouncedNpcPriceFilters, npcPricePage)
  }, [debouncedNpcPriceFilters, npcPricePage, loadNpcPrices])

  function updateNpcPriceFilters(updater) {
    setNpcPricePage(1)
    setNpcPriceFilters((prev) => {
      if (typeof updater === "function") {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
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
    setNpcPriceForm(NPC_PRICE_INITIAL_FORM)
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
        showSuccess("Preço NPC atualizado com sucesso.")
      }
      setNpcPriceModal(null)
      await loadNpcPrices(debouncedNpcPriceFilters, npcPricePage)
    } catch (err) {
      showError(err.message || "Erro ao atualizar preço NPC")
    } finally {
      setIsSubmittingNpcPrice(false)
    }
  }

  return (
    <>
      <section className="admin-page__panel">
        <div className="admin-page__section-header">
          <div>
            <h2 className="admin-page__section-title">Preços NPC</h2>
            <p className="admin-page__section-subtitle">
              Tabela oficial de preço NPC usada para montar os totais no OCR e sincronizar nomes canônicos dos aliases.
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
          <span className="admin-page__stat">Página: {npcPricePage} / {npcPriceTotalPages}</span>
          <span className="admin-page__stat">Na página: {npcPrices.length}</span>
        </div>

        <div className="admin-page__pagination">
          <button type="button" className="admin-page__ghost-button" onClick={() => setNpcPricePage((prev) => Math.max(1, prev - 1))} disabled={isLoadingNpcPrices || npcPricePage <= 1}>Anterior</button>
          <button type="button" className="admin-page__ghost-button" onClick={() => setNpcPricePage((prev) => Math.min(npcPriceTotalPages, prev + 1))} disabled={isLoadingNpcPrices || npcPricePage >= npcPriceTotalPages}>Próxima</button>
        </div>

        {isLoadingNpcPrices ? (
          <div className="admin-page__empty admin-page__empty--full">Carregando preços NPC...</div>
        ) : !npcPrices.length ? (
          <div className="admin-page__empty admin-page__empty--full">Nenhum preço NPC encontrado.</div>
        ) : (
          <div className="admin-page__users-table-wrap">
            <div className="admin-page__users-table">
              <div className="admin-page__npc-row admin-page__npc-row--head">
                <span>Nome</span>
                <span>Preço NPC</span>
                <span>Aliases</span>
                <span>Ações</span>
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
                    ) : "—"}
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

      {npcPriceModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal">
            <h2 className="character-modal__title">{npcPriceModal.type === "create" ? "Novo item NPC" : "Editar preço NPC"}</h2>
            <form onSubmit={handleSubmitNpcPrice}>
              <div className="character-modal__field"><label>Nome do item</label><input className="character-modal__input" value={npcPriceForm.name} onChange={(event) => setNpcPriceForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Preço unitário NPC</label><input className="character-modal__input" type="number" min="0" step="0.01" value={npcPriceForm.unit_price} onChange={(event) => setNpcPriceForm((prev) => ({ ...prev, unit_price: event.target.value }))} /></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setNpcPriceModal(null)} disabled={isSubmittingNpcPrice}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingNpcPrice}>{isSubmittingNpcPrice ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
