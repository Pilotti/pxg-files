'use client'

import { useCallback, useEffect, useState } from "react"
import { adminRequest } from "@/services/admin-api.js"
import { POKEMON_PAGE_SIZE } from "../admin-constants.js"
import { buildQuery } from "../admin-utils.js"
import { useDebouncedValue } from "../use-debounced-value.js"

export default function PokemonAdminTab({ showError, showSuccess }) {
  const [pokemon, setPokemon] = useState([])
  const [pokemonPage, setPokemonPage] = useState(1)
  const [pokemonTotal, setPokemonTotal] = useState(0)
  const [pokemonTotalPages, setPokemonTotalPages] = useState(1)
  const [pokemonFilters, setPokemonFilters] = useState({ search: "" })
  const [pokemonModal, setPokemonModal] = useState(null)
  const [pokemonForm, setPokemonForm] = useState({ dex_id: "", name: "" })
  const [isLoadingPokemon, setIsLoadingPokemon] = useState(true)
  const [isSubmittingPokemon, setIsSubmittingPokemon] = useState(false)
  const [isDeletingPokemon, setIsDeletingPokemon] = useState(false)
  const debouncedPokemonFilters = useDebouncedValue(pokemonFilters, 250)

  const loadPokemon = useCallback(async (nextFilters = debouncedPokemonFilters, nextPage = pokemonPage) => {
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
      showError(err.message || "Erro ao carregar Pokémon")
    } finally {
      setIsLoadingPokemon(false)
    }
  }, [debouncedPokemonFilters, pokemonPage, showError])

  useEffect(() => {
    loadPokemon(debouncedPokemonFilters, pokemonPage)
  }, [debouncedPokemonFilters, pokemonPage, loadPokemon])

  function updatePokemonFilters(updater) {
    setPokemonPage(1)
    setPokemonFilters((prev) => {
      if (typeof updater === "function") {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
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
      await loadPokemon(debouncedPokemonFilters, pokemonPage)
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
      await loadPokemon(debouncedPokemonFilters, pokemonPage)
    } catch (err) {
      showError(err.message || "Erro ao remover Pokémon")
    } finally {
      setIsDeletingPokemon(false)
    }
  }

  return (
    <>
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
              onChange={(event) => updatePokemonFilters({ search: event.target.value })}
            />
          </div>
        </div>

        <div className="admin-page__stats-row">
          <span className="admin-page__stat">Total filtrado: {pokemonTotal}</span>
          <span className="admin-page__stat">Página: {pokemonPage} / {pokemonTotalPages}</span>
          <span className="admin-page__stat">Na página: {pokemon.length}</span>
        </div>

        <div className="admin-page__pagination">
          <button type="button" className="admin-page__ghost-button" onClick={() => setPokemonPage((prev) => Math.max(1, prev - 1))} disabled={isLoadingPokemon || pokemonPage <= 1}>Anterior</button>
          <button type="button" className="admin-page__ghost-button" onClick={() => setPokemonPage((prev) => Math.min(pokemonTotalPages, prev + 1))} disabled={isLoadingPokemon || pokemonPage >= pokemonTotalPages}>Próxima</button>
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
    </>
  )
}
