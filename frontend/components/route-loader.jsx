import "../styles/route-loader.css"
import { useI18n } from "@/context/i18n-context.jsx"

export default function RouteLoader({ title, text }) {
  const { t } = useI18n()
  const resolvedTitle = title ?? t("common.loading")
  const resolvedText = text ?? t("routeLoader.text")

  return (
    <div className="route-loader">
      <div className="route-loader__card">
        <div className="route-loader__spinner" aria-hidden="true" />
        <h1 className="route-loader__title">{resolvedTitle}</h1>
        <p className="route-loader__text">{resolvedText}</p>
      </div>
    </div>
  )
}
