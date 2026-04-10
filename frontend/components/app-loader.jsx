import "../styles/app-loader.css"
import { useI18n } from "@/context/i18n-context.jsx"

export default function AppLoader({
  title,
  text,
  fullScreen = true
}) {
  const { t } = useI18n()
  const resolvedTitle = title ?? t("appLoader.title")
  const resolvedText = text ?? t("appLoader.text")
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
        <h2 className="app-loader__title">{resolvedTitle}</h2>
        <p className="app-loader__text">{resolvedText}</p>
      </div>
    </div>
  )
}
