import StatusOverlay from "./status-overlay.jsx"
import { useI18n } from "@/context/i18n-context.jsx"

export default function AuthLoadingOverlay({ text }) {
  const { t } = useI18n()

  return (
    <StatusOverlay
      fullscreen
      surface="default"
      title={t("appLoader.title")}
      text={text ?? t("auth.loginWait")}
    />
  )
}
