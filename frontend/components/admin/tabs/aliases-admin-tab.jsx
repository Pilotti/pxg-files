'use client'

import { useCallback, useEffect, useState } from "react"
import { adminRequest } from "@/services/admin-api.js"
import { buildQuery } from "../admin-utils.js"
import { useDebouncedValue } from "../use-debounced-value.js"

export default function AliasesAdminTab({ showError, showSuccess }) {
  const [aliases, setAliases] = useState([])
  const [npcItemNames, setNpcItemNames] = useState([])
  const [aliasFilters, setAliasFilters] = useState({
    search: "",
    status: "pending",
  })
  const [isLoadingAliases, setIsLoadingAliases] = useState(true)
  const [aliasDrafts, setAliasDrafts] = useState({})
  const [aliasSavingMap, setAliasSavingMap] = useState({})
  const debouncedAliasFilters = useDebouncedValue(aliasFilters, 250)

  const loadAliases = useCallback(async (nextFilters = debouncedAliasFilters) => {
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
  }, [debouncedAliasFilters, showError])

  const loadNpcItemNames = useCallback(async () => {
    try {
      const names = await adminRequest("/admin/hunt-npc-prices/names")
      setNpcItemNames(Array.isArray(names) ? names : [])
    } catch {
    }
  }, [])

  useEffect(() => {
    loadAliases(debouncedAliasFilters)
  }, [debouncedAliasFilters, loadAliases])

  useEffect(() => {
    loadNpcItemNames()
  }, [loadNpcItemNames])

  async function saveAlias(alias, shouldApprove = true) {
    const rawCanonical = aliasDrafts[alias.id] ?? alias.canonical_name ?? alias.observed_name
    const canonicalName = String(rawCanonical || "").trim()

    if (!canonicalName) {
      showError("Informe um nome canônico antes de salvar o alias.")
      return
    }

    if (shouldApprove && npcItemNames.length > 0 && !npcItemNames.includes(canonicalName)) {
      showError(`"${canonicalName}" não está na lista de itens NPC. Escolha um nome da lista para aprovar.`)
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

  return (
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
                <span className="admin-page__chip">Ocorrências: {alias.occurrences}</span>
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
  )
}
