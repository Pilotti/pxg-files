import { useEffect } from "react"
import "../styles/confirm-action-modal.css"

export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmTone = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isLoading) {
        onCancel?.()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, isLoading, onCancel])

  if (!open) return null

  return (
    <div
      className="confirm-action-modal__backdrop"
      onClick={() => {
        if (!isLoading) onCancel?.()
      }}
      role="presentation"
    >
      <div
        className="confirm-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-action-modal__icon" aria-hidden="true">
          !
        </div>

        <div className="confirm-action-modal__content">
          <h3 id="confirm-action-modal-title" className="confirm-action-modal__title">
            {title}
          </h3>
          <p className="confirm-action-modal__description">{description}</p>
        </div>

        <div className="confirm-action-modal__actions">
          <button
            type="button"
            className="confirm-action-modal__button confirm-action-modal__button--ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`confirm-action-modal__button confirm-action-modal__button--${confirmTone}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
