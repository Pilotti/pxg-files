export default function AdminToast({ toast, onClose }) {
  if (!toast) return null

  return (
    <div className={toast.type === "success" ? "admin-toast admin-toast--success" : "admin-toast admin-toast--error"}>
      <div className="admin-toast__content">
        <strong className="admin-toast__title">{toast.type === "success" ? "Sucesso" : "Erro"}</strong>
        <span className="admin-toast__message">{toast.message}</span>
      </div>

      <button type="button" className="admin-toast__close" onClick={onClose} aria-label="Fechar notificação">
        x
      </button>
    </div>
  )
}
