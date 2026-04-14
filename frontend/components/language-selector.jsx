import { useI18n } from "@/context/i18n-context.jsx"
import AppSelect from "./app-select.jsx"

export default function LanguageSelector({ className = "" }) {
  const { language, options, setLanguage, t } = useI18n()

  return (
    <label className={`language-selector ${className}`.trim()}>
      <span className="language-selector__label">{t("common.language")}</span>
      <AppSelect
        className="language-selector__select"
        value={language}
        options={options}
        onChange={setLanguage}
        aria-label={t("common.language")}
      />
    </label>
  )
}
