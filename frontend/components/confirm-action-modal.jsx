import { useEffect } from "react"
import { useI18n } from "@/context/i18n-context.jsx"
import "../styles/confirm-action-modal.css"

export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmTone = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useI18n()

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

  const resolvedConfirmLabel = confirmLabel ?? t("common.confirm")
  const resolvedCancelLabel = cancelLabel ?? t("common.cancel")

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
            {resolvedCancelLabel}
          </button>

          <button
            type="button"
            className={`confirm-action-modal__button confirm-action-modal__button--${confirmTone}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? t("common.saving") : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
