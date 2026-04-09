'use client'

import { useCallback, useEffect, useState } from "react"
import { adminRequest } from "@/services/admin-api.js"

export default function SidebarAdminTab({ showError, showSuccess }) {
  const [sidebarMenus, setSidebarMenus] = useState([])
  const [isLoadingSidebarMenus, setIsLoadingSidebarMenus] = useState(true)
  const [savingSidebarMenuMap, setSavingSidebarMenuMap] = useState({})

  const loadSidebarMenus = useCallback(async () => {
    setIsLoadingSidebarMenus(true)
    try {
      setSidebarMenus(await adminRequest("/admin/sidebar-menus"))
    } catch (err) {
      showError(err.message || "Erro ao carregar configuração da sidebar")
    } finally {
      setIsLoadingSidebarMenus(false)
    }
  }, [showError])

  useEffect(() => {
    loadSidebarMenus()
  }, [loadSidebarMenus])

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
      showSuccess("Configuração do menu atualizada.")
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

  return (
    <section className="admin-page__panel">
      <div className="admin-page__section-header">
        <div>
          <h2 className="admin-page__section-title">Menus da Sidebar</h2>
          <p className="admin-page__section-subtitle">
            Defina quais menus ficam ativos para os jogadores e marque os que estão em teste com o selo beta.
          </p>
        </div>
        <button type="button" className="admin-page__ghost-button" onClick={loadSidebarMenus}>
          Atualizar
        </button>
      </div>

      <div className="admin-page__cards-grid admin-page__cards-grid--sidebar">
        {isLoadingSidebarMenus ? <div className="admin-page__empty admin-page__empty--full">Carregando menus...</div> : !sidebarMenus.length ? <div className="admin-page__empty admin-page__empty--full">Nenhuma configuração de menu encontrada.</div> : sidebarMenus.map((menu) => {
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
  )
}
