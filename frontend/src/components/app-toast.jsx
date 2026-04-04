import "../styles/app-toast.css"

function ToastIcon({ type }) {
  if (type === "success") {
    return <span aria-hidden="true">✓</span>
  }

  if (type === "error") {
    return <span aria-hidden="true">!</span>
  }

  if (type === "warning") {
    return <span aria-hidden="true">!</span>
  }

  return <span aria-hidden="true">i</span>
}

const TYPE_TITLES = {
  success: "Sucesso",
  error: "Erro",
  warning: "Atenção",
  info: "Informação",
}

export default function AppToast({ toast, onClose }) {
  if (!toast) {
    return null
  }

  const type = ["success", "error", "warning", "info"].includes(toast.type)
    ? toast.type
    : "info"

  const title = toast.title || TYPE_TITLES[type]
  const progressStyle = toast.duration > 0 ? { animationDuration: `${toast.duration}ms` } : undefined

  return (
    <div className={`app-toast app-toast--${type}`} role="alert" aria-live="polite">
      <div className="app-toast__accent" aria-hidden="true" />

      <div className={`app-toast__icon app-toast__icon--${type}`}>
        <ToastIcon type={type} />
      </div>

      <div className="app-toast__content">
        <strong className="app-toast__title">{title}</strong>
        {toast.message ? <span className="app-toast__message">{toast.message}</span> : null}
      </div>

      <button
        type="button"
        className="app-toast__close"
        onClick={onClose}
        aria-label="Fechar aviso"
      >
        ✕
      </button>

      {toast.duration > 0 ? (
        <div className="app-toast__progress" aria-hidden="true">
          <span className="app-toast__progress-bar" style={progressStyle} />
        </div>
      ) : null}
    </div>
  )
}
