import "../styles/fullscreen-loader.css"
import { useI18n } from "@/context/i18n-context.jsx"

export default function FullscreenLoader({
  title,
  text,
  compact = false
}) {
  const { t } = useI18n()
  const resolvedTitle = title ?? t("appLoader.title")
  const resolvedText = text ?? t("common.loading")

  return (
    <div
      className={compact ? "fullscreen-loader fullscreen-loader--compact" : "fullscreen-loader"}
      role="status"
      aria-live="polite"
    >
      <div className="fullscreen-loader__card">
        <div className="fullscreen-loader__spinner" />
        <h2 className="fullscreen-loader__title">{resolvedTitle}</h2>
        <p className="fullscreen-loader__text">{resolvedText}</p>
      </div>
    </div>
  )
}
