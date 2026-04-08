import "../styles/app-loader.css"

export default function AppLoader({
  title = "Aguarde um instante",
  text = "Carregando dados do sistema...",
  fullScreen = true
}) {
  return (
    <div
      className={
        fullScreen ? "app-loader app-loader--fullscreen" : "app-loader"
      }
      role="status"
      aria-live="polite"
    >
      <div className="app-loader__card">
        <div className="app-loader__spinner" />
        <h2 className="app-loader__title">{title}</h2>
        <p className="app-loader__text">{text}</p>
      </div>
    </div>
  )
}
