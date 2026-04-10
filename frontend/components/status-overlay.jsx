import "../styles/status-overlay.css"
import { useI18n } from "@/context/i18n-context.jsx"

export default function StatusOverlay({
  title,
  text,
  fullscreen = true,
  surface = "default"
}) {
  const { t } = useI18n()
  const resolvedTitle = title ?? t("appLoader.title")
  const resolvedText = text ?? t("common.loading")
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
        <h2 className="status-overlay__title">{resolvedTitle}</h2>
        <p className="status-overlay__text">{resolvedText}</p>
      </div>
    </div>
  )
}
