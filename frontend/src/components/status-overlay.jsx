import "../styles/status-overlay.css"

export default function StatusOverlay({
  title = "Aguarde um instante",
  text = "Carregando...",
  fullscreen = true,
  surface = "default"
}) {
  const rootClassName = fullscreen
    ? "status-overlay status-overlay--fullscreen"
    : "status-overlay status-overlay--page"

  const cardClassName = `status-overlay__card status-overlay__card--${surface}`

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-busy="true">
      <div className={cardClassName}>
        <div className="status-overlay__spinner-wrap" aria-hidden="true">
          <div className="status-overlay__spinner" />
          <div className="status-overlay__spinner-glow" />
        </div>
        <h2 className="status-overlay__title">{title}</h2>
        <p className="status-overlay__text">{text}</p>
      </div>
    </div>
  )
}
