import "../styles/fullscreen-loader.css"

export default function FullscreenLoader({
  title = "Aguarde um instante",
  text = "Carregando...",
  compact = false
}) {
  return (
    <div
      className={compact ? "fullscreen-loader fullscreen-loader--compact" : "fullscreen-loader"}
      role="status"
      aria-live="polite"
    >
      <div className="fullscreen-loader__card">
        <div className="fullscreen-loader__spinner" />
        <h2 className="fullscreen-loader__title">{title}</h2>
        <p className="fullscreen-loader__text">{text}</p>
      </div>
    </div>
  )
}
