'use client'

import { useCallback, useEffect, useState } from "react"
import ConfirmActionModal from "@/components/confirm-action-modal.jsx"
import { adminRequest } from "@/services/admin-api.js"
import { buildQuery } from "../admin-utils.js"
import { useDebouncedValue } from "../use-debounced-value.js"

export default function UsersAdminTab({ showError, showSuccess }) {
  const [users, setUsers] = useState([])
  const [userFilters, setUserFilters] = useState({ search: "" })
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [deletingUserId, setDeletingUserId] = useState(null)
  const [userDeleteModal, setUserDeleteModal] = useState(null)
  const debouncedUserFilters = useDebouncedValue(userFilters, 250)

  const loadUsers = useCallback(async (nextFilters = debouncedUserFilters) => {
    setIsLoadingUsers(true)
    try {
      setUsers(await adminRequest(`/admin/users${buildQuery(nextFilters)}`))
    } catch (err) {
      showError(err.message || "Erro ao carregar usuários")
    } finally {
      setIsLoadingUsers(false)
    }
  }, [debouncedUserFilters, showError])

  useEffect(() => {
    loadUsers(debouncedUserFilters)
  }, [debouncedUserFilters, loadUsers])

  function openUserDeleteModal(userId, username) {
    if (!userId || deletingUserId) return
    setUserDeleteModal({ userId, username })
  }

  async function handleDeleteUserConfirmed() {
    if (!userDeleteModal?.userId || deletingUserId) return

    const userId = userDeleteModal.userId
    setDeletingUserId(userId)
    try {
      await adminRequest(`/admin/users/${userId}`, { method: "DELETE" })
      showSuccess("Usuário removido com sucesso.")
      setUserDeleteModal(null)
      await loadUsers(debouncedUserFilters)
    } catch (err) {
      showError(err.message || "Erro ao remover usuário")
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <>
      <section className="admin-page__panel">
        <div className="admin-page__section-header">
          <div>
            <h2 className="admin-page__section-title">Usuários cadastrados</h2>
            <p className="admin-page__section-subtitle">Visualize ID e usuário sem expor dados sensíveis.</p>
          </div>
          <button type="button" className="admin-page__ghost-button" onClick={() => loadUsers(debouncedUserFilters)}>
            Atualizar
          </button>
        </div>

        <div className="admin-page__filters-card">
          <div className="admin-page__filters-grid admin-page__filters-grid--npc-prices">
            <input
              className="admin-page__input"
              placeholder="Buscar por usuário ou email"
              value={userFilters.search}
              onChange={(event) => setUserFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </div>
        </div>

        {isLoadingUsers ? <div className="admin-page__empty admin-page__empty--full">Carregando usuários...</div> : !users.length ? <div className="admin-page__empty admin-page__empty--full">Nenhum usuário encontrado.</div> : (
          <div className="admin-page__users-table-wrap">
            <div className="admin-page__users-table">
              <div className="admin-page__users-row admin-page__users-row--head">
                <span>ID</span>
                <span>Usuário</span>
                <span>Email</span>
                <span>Ações</span>
              </div>

              {users.map((item) => (
                <div key={item.id} className="admin-page__users-row">
                  <span>{item.id}</span>
                  <span>{item.username}</span>
                  <span>{item.email}</span>
                  <span>
                    <button
                      type="button"
                      className="admin-page__danger-button admin-page__danger-button--sm"
                      onClick={() => openUserDeleteModal(item.id, item.username)}
                      disabled={deletingUserId === item.id}
                    >
                      {deletingUserId === item.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <ConfirmActionModal
        open={Boolean(userDeleteModal)}
        title="Excluir usuário"
        description={userDeleteModal ? `Excluir o usuário ${userDeleteModal.username || userDeleteModal.userId}? Esta ação remove tudo relacionado.` : ""}
        confirmLabel="Excluir"
        confirmTone="danger"
        isLoading={Boolean(deletingUserId)}
        onCancel={() => {
          if (!deletingUserId) setUserDeleteModal(null)
        }}
        onConfirm={handleDeleteUserConfirmed}
      />
    </>
  )
}
