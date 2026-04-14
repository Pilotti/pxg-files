import { useCallback, useEffect, useMemo, useState } from "react"
import { adminRequest, getAdminToken } from "@/services/admin-api.js"
import { API_URL } from "@/services/session-manager.js"

export default function OcrReviewAdminTab({ showError }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [savingName, setSavingName] = useState("")

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [items])

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await adminRequest("/admin/ocr-review")
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (error) {
      showError(error?.message || "Erro ao carregar imagens OCR")
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleOpenImage = useCallback(async (filename) => {
    try {
      const popup = window.open("", "_blank", "noopener")
      if (!popup) {
        throw new Error("Pop-up bloqueado pelo navegador")
      }
      const token = getAdminToken()
      const response = await fetch(`${API_URL}/admin/ocr-review/${encodeURIComponent(filename)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        popup.close()
        throw new Error("Falha ao abrir a imagem")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      popup.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) {
      showError(error?.message || "Falha ao abrir a imagem")
    }
  }, [showError])

  const handleUpdateStatus = useCallback(async (filename, status) => {
    setSavingName(filename)
    try {
      await adminRequest(`/admin/ocr-review/${encodeURIComponent(filename)}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
      setItems((current) =>
        current.map((item) => (item.filename === filename ? { ...item, status } : item))
      )
    } catch (error) {
      showError(error?.message || "Falha ao atualizar o status")
    } finally {
      setSavingName("")
    }
  }, [showError])

  return (
    <section className="admin-page__panel">
      <div className="admin-page__section-header">
        <div>
          <h2 className="admin-page__section-title">Imagens problemáticas do OCR</h2>
          <p className="admin-page__section-subtitle">
            Arquivos que não tiveram a tabela detectada e precisam de revisão manual.
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
        <span className="admin-page__stat">Total: {sortedItems.length}</span>
      </div>

      {isLoading ? (
        <div className="admin-page__empty admin-page__empty--full">Carregando imagens...</div>
      ) : !sortedItems.length ? (
        <div className="admin-page__empty admin-page__empty--full">Nenhuma imagem pendente.</div>
      ) : (
        <div className="admin-page__cards-grid">
          {sortedItems.map((item) => (
            <article key={item.filename} className="admin-page__tile">
              <div className="admin-page__tile-main">
                <div className="admin-page__tile-top">
                  <strong className="admin-page__tile-title">{item.filename}</strong>
                  <span className={`admin-page__status ${item.status === "approved" ? "admin-page__status--active" : item.status === "ignored" ? "admin-page__status--inactive" : "admin-page__status--pending"}`}>
                    {item.status === "approved" ? "Aprovado" : item.status === "ignored" ? "Ignorado" : "Pendente"}
                  </span>
                </div>
                <div className="admin-page__chip-row">
                  <span className="admin-page__chip">Tamanho: {Math.round(item.size_bytes / 1024)} KB</span>
                  <span className="admin-page__chip">
                    Data: {new Date(item.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
              <div className="admin-page__tile-actions admin-page__tile-actions--row">
                <button
                  type="button"
                  className="admin-page__ghost-button"
                  onClick={() => handleOpenImage(item.filename)}
                >
                  Ver imagem
                </button>
                <button
                  type="button"
                  className="admin-page__ghost-button"
                  onClick={() => handleUpdateStatus(item.filename, "approved")}
                  disabled={savingName === item.filename}
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  className="admin-page__ghost-button"
                  onClick={() => handleUpdateStatus(item.filename, "ignored")}
                  disabled={savingName === item.filename}
                >
                  Ignorar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
